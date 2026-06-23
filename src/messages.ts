import { ChatMessage } from './types';

/** Reference "today" for seed data — all message timestamps fall within the prior 90 days. */
const REFERENCE_DATE = new Date('2026-06-16T12:00:00Z');

type MsgSeed = Omit<ChatMessage, 'id' | 'timestamp'> & { daysAgo?: number };

function msg(id: string, seed: MsgSeed, daysAgo = 7): ChatMessage {
  const offset = seed.daysAgo ?? daysAgo;
  const clamped = Math.min(Math.max(offset, 1), 89);
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() - clamped);
  d.setUTCHours(9 + (clamped % 8), 15, 0, 0);
  return {
    id,
    senderId: seed.senderId,
    receiverId: seed.receiverId,
    content: seed.content,
    timestamp: d.toISOString(),
  };
}

/** Curated cross-role message threads for demo (no patient-to-patient). */
const MESSAGE_SEEDS: MsgSeed[] = [
  { senderId: 'doctor1', receiverId: 'patient1', content: 'Sarah, your latest blood pressure readings look improved. Keep taking Amlodipine as prescribed.', daysAgo: 3 },
  { senderId: 'patient1', receiverId: 'doctor1', content: 'Thank you Dr. House. I have been monitoring at home and feel much better.', daysAgo: 2 },
  { senderId: 'doctor2', receiverId: 'patient2', content: 'John, please schedule a follow-up to review your HbA1c results next week.', daysAgo: 14 },
  { senderId: 'patient2', receiverId: 'doctor2', content: 'Will do. Are there any dietary changes I should make before the visit?', daysAgo: 13 },
  { senderId: 'doctor3', receiverId: 'patient4', content: 'Emma, your allergy panel came back negative for seasonal triggers. Continue Claritin as needed.', daysAgo: 21 },
  { senderId: 'patient4', receiverId: 'doctor3', content: 'That is a relief. Should I still avoid the spring pollen exposure we discussed?', daysAgo: 20 },
  { senderId: 'nurse1', receiverId: 'patient1', content: 'Good morning Sarah — vitals look stable this shift. Any dizziness since starting the new dosage?', daysAgo: 5 },
  { senderId: 'patient1', receiverId: 'nurse1', content: 'No dizziness. Sleep has been better this week.', daysAgo: 4 },
  { senderId: 'nurse2', receiverId: 'patient2', content: "Reminder: take Metformin with meals. I logged today's administration in your chart.", daysAgo: 8 },
  { senderId: 'patient3', receiverId: 'nurse1', content: 'Robert here — shoulder mobility is improving. Can I reduce the ibuprofen frequency?', daysAgo: 11 },
  { senderId: 'nurse1', receiverId: 'patient3', content: 'Please check with Dr. House before changing dose. I will flag this for your next appointment.', daysAgo: 10 },
  { senderId: 'nurse5', receiverId: 'patient10', content: 'Steve, pre-visit labs are ready. Please arrive 15 minutes early for vitals.', daysAgo: 18 },
  { senderId: 'nurse1', receiverId: 'doctor1', content: 'Patient patient3 reporting increased pain overnight — vitals stable but requesting physician review.', daysAgo: 9 },
  { senderId: 'doctor1', receiverId: 'nurse1', content: 'Acknowledged. Please order stat X-ray and notify me when results post.', daysAgo: 9 },
  { senderId: 'nurse2', receiverId: 'doctor2', content: 'Ward B medication cart restocked. Insulin Glargine count is low — pharmacy notified.', daysAgo: 16 },
  { senderId: 'doctor2', receiverId: 'nurse2', content: 'Thanks Abby. Prioritize patient2 for the next insulin delivery.', daysAgo: 15 },
  { senderId: 'nurse5', receiverId: 'doctor9', content: 'Patient patient10 completed cardiac rehab session without complications.', daysAgo: 22 },
  { senderId: 'nurse1', receiverId: 'nurse2', content: 'Can you cover my 14:00 vitals round on Wing B? I have a training session.', daysAgo: 6 },
  { senderId: 'nurse2', receiverId: 'nurse1', content: 'Confirmed — I will handle Wing B at 14:00.', daysAgo: 6 },
  { senderId: 'nurse3', receiverId: 'nurse5', content: 'Shift handoff: patient9 due for evening medication at 18:00.', daysAgo: 12 },
  { senderId: 'admin1', receiverId: 'doctor1', content: 'Eddie Architect: Duo SSO maintenance window scheduled tonight 22:00–23:00 UTC. No clinical impact expected.', daysAgo: 30 },
  { senderId: 'doctor1', receiverId: 'admin1', content: 'Acknowledged. I will avoid after-hours chart updates during that window.', daysAgo: 29 },
  { senderId: 'admin2', receiverId: 'nurse1', content: 'Sarah Systems: Please confirm all staff completed the annual HIPAA refresher module.', daysAgo: 45 },
  { senderId: 'nurse1', receiverId: 'admin2', content: 'Ward B nursing staff are 100% compliant as of this morning.', daysAgo: 44 },
  { senderId: 'admin1', receiverId: 'patient1', content: 'Your portal account was successfully linked via Cisco Duo SSO. Contact support if you notice any access issues.', daysAgo: 60 },
  { senderId: 'patient1', receiverId: 'admin1', content: 'Login worked perfectly from my phone. Thank you.', daysAgo: 59 },
  { senderId: 'admin3', receiverId: 'doctor5', content: 'David Duval: Secure Workload policy update applied to dbserver node — no action required from clinical staff.', daysAgo: 35 },
  { senderId: 'doctor4', receiverId: 'patient5', content: 'Bruce, annual wellness labs are normal. Continue current vitamin regimen.', daysAgo: 25 },
  { senderId: 'patient5', receiverId: 'doctor4', content: 'Great news. Any restrictions before my next physical?', daysAgo: 24 },
  { senderId: 'nurse4', receiverId: 'patient8', content: 'Peter, please remember to log daily symptom diary in the patient portal this week.', daysAgo: 17 },
  { senderId: 'patient8', receiverId: 'nurse4', content: 'Will do — already started yesterday.', daysAgo: 16 },
  { senderId: 'doctor7', receiverId: 'patient15', content: 'Sam, physical therapy referral has been submitted to orthopedics.', daysAgo: 28 },
  { senderId: 'patient15', receiverId: 'doctor7', content: 'Received the notification. When should I expect the first PT appointment?', daysAgo: 27 },
];

