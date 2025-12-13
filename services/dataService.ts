
import { supabase } from './supabaseClient';
import { Prescription, PrescriptionStatus, DrugType, AMSAudit, MonitoringPatient } from '../types';
import { GOOGLE_SHEET_WEB_APP_URL } from '../constants';

/**
 * Sends data to a Google Apps Script Web App for backup to Google Sheets.
 * This is a one-way communication from the app to Sheets.
 * @param sheetName The name of the sheet within the Google Spreadsheet (e.g., "Prescriptions", "Audits").
 * @param data The data object to send. It will be stringified as JSON.
 */
const sendToGoogleSheet = async (sheetName: string, data: any) => {
  if (!GOOGLE_SHEET_WEB_APP_URL) {
    console.warn(`Google Sheet backup URL not configured for '${sheetName}'. Skipping backup.`);
    return;
  }

  // Flatten nested objects/arrays for Google Sheets
  // Google Sheets (via simpler Apps Scripts) handles flat key-value pairs best.
  // Complex objects like 'antimicrobials' array or 'diagnostics' object in AMSAudit
  // should be stringified so they fit into a single cell.
  const flatData: Record<string, any> = {};
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      // Explicitly handle undefined to ensure key presence (as null)
      if (value === undefined) {
        flatData[key] = null;
      }
      // Check if value is an object (and not null) to stringify it
      else if (typeof value === 'object' && value !== null) {
        flatData[key] = JSON.stringify(value);
      } else {
        flatData[key] = value;
      }
    });
  } else {
      Object.assign(flatData, data);
  }

  try {
    const payloadBody = JSON.stringify({
      sheetName: sheetName,
      record: flatData,
    });

    console.log(`Attempting to send data to Google Sheet '${sheetName}'. Payload size: ${payloadBody.length} bytes.`);
    
    const response = await fetch(GOOGLE_SHEET_WEB_APP_URL, {
      method: 'POST',
      keepalive: true, // IMPORTANT: Ensures request survives if the component unmounts immediately (e.g., closing modal)
      headers: {
        // IMPORTANT: Use text/plain to avoid sending a CORS Preflight (OPTIONS) request.
        // Google Apps Script doesn't handle OPTIONS requests well, leading to CORS errors.
        // The script can still parse the JSON body from e.postData.contents.
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payloadBody,
    });
    
    if (!response.ok) {
        console.error(`Google Sheet HTTP Error: ${response.status} ${response.statusText}`);
        return;
    }

    // Attempt to parse the script's JSON response to check for application-level errors
    try {
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            console.log(`Google Sheet Backup Success: ${result.message}`);
        } else {
            console.error(`Google Sheet Script Error: ${result.message}`);
        }
    } catch (parseError) {
        // Sometimes the script might return HTML or raw text if it crashes hard
        const text = await response.text().catch(() => "No body");
        console.warn(`Google Sheet response was not JSON (Status 200). Raw response: ${text.substring(0, 200)}...`);
    }

  } catch (error: any) {
    if (error instanceof TypeError) {
      // This is often a network error (e.g., no internet, CORS block, invalid URL that can't be resolved)
      console.error(`Network or CORS error while sending data to Google Sheet '${sheetName}':`, error.message, error);
    } else {
      console.error(`Failed to send data to Google Sheet '${sheetName}':`, error);
    }
  }
};


// Table name: 'requests'

export const fetchPrescriptions = async (): Promise<{ data: Prescription[], error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('req_date', { ascending: false });

    if (error) {
      console.error('Supabase fetch error object:', error);
      const errorMsg = `Code: ${error.code} - ${error.message} ${error.details ? `(${error.details})` : ''} ${error.hint ? `Hint: ${error.hint}` : ''}`;
      return { data: [], error: errorMsg };
    }
    return { data: data as Prescription[], error: null };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Unexpected error:', msg);
    return { data: [], error: msg || 'Unknown error occurred' };
  }
};

export const updatePrescriptionStatus = async (
  id: number, 
  status: PrescriptionStatus | null | undefined, 
  updates: { [key: string]: any } // Use a flexible object for updates
) => {
  const payload: any = { 
    ...updates // Spread the dynamic updates here (including findings)
  };

  if (status) {
    payload.status = status;
  }

  const { error } = await supabase
    .from('requests')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Update error:', JSON.stringify(error, null, 2));
    throw error;
  }

  // After successful Supabase update, fetch the latest state and send to Google Sheets
  try {
    const { data: updatedItem, error: fetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch updated prescription for Google Sheets backup:', fetchError);
    } else if (updatedItem) {
      // Await this to ensure it completes even if UI transitions
      await sendToGoogleSheet("Prescriptions", updatedItem);
    }
  } catch (sheetError) {
    console.error('Error in Google Sheets backup after prescription update:', sheetError);
  }
};

export const deletePrescription = async (id: number) => {
  const { error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete error:', JSON.stringify(error, null, 2));
    throw error;
  }
  // For deletion, we could send a special "deleted" status or just log the event.
  // For a simple backup, we'll just log the deletion (not the item itself, but the ID).
  await sendToGoogleSheet("Prescriptions_Deleted", { id: id, timestamp: new Date().toISOString() });
};

