import { Appointment } from './types';

const REASONS = [
  'Consultation',
  'Follow-up',
  'Annual Physical',
  'Specific Issue Check',
  'Post-Op Review',
  'Lab Review',
  'Medication Check',
];
const TIMES = ['9:00 AM', '10:30 AM', '11:00 AM', '1:00 PM', '2:30 PM', '4:00 PM'];

/** Reference "today" for seed scheduling — keep aligned with VERSION_DATE on release bumps. */
export const SEED_REFERENCE_DATE = new Date('2026-08-08T12:00:00Z');
const THREE_MONTH_DAYS = 90;
const MAX_SCHEDULE_DATE = new Date('2027-07-31T12:00:00Z');
const MIN_CLINICIAN_APPOINTMENTS = 10;
const MAX_CLINICIAN_APPOINTMENTS_IN_WINDOW = 20;

const DOCTOR_IDS = ['doctor', ...Array.from({ length: 10 }, (_, i) => `doctor${i + 1}`)];
const NURSE_IDS = ['nurse', ...Array.from({ length: 10 }, (_, i) => `nurse${i + 1}`)];

/** Deterministic care-team assignment aligned with patient seed indexing (1-based). */
export function careTeamForPatientIndex(patientNum: number): { doctorId: string; nurseId: string } {
  return {
    doctorId: `doctor${((patientNum - 1) % 10) + 1}`,
    nurseId: `nurse${(((patientNum + 2) % 10) + 1)}`,
  };
}

function maxDaysFromRef(): number {
  return Math.floor((MAX_SCHEDULE_DATE.getTime() - SEED_REFERENCE_DATE.getTime()) / 86400000);
}

function dateFromDaysOut(daysOut: number): string {
  const d = new Date(SEED_REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() + daysOut);
  return d.toISOString().split('T')[0];
}

function isWithinThreeMonths(daysOut: number): boolean {
  return daysOut >= 1 && daysOut <= THREE_MONTH_DAYS;
}

function pickTime(seed: number): string {
  return TIMES[Math.abs(seed) % TIMES.length];
}

function pickReason(seed: number): string {
  return REASONS[Math.abs(seed) % REASONS.length];
}

function pickStatus(seed: number): Appointment['status'] {
  const statuses: Appointment['status'][] = ['confirmed', 'pending', 'confirmed', 'confirmed'];
  return statuses[Math.abs(seed) % statuses.length];
}

function lowestCountClinician(ids: string[], counts: Record<string, number>, maxInWindow: number): string {
  let chosen = ids[0];
  let min = Number.POSITIVE_INFINITY;
  for (const id of ids) {
    if (counts[id] < min && counts[id] < maxInWindow) {
      min = counts[id];
      chosen = id;
    }
  }
  return chosen;
}

/** Pick a day offset — prefer `preferred` in the 3-month window, else later up to MAX_SCHEDULE_DATE. */
function allocateDaysOut(
  preferred: number,
  doctorId: string,
  nurseId: string,
  doctorWindow: Record<string, number>,
  nurseWindow: Record<string, number>,
  maxDays: number,
): number {
  const fitsWindow = (daysOut: number) => {
    if (!isWithinThreeMonths(daysOut)) return true;
    return (
      doctorWindow[doctorId] < MAX_CLINICIAN_APPOINTMENTS_IN_WINDOW &&
      nurseWindow[nurseId] < MAX_CLINICIAN_APPOINTMENTS_IN_WINDOW
    );
  };

  const clampedPreferred = Math.min(Math.max(preferred, 1), maxDays);
  if (fitsWindow(clampedPreferred)) return clampedPreferred;

  for (let daysOut = 1; daysOut <= THREE_MONTH_DAYS; daysOut++) {
    if (fitsWindow(daysOut)) return daysOut;
  }
  for (let daysOut = THREE_MONTH_DAYS + 1; daysOut <= maxDays; daysOut++) {
    return daysOut;
  }
  return clampedPreferred;
}

