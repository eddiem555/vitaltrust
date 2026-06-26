export interface Patient {
  id: string;
  name: string;
  dob: string;
  ssn?: string;
  insurance_id?: string;
  phone?: string;
  address?: string;
  email?: string;
  emergencyContact?: string;
  condition: string;
  medications: string[];
  lastVisit: string;
  assignedDoctorId?: string;
  assignedNurseId?: string;
  status: 'active' | 'discharged' | 'pending-triage';
  clinical_notes?: string;
  vitals?: {
    hr: string;
    temp: string;
    bp: string;
    lastUpdated: string;
  };
}

export interface User {
  id: string;
  role: 'admin' | 'patient' | 'nurse' | 'doctor' | 'aiagent';
  realName: string;
  email?: string;
  phone?: string;
  address?: string;
  provider?: 'local' | 'duo' | 'google';
  npi_number?: string;
  assigned_ward?: string;
  clearance_level?: number;
  internal_notes?: string;
  ssn?: string;
  insurance_id?: string;
  clinical_notes?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  nurseId: string;
  date: string;
  time: string;
  reason: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
}

export interface BillingRecord {
  id: string;
  patientId: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'pending';
  doctorId?: string;
  doctorName?: string;
  nurseId?: string;
  nurseName?: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  status: 'pending' | 'administered' | 'skipped';
  administeredAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  activity: string;
  status: 'Success' | 'Failure' | 'Warning' | 'Info';
  details: string;
  nodeRole?: string;
  ip?: string;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  product: 'Duo' | 'Secure Access' | 'Secure Workload' | 'AI Defense';
  message: string;
  severity: 'low' | 'medium' | 'high';
}
