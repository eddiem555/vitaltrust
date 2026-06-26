import { careTeamForPatientIndex } from './appointments';
import { BillingRecord } from './types';

const BILL_DESC = [
  'Consultation Fee',
  'Lab Processing',
  'Administrative Fee',
  'Pharmacy Component',
  'Imaging Services',
  'Procedure Fee',
  'Follow-up Visit',
  'Emergency Room Visit',
];
const BILL_STATUS: BillingRecord['status'][] = ['paid', 'unpaid', 'pending'];

const DOCTOR_NAMES: Record<string, string> = {
  doctor1: 'Dr. Gregory House',
  doctor2: 'Dr. Stephen Strange',
  doctor3: 'Dr. Meredith Grey',
  doctor4: 'Dr. Leonard McCoy',
  doctor5: 'Dr. Beverly Crusher',
  doctor6: 'Dr. Doogie Howser',
  doctor7: 'Dr. James Wilson',
  doctor8: 'Dr. Hannibal Lecter',
  doctor9: 'Dr. John Watson',
  doctor10: 'Dr. Ken Jeong',
  doctor: 'Dr. Doctor Demo',
};

const NURSE_NAMES: Record<string, string> = {
  nurse1: 'Nurse Ratched',
  nurse2: 'Nurse Abby Lockhart',
  nurse3: 'Nurse Jackie Peyton',
  nurse4: 'Nurse Joy',
  nurse5: 'Nurse Carol Hathaway',
  nurse6: 'Nurse Christine Chapel',
  nurse7: 'Nurse Carla Espinosa',
  nurse8: 'Nurse Trixie Franklin',
  nurse9: 'Nurse Julia Ogden',
  nurse10: 'Nurse Margaret Houlihan',
  nurse: 'Nurse Demo',
};

/** Reference date for seed data (matches VERSION_DATE). */
const SEED_TODAY = new Date('2026-06-16T12:00:00Z');

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function clinicianForBill(patientNum: number, billIndex: number, primaryDoctorId: string, primaryNurseId: string) {
  if (billIndex === 0) {
    return { doctorId: primaryDoctorId, nurseId: primaryNurseId };
  }
  const docIdx = ((patientNum + billIndex) % 10) + 1;
  const nurseIdx = ((patientNum + billIndex * 2) % 10) + 1;
  return { doctorId: `doctor${docIdx}`, nurseId: `nurse${nurseIdx}` };
}

export function buildInitialBilling(): BillingRecord[] {
  const bills: BillingRecord[] = [];

  for (let i = 1; i <= 50; i++) {
    const count = 3 + (i % 8); // 3–10 bills per patient
    const { doctorId: primaryDoctorId, nurseId: primaryNurseId } = careTeamForPatientIndex(i);

    for (let j = 0; j < count; j++) {
      const daysBack = 14 + j * 110 + (i * 17) % 365;
      const billDate = new Date(SEED_TODAY);
      billDate.setUTCDate(billDate.getUTCDate() - Math.min(daysBack, 365 * 3));

      const { doctorId, nurseId } = clinicianForBill(i, j, primaryDoctorId, primaryNurseId);

      bills.push({
        id: `bill_patient${i}_${j}`,
        patientId: `patient${i}`,
        date: formatDate(billDate),
        description: BILL_DESC[(i + j) % BILL_DESC.length],
        amount: 50 + ((i * 17 + j * 23) % 450),
        status: BILL_STATUS[(i + j) % BILL_STATUS.length],
        doctorId,
        doctorName: DOCTOR_NAMES[doctorId] || doctorId,
        nurseId,
        nurseName: NURSE_NAMES[nurseId] || nurseId,
      });
    }
  }

  for (let j = 0; j < 4; j++) {
    const daysBack = 30 + j * 90;
    const billDate = new Date(SEED_TODAY);
    billDate.setUTCDate(billDate.getUTCDate() - daysBack);
    bills.push({
      id: `bill_patient_demo_${j}`,
      patientId: 'patient',
      date: formatDate(billDate),
      description: BILL_DESC[j % BILL_DESC.length],
      amount: 75 + j * 40,
      status: BILL_STATUS[j % BILL_STATUS.length],
      doctorId: 'doctor',
      doctorName: DOCTOR_NAMES.doctor,
      nurseId: 'nurse',
      nurseName: NURSE_NAMES.nurse,
    });
  }

  return bills.sort((a, b) => b.date.localeCompare(a.date));
}

export const INITIAL_BILLING = buildInitialBilling();