/** Build seed appointments — future dates through 2027-07-31; clinicians hold 10–20 slots in the next 90 days. */
export function buildInitialAppointments(): Appointment[] {
  const appointments: Appointment[] = [];
  let idSeq = 0;
  const nextId = (patientId: string) => `apt_${patientId}_${idSeq++}`;

  const doctorWindow: Record<string, number> = Object.fromEntries(DOCTOR_IDS.map((id) => [id, 0]));
  const nurseWindow: Record<string, number> = Object.fromEntries(NURSE_IDS.map((id) => [id, 0]));
  const maxDays = maxDaysFromRef();

  const recordWindow = (doctorId: string, nurseId: string, daysOut: number) => {
    if (!isWithinThreeMonths(daysOut)) return;
    doctorWindow[doctorId]++;
    nurseWindow[nurseId]++;
  };

  const addAppointment = (
    patientId: string,
    doctorId: string,
    nurseId: string,
    daysOut: number,
    seed: number,
  ) => {
    appointments.push({
      id: nextId(patientId),
      patientId,
      doctorId,
      nurseId,
      date: dateFromDaysOut(daysOut),
      time: pickTime(seed),
      reason: pickReason(seed),
      status: pickStatus(seed),
    });
    recordWindow(doctorId, nurseId, daysOut);
  };

  // Phase 1 — each doctor at least MIN in the 3-month window
  for (let di = 0; di < DOCTOR_IDS.length; di++) {
    const doctorId = DOCTOR_IDS[di];
    let slot = 0;
    while (doctorWindow[doctorId] < MIN_CLINICIAN_APPOINTMENTS && slot < 40) {
      const patientNum = ((di * 4 + slot) % 50) + 1;
      const nurseId = lowestCountClinician(NURSE_IDS, nurseWindow, MAX_CLINICIAN_APPOINTMENTS_IN_WINDOW);
      const daysOut = allocateDaysOut(
        2 + ((di * 9 + slot * 6) % THREE_MONTH_DAYS),
        doctorId,
        nurseId,
        doctorWindow,
        nurseWindow,
        maxDays,
      );
      addAppointment(`patient${patientNum}`, doctorId, nurseId, daysOut, di * 100 + slot);
      slot++;
    }
  }

  // Phase 2 — each nurse at least MIN in the 3-month window
  for (let ni = 0; ni < NURSE_IDS.length; ni++) {
    const nurseId = NURSE_IDS[ni];
    let slot = 0;
    while (nurseWindow[nurseId] < MIN_CLINICIAN_APPOINTMENTS && slot < 40) {
      const patientNum = ((ni * 5 + slot * 3) % 50) + 1;
      const doctorId = lowestCountClinician(DOCTOR_IDS, doctorWindow, MAX_CLINICIAN_APPOINTMENTS_IN_WINDOW);
      const daysOut = allocateDaysOut(
        3 + ((ni * 11 + slot * 8) % THREE_MONTH_DAYS),
        doctorId,
        nurseId,
        doctorWindow,
        nurseWindow,
        maxDays,
      );
      addAppointment(`patient${patientNum}`, doctorId, nurseId, daysOut, ni * 100 + slot + 500);
      slot++;
    }
  }

  // Phase 3 — per-patient future appointments through MAX_SCHEDULE_DATE
  for (let i = 1; i <= 50; i++) {
    const patientId = `patient${i}`;
    const { doctorId, nurseId } = careTeamForPatientIndex(i);
    const count = 2 + (i % 4);
    for (let j = 0; j < count; j++) {
      const spread = Math.floor((j + 1) * (maxDays / (count + 1)));
      const daysOut = allocateDaysOut(
        spread + (i % 11),
        doctorId,
        nurseId,
        doctorWindow,
        nurseWindow,
        maxDays,
      );
      addAppointment(patientId, doctorId, nurseId, daysOut, i * 10 + j);
    }
  }

  // Demo patient (id: patient)
  const demoTeam = { doctorId: 'doctor', nurseId: 'nurse' };
  for (let j = 0; j < 4; j++) {
    const daysOut = allocateDaysOut(
      7 + j * 21,
      demoTeam.doctorId,
      demoTeam.nurseId,
      doctorWindow,
      nurseWindow,
      maxDays,
    );
    addAppointment('patient', demoTeam.doctorId, demoTeam.nurseId, daysOut, 900 + j);
  }

  return appointments.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export const INITIAL_APPOINTMENTS = buildInitialAppointments();
