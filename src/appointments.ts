import { Appointment } from './types';

const REASONS = ['Consultation', 'Follow-up', 'Annual Physical', 'Specific Issue Check', 'Post-Op Review'];
const TIMES = ['9:00 AM', '10:30 AM', '11:00 AM', '1:00 PM', '2:30 PM', '4:00 PM'];

/** Reference "today" — seed appointments are scheduled in the future from this date. */
const REFERENCE_DATE = new Date('2026-06-16T12:00:00Z');

/** Deterministic care-team assignment aligned with patient seed indexing (1-based). */
export function careTeamForPatientIndex(patientNum: number): { doctorId: string; nurseId: string } {
  return {
    doctorId: `doctor${((patientNum - 1) % 10) + 1}`,
    nurseId: `nurse${(((patientNum + 2) % 10) + 1)}`,
  };
}

function futureDate(daysFromRef: number): string {
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() + daysFromRef);
  return d.toISOString().split('T')[0];
}

/** Build seed appointments for all 50 patients (3–5 future each, deterministic). */
export function buildInitialAppointments(): Appointment[] {
  const appointments: Appointment[] = [];
  for (let i = 1; i <= 50; i++) {
    const patientId = `patient${i}`;
    const { doctorId, nurseId } = careTeamForPatientIndex(i);
    const count = 3 + (i % 3);
    for (let j = 0; j < count; j++) {
      const daysOut = 7 + j * 14 + (i % 10);
      appointments.push({
        id: `apt_${patientId}_${j}`,
        patientId,
        doctorId,
        nurseId,
        date: futureDate(daysOut),
        time: TIMES[(i + j) % TIMES.length],
        reason: REASONS[(i + j) % REASONS.length],
        status: j === 0 ? 'confirmed' : (i % 5 === 0 ? 'pending' : 'confirmed'),
      });
    }
  }
  // Demo patient (id: patient) — assigned to demo doctor/nurse accounts
  const demoTeam = { doctorId: 'doctor', nurseId: 'nurse' };
  for (let j = 0; j < 4; j++) {
    const daysOut = 7 + j * 14;
    appointments.push({
      id: `apt_patient_${j}`,
      patientId: 'patient',
      doctorId: demoTeam.doctorId,
      nurseId: demoTeam.nurseId,
      date: futureDate(daysOut),
      time: TIMES[j % TIMES.length],
      reason: REASONS[j % REASONS.length],
      status: j === 0 ? 'confirmed' : 'pending',
    });
  }
  return appointments;
}

export const INITIAL_APPOINTMENTS = buildInitialAppointments();
