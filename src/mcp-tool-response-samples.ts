/**
 * Expected MCP tool return payloads (what runMcpTool / dbserver APIs return to the LLM).
 * Used by Documentation.tsx for troubleshooting — especially AI Defense Gateway scans on tool JSON.
 */
export type McpToolResponseSample = {
  /** Representative JSON returned to the model after a successful tool call */
  sample: unknown;
  /** Optional note about PHI/PII in the response (shown in docs UI) */
  phiNote?: string;
};

export const MCP_TOOL_RESPONSE_SAMPLES: Record<string, McpToolResponseSample> = {
  get_my_profile: {
    sample: {
      id: "patient1",
      realName: "Sarah Connor",
      role: "patient",
      email: "sarah.connor@example.com",
      phone: "555-0101",
    },
    phiNote: "Returns authenticated user profile fields (may include SSN/insurance when present).",
  },
  get_my_clinical_summary: {
    sample: {
      id: "patient1",
      name: "Sarah Connor",
      dob: "1985-03-12",
      status: "active",
      condition: "Hypertension",
      assignedDoctorId: "doctor1",
      assignedNurseId: "nurse1",
    },
    phiNote: "Patient-scoped clinical summary including PHI.",
  },
  get_my_medications: {
    sample: [
      { id: "med_patient1_0", patientId: "patient1", name: "Lisinopril", dosage: "10mg", frequency: "daily", status: "active" },
    ],
  },
  get_my_appointments: {
    sample: [
      { id: "apt101", patientId: "patient1", date: "2026-07-15", time: "2:30 PM", reason: "Follow-up", status: "confirmed" },
    ],
  },
  get_my_lab_results: {
    sample: [
      { id: "lab_patient1_0", patientId: "patient1", test: "CBC", result: "Within normal limits", date: "2026-06-01" },
    ],
    phiNote: "Clinical lab results for the authenticated patient.",
  },
  get_my_billing: {
    sample: [
      { id: "bill_patient1_0", patientId: "patient1", amount: 250, status: "pending", doctorName: "Dr. House", nurseName: "Nurse Ratched" },
    ],
  },
  get_my_messages: {
    sample: [
      { id: "msg1001", senderId: "nurse1", receiverId: "patient1", content: "Vitals look stable this shift.", timestamp: "2026-07-20T14:00:00Z" },
    ],
  },
  create_appointment: {
    sample: {
      id: "apt124",
      patientId: "patient3",
      date: "2026-07-15",
      time: "2:30 PM",
      reason: "Post-op review",
      status: "pending",
    },
  },
  update_appointment: {
    sample: { success: true, appointment: { id: "apt124", status: "confirmed", reason: "Follow-up check" } },
  },
  cancel_appointment: {
    sample: { success: true, message: "Appointment cancelled" },
  },
  reschedule_appointment: {
    sample: { success: true, appointment: { id: "apt124", date: "2026-07-20", time: "10:30 AM" } },
  },
  cancel_appointments_by_date: {
    sample: { success: true, cancelled: 3, date: "2026-08-08" },
  },
  reschedule_appointments_by_date: {
    sample: { success: true, moved: 2, sourceDate: "2026-08-09", targetDate: "2026-08-17" },
  },
  send_message: {
    sample: {
      id: "msg2001",
      senderId: "nurse4",
      receiverId: "patient31",
      content: "Hello, can you cover for me on August 5?",
      timestamp: "2026-07-24T16:00:00Z",
    },
  },
  broadcast_message: {
    sample: { success: true, sent: 12, receiverRole: "patient" },
  },
  delete_messages: {
    sample: { success: true, deleted: 4 },
  },
  pay_bill: {
    sample: { success: true, billing: { id: "bill_patient3_0", status: "paid" } },
  },
  update_my_profile: {
    sample: { success: true, user: { id: "nurse4", phone: "559-297-4110" } },
  },
  change_my_password: {
    sample: { success: true, message: "Password updated successfully" },
  },
  get_my_assigned_patients: {
    sample: {
      count: 5,
      clinicianId: "nurse3",
      role: "nurse",
      patients: [
        { id: "patient10", name: "Steve Rogers", status: "active", assignedNurseId: "nurse3", assignedDoctorId: "doctor1" },
        { id: "patient20", name: "Carol Danvers", status: "active", assignedNurseId: "nurse3", assignedDoctorId: "doctor1" },
        { id: "patient30", name: "Logan Howlett", status: "active", assignedNurseId: "nurse3", assignedDoctorId: "doctor1" },
        { id: "patient40", name: "Peter Quill", status: "active", assignedNurseId: "nurse3", assignedDoctorId: "doctor1" },
        { id: "patient50", name: "Daisy Johnson", status: "active", assignedNurseId: "nurse3", assignedDoctorId: "doctor1" },
      ],
    },
    phiNote: "Summary list only (no SSN/insurance). Server-filtered — reliable for 'my patients' queries.",
  },
  get_ward_roster: {
    sample: [
      {
        id: "patient5",
        name: "Bruce Wayne",
        status: "active",
        assignedDoctorId: "doctor1",
        assignedNurseId: "nurse4",
        isTriage: false,
        isActive: true,
        statusLabel: "active",
      },
    ],
    phiNote: "Full ward roster with patient names and care-team IDs — high PHI exposure on Gateway scans.",
  },
  get_patient_vitals: {
    sample: { hr: "72", temp: "98.4", bp: "118/75", lastUpdated: "2026-07-24" },
    phiNote: "Returns vitals object only when present; otherwise may fall back to full patient record.",
  },
  record_vitals: {
    sample: {
      success: true,
      patientId: "patient2",
      vitals: { hr: "72", temp: "98.4", bp: "118/75", lastUpdated: "2026-07-24" },
    },
    phiNote: "Minimal write confirmation — does NOT include full patient profile (reduces AI Defense Gateway PII blocks).",
  },
  get_medication_tasks: {
    sample: [
      { id: "med_patient5_0", patientId: "patient5", name: "Metformin", status: "pending", scheduledTime: "08:00" },
    ],
  },
  update_medication_status: {
    sample: { success: true, medication: { id: "med_patient5_0", status: "administered" } },
  },
  update_patient_status: {
    sample: { success: true, patient: { id: "patient3", status: "active" } },
    phiNote: "Includes patient object with profile fields — not vitals-only.",
  },
  get_all_appointments: {
    sample: [
      { id: "apt101", patientId: "patient5", date: "2026-07-18", time: "9:00 AM", nurseId: "nurse5", reason: "Check-up" },
    ],
  },
  get_billing_records: {
    sample: [
      { id: "bill_patient5_0", patientId: "patient5", amount: 420, status: "pending", doctorName: "Dr. House", nurseName: "Nurse Joy" },
    ],
    phiNote: "Billing rows include patientId and clinician names.",
  },
  get_assigned_patient_deep_dive: {
    sample: {
      patient: { id: "patient5", name: "Bruce Wayne", condition: "Insomnia", status: "active" },
      medications: [{ id: "med_patient5_0", name: "Melatonin", dosage: "5mg" }],
      appointments: [{ id: "apt55", date: "2026-07-18", reason: "Sleep study follow-up" }],
      labResults: [{ id: "lab_patient5_0", test: "TSH", result: "Normal" }],
    },
    phiNote: "Highest PHI exposure — full chart bundle sent back to the model.",
  },
  prescribe_medication: {
    sample: {
      id: "med_patient5_1",
      patientId: "patient5",
      name: "Atorvastatin",
      dosage: "20mg",
      frequency: "once daily",
      status: "active",
    },
  },
  discontinue_medication: {
    sample: { success: true, message: "Medication prescription discontinued" },
  },
  get_clinicians: {
    sample: {
      doctors: [{ id: "doctor1", name: "Dr. Gregory House" }],
      nurses: [{ id: "nurse1", name: "Nurse Ratched" }],
    },
  },
  query_audit_logs: {
    sample: [
      { id: "log_001", category: "clinical", action: "Vitals Recorded", user: "nurse4", timestamp: "2026-07-24T15:30:00Z" },
    ],
  },
  get_user_directory: {
    sample: [
      { id: "nurse4", realName: "Joy Smith", role: "nurse", email: "joy@example.com" },
      { id: "patient5", realName: "Bruce Wayne", role: "patient" },
    ],
    phiNote: "Directory listing — includes names and roles for all portal users.",
  },
  manage_user_persona: {
    sample: { success: true, user: { id: "nurse1", phone: "555-0199" } },
  },
  create_user: {
    sample: { success: true, user: { id: "nurse11", realName: "Jane Smith", role: "nurse" } },
  },
  delete_user: {
    sample: { success: true },
  },
  assign_patient_care_team: {
    sample: { success: true, patient: { id: "patient2", assignedDoctorId: "doctor1", assignedNurseId: "nurse1" } },
  },
  get_infrastructure_topology: {
    sample: {
      mode: "distributed",
      appserver: { role: "appserver", status: "Online" },
      dbserver: { role: "dbserver", status: "Online" },
      aibroker: { role: "aibroker", status: "Online" },
    },
  },
  emergency_system_reset: {
    sample: { success: true, message: "Database reset to initial state" },
  },
  get_system_config: {
    sample: {
      mode: "standalone",
      appserverUrl: "http://localhost:3000",
      dbserverUrl: "",
      aibrokerUrl: "",
    },
  },
  update_system_config: {
    sample: { success: true, message: "System configuration saved successfully." },
  },
};

export function getMcpToolResponseSample(toolName: string): McpToolResponseSample {
  return MCP_TOOL_RESPONSE_SAMPLES[toolName] ?? {
    sample: { error: "No documented response sample for this tool yet." },
  };
}