export const createPrescription = async (prescription: Partial<Prescription>) => {
  const { data, error } = await supabase
    .from('requests')
    .insert([prescription])
    .select() // Use select to get the inserted data, including the generated ID
    .single();

  if (error) {
    console.error('Create error:', JSON.stringify(error, null, 2));
    throw error;
  }

  // After successful Supabase insert, send the newly created item to Google Sheets
  if (data) {
    await sendToGoogleSheet("Prescriptions", data);
  }
};

// --- AUDIT FUNCTIONS ---

export const createAudit = async (audit: Partial<AMSAudit>) => {
  const { data, error } = await supabase
    .from('audits')
    .insert([audit])
    .select() // Use select to get the inserted data, including the generated ID
    .single();

  if (error) {
    console.error('Create Audit error:', JSON.stringify(error, null, 2));
    throw error;
  }

  // After successful Supabase insert, send the newly created audit to Google Sheets
  if (data) {
    await sendToGoogleSheet("Audits", data);
  }
};

export const updateAudit = async (id: number, audit: Partial<AMSAudit>) => {
  const { error } = await supabase
    .from('audits')
    .update(audit)
    .eq('id', id);

  if (error) {
    console.error('Update Audit error:', JSON.stringify(error, null, 2));
    throw error;
  }

  // After successful Supabase update, fetch the latest state and send to Google Sheets
  try {
    const { data: updatedItem, error: fetchError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch updated audit for Google Sheets backup:', fetchError);
    } else if (updatedItem) {
      await sendToGoogleSheet("Audits", updatedItem);
    }
  } catch (sheetError) {
    console.error('Error in Google Sheets backup after audit update:', sheetError);
  }
};

export const fetchAudits = async (): Promise<{ data: AMSAudit[], error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('audits')
      .select('*')
      .order('audit_date', { ascending: false });

    if (error) {
       // If table doesn't exist yet, return empty but log
       if (error.code === '42P01') { 
         console.warn("Audits table does not exist yet.");
         return { data: [], error: null };
       }
       return { data: [], error: error.message };
    }
    return { data: data as AMSAudit[], error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
};

// --- MONITORING FUNCTIONS ---

export const fetchMonitoringPatients = async (statusFilter: string = 'Admitted'): Promise<{ data: MonitoringPatient[], error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('monitoring_patients')
      .select('*')
      .eq('status', statusFilter)
      .order('created_at', { ascending: false });

    if (error) {
       if (error.code === '42P01' || error.code === 'PGRST205') { 
         console.warn("Monitoring table does not exist yet.");
         return { data: [], error: "Monitoring Table Missing" };
       }
       return { data: [], error: error.message };
    }
    return { data: data as MonitoringPatient[], error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
};

export const fetchAllMonitoringPatients = async (): Promise<{ data: MonitoringPatient[], error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('monitoring_patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
       if (error.code === '42P01' || error.code === 'PGRST205') { 
         console.warn("Monitoring table does not exist yet.");
         return { data: [], error: "Monitoring Table Missing" };
       }
       return { data: [], error: error.message };
    }
    return { data: data as MonitoringPatient[], error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
};

export const createMonitoringPatient = async (patient: Partial<MonitoringPatient>) => {
  try {
    const { data, error } = await supabase
      .from('monitoring_patients')
      .insert([patient])
      .select()
      .single();

    if (error) {
      // Fallback: If 'last_updated_by' column is missing (PGRST204), try insert without it
      if (error.code === 'PGRST204' && patient.last_updated_by) {
          console.warn("Column 'last_updated_by' missing in DB. Retrying insert without it.");
          const { last_updated_by, ...safePatient } = patient;
          const { data: retryData, error: retryError } = await supabase
            .from('monitoring_patients')
            .insert([safePatient])
            .select()
            .single();
          
          if (retryError) throw retryError;
          return retryData;
      }
      throw error;
    }
    return data;
  } catch (err: any) {
    console.error('Create Monitoring Patient error:', JSON.stringify(err, null, 2));
    throw new Error(err.message || "Database insert failed");
  }
};

export const updateMonitoringPatient = async (id: number, updates: Partial<MonitoringPatient>) => {
  try {
    const { error } = await supabase
      .from('monitoring_patients')
      .update(updates)
      .eq('id', id);

    if (error) {
      // Fallback: If 'last_updated_by' column is missing (PGRST204), try updating without it
      if (error.code === 'PGRST204' && updates.last_updated_by) {
          console.warn("Column 'last_updated_by' missing in DB. Retrying update without it.");
          const { last_updated_by, ...safeUpdates } = updates;
          const { error: retryError } = await supabase
            .from('monitoring_patients')
            .update(safeUpdates)
            .eq('id', id);
          
          if (retryError) throw retryError;
          return;
      }
      throw error;
    }
  } catch (err: any) {
    console.error('Update Monitoring Patient error:', JSON.stringify(err, null, 2));
    throw new Error(err.message || "Database update failed");
  }
};
