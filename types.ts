export enum UserRole {
  PHARMACIST = 'PHARMACIST',
  IDS = 'IDS',
  AMS_ADMIN = 'AMS_ADMIN'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export enum PrescriptionStatus {
  PENDING = 'pending',
  FOR_IDS_APPROVAL = 'for_ids_approval',
  APPROVED = 'approved',
  DISAPPROVED = 'disapproved',
  DELETED = 'deleted'
}

export enum DrugType {
  MONITORED = 'Monitored',
  RESTRICTED = 'Restricted'
}

export enum ActionType {
  APPROVE = 'APPROVE',
  DISAPPROVE = 'DISAPPROVE',
  FORWARD_IDS = 'FORWARD_IDS',
  DELETE = 'DELETE',
  REVERSE_TO_APPROVE = 'REVERSE_TO_APPROVE',
  REVERSE_TO_DISAPPROVE = 'REVERSE_TO_DISAPPROVE'
}

export interface Prescription {
  id: number;
  created_at?: string;
  req_date: string;
  dispensed_date?: string; // Pharmacist action date
  ids_approved_at?: string; // New field for IDS approval date
  ids_disapproved_at?: string; // New field for IDS disapproval date
  status: PrescriptionStatus;
  notes?: string;
  
  // Patient Info
  patient_name: string;
  hospital_number: string;
  ward?: string;
  age?: string;
  sex?: string;
  weight_kg?: string;
  height_cm?: string;
  mode?: 'adult' | 'pediatric'; // New field for patient classification

  // Clinical Data
  diagnosis?: string;
  sgpt?: string;
  scr_mgdl?: string;
  egfr_text?: string;

  // Medication Info
  antimicrobial: string; // Renamed from drug_name
  drug_type: DrugType;
  dose?: string;
  frequency?: string;
  duration?: string;
  
  // Indication
  indication?: string;
  basis_indication?: string;

  // Microbiology / History
  previous_antibiotics?: string;
  organisms?: string;
  specimen?: string;

  // Staff / Personnel
  requested_by: string;
  dispensed_by?: string; // Replaced reviewed_by
  resident_name?: string;
  clinical_dept?: string;
  service_resident_name?: string;
  id_specialist?: string;

  // Disapproval
  disapproved_reason?: string;
}