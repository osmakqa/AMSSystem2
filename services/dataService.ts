
import { supabase } from './supabaseClient';
import { Prescription, PrescriptionStatus, DrugType, AMSAudit } from '../types';

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
};

export const createPrescription = async (prescription: Partial<Prescription>) => {
  const { error } = await supabase
    .from('requests')
    .insert([prescription]);

  if (error) {
    console.error('Create error:', JSON.stringify(error, null, 2));
    throw error;
  }
};

// --- AUDIT FUNCTIONS ---

export const createAudit = async (audit: Partial<AMSAudit>) => {
  const { error } = await supabase
    .from('audits')
    .insert([audit]);

  if (error) {
    console.error('Create Audit error:', JSON.stringify(error, null, 2));
    throw error;
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