function buildPatientThreadMessages(): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (let i = 1; i <= 50; i++) {
    const patientId = `patient${i}`;
    const doctorId = `doctor${((i - 1) % 10) + 1}`;
    const nurseId = `nurse${(((i + 2) % 10) + 1)}`;
    const baseDays = 10 + (i % 70);
    out.push(msg(`msg_thread_${patientId}_0`, {
      senderId: doctorId,
      receiverId: patientId,
      content: 'Your latest lab results look stable. See you at your next appointment.',
      daysAgo: baseDays,
    }));
    out.push(msg(`msg_thread_${patientId}_1`, {
      senderId: patientId,
      receiverId: nurseId,
      content: 'Thank you — I had a question about my medication schedule for this week.',
      daysAgo: baseDays - 1,
    }));
    out.push(msg(`msg_thread_${patientId}_2`, {
      senderId: nurseId,
      receiverId: patientId,
      content: 'Happy to help. Your MAR shows all doses on track. Message me if anything changes.',
      daysAgo: baseDays - 2,
    }));
  }
  return out;
}

export function buildInitialMessages(): ChatMessage[] {
  const curated = MESSAGE_SEEDS.map((seed, idx) => msg(`msg_curated_${idx}`, seed));
  return [...curated, ...buildPatientThreadMessages()];
}

export const INITIAL_MESSAGES = buildInitialMessages();
