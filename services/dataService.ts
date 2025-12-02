import { supabase } from './supabaseClient';
import { Prescription, PrescriptionStatus, DrugType } from '../types';

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
  status: PrescriptionStatus, 
  updates: { [key: string]: any } // Use a flexible object for updates
) => {
  const payload = { 
    status, 
    ...updates // Spread the dynamic updates here
  };

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

export const seedDatabase = async () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const mockData = [
    {
      patient_name: "Juan Dela Cruz",
      hospital_number: "P-1001",
      age: "45",
      sex: "Male",
      antimicrobial: "Meropenem",
      drug_type: "Restricted",
      status: "pending",
      requested_by: "Hermoso, Zenaida R.",
      ward: "ICU",
      mode: 'adult',
      req_date: now.toISOString(),
      created_at: now.toISOString()
    },
    {
      patient_name: "Maria Clara",
      hospital_number: "P-1002",
      age: "62",
      sex: "Female",
      antimicrobial: "Ceftriaxone",
      drug_type: "Monitored",
      status: "pending",
      requested_by: "Hermoso, Zenaida R.",
      ward: "IM",
      mode: 'adult',
      req_date: now.toISOString(),
      created_at: now.toISOString()
    },
    {
      patient_name: "Pedro Penduko",
      hospital_number: "P-1003",
      age: "10",
      sex: "Male",
      antimicrobial: "Vancomycin",
      drug_type: "Restricted",
      status: "for_ids_approval",
      requested_by: "Oasay, Victoria C.",
      ward: "Pediatrics",
      mode: 'pediatric',
      req_date: now.toISOString(),
      created_at: now.toISOString(),
      dispensed_by: "Oasay, Victoria C.", // Pharmacist forwarded
      dispensed_date: now.toISOString(),
    },
    {
      patient_name: "Nena Santos",
      hospital_number: "P-1004",
      age: "28",
      sex: "Female",
      antimicrobial: "Piperacillin-Tazobactam",
      drug_type: "Monitored",
      status: "approved",
      requested_by: "Abello, Corazon L.",
      dispensed_by: "Abello, Corazon L.",
      ward: "OB",
      mode: 'adult',
      req_date: yesterday.toISOString(),
      created_at: yesterday.toISOString(),
      dispensed_date: now.toISOString()
    },
    {
      patient_name: "Jose Rizal",
      hospital_number: "P-1005",
      age: "5",
      sex: "Male",
      antimicrobial: "Colistin",
      drug_type: "Restricted",
      status: "approved",
      requested_by: "Calma, Annalyn B.",
      dispensed_by: "Dr. Paulo Garcia",
      ward: "PICU",
      mode: 'pediatric',
      req_date: yesterday.toISOString(),
      created_at: yesterday.toISOString(),
      ids_approved_at: now.toISOString() // Example of IDS approved date
    }
  ];

  const { error } = await supabase.from('requests').insert(mockData);
  if (error) {
    const errorMsg = `Code: ${error.code} - ${error.message}`;
    console.error("Seed error", errorMsg);
    return { success: false, error: errorMsg };
  } else {
    console.log("Database seeded successfully");
    return { success: true };
  }
};