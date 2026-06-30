/**
 * MCP tool JSON schemas — shared by /api/ai/chat and the /mcp Streamable HTTP endpoint.
 */
export type McpToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type McpToolsSpecMap = Record<string, McpToolSpec>;

export const MCP_TOOLS_SPEC: McpToolsSpecMap = {
  get_my_profile: {
    name: "get_my_profile",
    description: "Get the profile details of the current logged-in patient.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_my_clinical_summary: {
    name: "get_my_clinical_summary",
    description: "Retrieve active condition, DOB, clinical status and doctor-assigned logs of the current logged-in patient.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_my_medications: {
    name: "get_my_medications",
    description: "Get a detailed list of active prescriptions and medication administration records for the current patient.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_my_appointments: {
    name: "get_my_appointments",
    description: "List all scheduled appointments and physician meetings for the current patient.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  manage_my_appointment: {
    name: "manage_my_appointment",
    description: "Reschedule or cancel an existing appointment, or secure a new appointment slot.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", description: "The scheduling operation to perform: 'create', 'update', or 'cancel'." },
        appointmentId: { type: "string", description: "The ID of the appointment to modify or cancel (leave empty if creating a new one)." },
        date: { type: "string", description: "The desired date for the appointment in YYYY-MM-DD format." },
        time: { type: "string", description: "The desired time for the appointment in HH:MM format." },
        reason: { type: "string", description: "The medical concern or reason for clinical visit." }
      },
      required: ["action"]
    }
  },
  get_my_lab_results: {
    name: "get_my_lab_results",
    description: "Fetch comprehensive checking laboratory parameters and diagnostic outcomes for the current patient.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_my_billing: {
    name: "get_my_billing",
    description: "Get financial billing records and unpaid invoices for the current patient.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_my_messages: {
    name: "get_my_messages",
    description: "Get list of message history and conversations of the patient.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_ward_roster: {
    name: "get_ward_roster",
    description: "Get the clinical roster of all active, inactive, discharged, triage, or general patients registered in the clinic or ward.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_patient_vitals: {
    name: "get_patient_vitals",
    description: "Retrieve logged clinical vitals for a specific patient by ID.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The ID of the target patient." }
      },
      required: ["patientId"]
    }
  },
  record_vitals: {
    name: "record_vitals",
    description: "Overwrites or adds standard vitals (Heart rate, Blood Pressure, Temperature) for a specific patient.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The ID of the patient." },
        hr: { type: "string", description: "Target heart rate in beats per minute (e.g. '78')." },
        temp: { type: "string", description: "Body Temperature in degrees Fahrenheit (e.g. '98.6')." },
        bp: { type: "string", description: "Arterial pressure in BP format (e.g. '120/80')." }
      },
      required: ["patientId", "hr", "temp", "bp"]
    }
  },
  get_medication_tasks: {
    name: "get_medication_tasks",
    description: "Check pending bedside medication administration list and checklist schedules on the nursing ward.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  update_medication_status: {
    name: "update_medication_status",
    description: "Mark a clinical medication item status as completed/administered or pending.",
    parameters: {
      type: "object",
      properties: {
        medId: { type: "string", description: "The target medication schedule task ID." },
        status: { type: "string", description: "Desired status: 'administered' or 'pending'." }
      },
      required: ["medId", "status"]
    }
  },
  update_medication_details: {
    name: "update_medication_details",
    description: "Update details of an active medication prescription (dosage, drug name, frequency) for an active patient.",
    parameters: {
      type: "object",
      properties: {
        medId: { type: "string", description: "The ID of the medication record to modify." },
        name: { type: "string", description: "Updated drug or prescription brand name." },
        dosage: { type: "string", description: "Updated dosage strength." },
        frequency: { type: "string", description: "Updated intake frequency/schedule." },
        status: { type: "string", description: "Updated administration status ('pending' or 'administered')." }
      },
      required: ["medId"]
    }
  },
  get_assigned_patient_deep_dive: {
    name: "get_assigned_patient_deep_dive",
    description: "Retrieve comprehensive historical health records of a single patient (condition, SSN, Insurance, notes, clinical vitals). Only accessible by doctors or admins.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The ID of the patient." }
      },
      required: ["patientId"]
    }
  },
  search_clinical_knowledge: {
    name: "search_clinical_knowledge",
    description: "Clinical research RAG search hook for physical diagnosis guidelines, medications or clinical literature.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query containing clinical terms or symptoms." }
      },
      required: ["query"]
    }
  },
  prescribe_medication: {
    name: "prescribe_medication",
    description: "Dose and prescribe a new medication regimen for an active patient.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The index ID of the target patient." },
        name: { type: "string", description: "Generic drug or prescription brand names (e.g. 'Lisinopril')." },
        dosage: { type: "string", description: "Quantity/dosage strength (e.g., '10mg')." },
        frequency: { type: "string", description: "Intake scheduling interval (e.g., 'once daily')." }
      },
      required: ["patientId", "name", "dosage", "frequency"]
    }
  },
  update_diagnostic_notes: {
    name: "update_diagnostic_notes",
    description: "Appends or updates diagnostic clinical observations to a patient's primary record.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The ID of the target patient." },
        notes: { type: "string", description: "Detailed medical evaluation text to record." }
      },
      required: ["patientId", "notes"]
    }
  },
  query_audit_logs: {
    name: "query_audit_logs",
    description: "Admin search to query security audit entries, SSO multi-cloud logs, access controls, or policy logs.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_user_directory: {
    name: "get_user_directory",
    description: "Gets the central directory of registered active portal users and Identity mappings.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  manage_user_persona: {
    name: "manage_user_persona",
    description: "Edit user credentials, passwords, profiles, clearance levels and internal security configurations.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The target ID of the user." },
        clearanceLevel: { type: "number", description: "The numerical classification security clearance level (1 to 3)." },
        role: { type: "string", description: "System security role boundary (e.g. 'admin', 'doctor', 'nurse', 'patient')." },
        internal_notes: { type: "string", description: "Administrative evaluation records." },
        realName: { type: "string", description: "Full legal name." },
        email: { type: "string", description: "Contact email address." },
        phone: { type: "string", description: "Contact phone number." },
        address: { type: "string", description: "Residential/practice address." },
        ssn: { type: "string", description: "Social Security Number." },
        insurance_id: { type: "string", description: "Insurance Group ID." },
        npi_number: { type: "string", description: "National Provider Identifier (NPI)." },
        assigned_ward: { type: "string", description: "Designated ward or station for nursing staff." },
        clinical_notes: { type: "string", description: "Clinical/medical history notes." }
      },
      required: ["userId"]
    }
  },
  get_infrastructure_topology: {
    name: "get_infrastructure_topology",
    description: "Retrieve enterprise infrastructure topology layout details (appserver, dbserver, aibroker, multi-cloud boundaries).",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  emergency_system_reset: {
    name: "emergency_system_reset",
    description: "Trigger comprehensive diagnostic emergency baseline reset of the EHR system database back to initial defaults.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  get_all_appointments: {
    name: "get_all_appointments",
    description: "Retrieve scheduled clinical appointments. Doctors default to their own queue. Nurses receive the full schedule (pass nurseId to filter to their assigned queue). Administrators receive all appointments enriched with patient care-team assignments. Optionally filter by patientId, doctorId, or nurseId.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "Optional patient ID to filter by." },
        doctorId: { type: "string", description: "Optional doctor ID to filter by." },
        nurseId: { type: "string", description: "Optional nurse ID to filter by (defaults to logged-in nurse when asking for 'my appointments')." }
      },
      required: []
    }
  },
  get_clinicians: {
    name: "get_clinicians",
    description: "Retrieve the directory of registered doctors and nurses (id and display name).",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  cancel_appointment: {
    name: "cancel_appointment",
    description: "Delete or cancel one scheduled appointment by ID. Patients may cancel their own visits; doctors and nurses may cancel appointments they are assigned to; administrators may cancel any appointment. For multiple appointments on a date, prefer cancel_appointments_by_date.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "The ID of the appointment to cancel." }
      },
      required: ["appointmentId"]
    }
  },
  reschedule_appointment: {
    name: "reschedule_appointment",
    description: "Reschedule one appointment by ID to a new date and time. Same authorization rules as cancel_appointment. For multiple appointments on a date, prefer reschedule_appointments_by_date.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "The ID of the appointment to reschedule." },
        date: { type: "string", description: "The desired date in YYYY-MM-DD format." },
        time: { type: "string", description: "The desired time in HH:MM format." }
      },
      required: ["appointmentId", "date", "time"]
    }
  },
  cancel_appointments_by_date: {
    name: "cancel_appointments_by_date",
    description: "Cancel ALL appointments on a given date that the logged-in user is authorized to modify (matches Appointments panel bulk delete). Use for requests like 'cancel all my appointments on August 8'. Date accepts YYYY-MM-DD or natural language (e.g. August 9).",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "The calendar date to cancel appointments on (YYYY-MM-DD or natural language)." }
      },
      required: ["date"]
    }
  },
  reschedule_appointments_by_date: {
    name: "reschedule_appointments_by_date",
    description: "Move ALL appointments from one date to another, preserving each appointment's time. Use for requests like 'move all appointments from August 9 to August 17'. Same authorization rules as cancel_appointment.",
    parameters: {
      type: "object",
      properties: {
        sourceDate: { type: "string", description: "Current date of appointments to move (YYYY-MM-DD or natural language)." },
        targetDate: { type: "string", description: "New date for those appointments (YYYY-MM-DD or natural language)." }
      },
      required: ["sourceDate", "targetDate"]
    }
  },
  update_appointment: {
    name: "update_appointment",
    description: "Update an appointment's date, time, reason, status, doctor, or nurse. Same authorization rules as cancel_appointment.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "The ID of the appointment to update." },
        date: { type: "string", description: "New date in YYYY-MM-DD format." },
        time: { type: "string", description: "New time (e.g. 2:30 PM)." },
        reason: { type: "string", description: "Visit reason or description." },
        status: { type: "string", description: "Appointment status: confirmed, pending, completed, or cancelled." },
        doctorId: { type: "string", description: "Assigned doctor user ID." },
        nurseId: { type: "string", description: "Assigned nurse user ID." }
      },
      required: ["appointmentId"]
    }
  },
  create_appointment: {
    name: "create_appointment",
    description: "Schedule a new clinical appointment.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The ID of the target patient (required for doctors/nurses/admins; patients default to themselves). The logged-in doctor or nurse is auto-assigned when omitted." },
        date: { type: "string", description: "The desired date in YYYY-MM-DD format." },
        time: { type: "string", description: "The desired time in HH:MM format." },
        reason: { type: "string", description: "Reason for the patient visit." }
      },
      required: ["date", "time", "reason"]
    }
  },
  send_message: {
    name: "send_message",
    description: "Send a secure message to another portal user. Provide receiverId (e.g. patient31, doctor1) or receiverName (e.g. Charles Xavier). Display names and slug forms like charles_xavier are resolved automatically.",
    parameters: {
      type: "object",
      properties: {
        receiverId: { type: "string", description: "Recipient user ID (preferred when known)." },
        receiverName: { type: "string", description: "Recipient display name when ID is unknown." },
        content: { type: "string", description: "Text content of the message." }
      },
      required: ["content"]
    }
  },
  broadcast_message: {
    name: "broadcast_message",
    description: "Send the same message to every portal user with a given role (patient, nurse, doctor, or admin). Use for requests like 'message all nurses' or 'notify all patients'. Excludes the sender. Patients cannot broadcast to the patient role.",
    parameters: {
      type: "object",
      properties: {
        receiverRole: { type: "string", description: "Target role: patient, nurse, doctor, or admin." },
        content: { type: "string", description: "Message text to send to each recipient." }
      },
      required: ["receiverRole", "content"]
    }
  },
  pay_bill: {
    name: "pay_bill",
    description: "Mark a clinical billing invoice as fully paid by billing ID.",
    parameters: {
      type: "object",
      properties: {
        billingId: { type: "string", description: "The ID of the billing record." }
      },
      required: ["billingId"]
    }
  },
  delete_messages: {
    name: "delete_messages",
    description: "Delete one or more messages from the user's mailbox. Provide messageIds, or fromUserId/fromUserName to delete all messages from a specific sender.",
    parameters: {
      type: "object",
      properties: {
        messageIds: {
          type: "array",
          items: { type: "string" },
          description: "Explicit message IDs to delete (must belong to the user's mailbox)."
        },
        fromUserId: { type: "string", description: "Delete all messages from this sender in the user's mailbox." },
        fromUserName: { type: "string", description: "Delete all messages from a sender matched by display name (e.g. 'Nurse Ratched')." }
      },
      required: []
    }
  },
  get_billing_records: {
    name: "get_billing_records",
    description: "Query billing records by patientId, doctorId, or nurseId. Doctors and nurses default to their own clinician ID when no filter is given. Administrators may query all records.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "Filter by patient user ID." },
        doctorId: { type: "string", description: "Filter by attending doctor user ID." },
        nurseId: { type: "string", description: "Filter by attending nurse user ID." }
      },
      required: []
    }
  },
  update_my_profile: {
    name: "update_my_profile",
    description: "Update your own profile details like realName, email, phone, address, SSN, Insurance ID, NPI, Ward, or Clinical Notes.",
    parameters: {
      type: "object",
      properties: {
        realName: { type: "string", description: "Full legal name." },
        email: { type: "string", description: "Contact email address." },
        phone: { type: "string", description: "Contact phone number." },
        address: { type: "string", description: "Residential/practice address." },
        ssn: { type: "string", description: "Patient Social Security Number." },
        insurance_id: { type: "string", description: "Patient Insurance Group ID." },
        npi_number: { type: "string", description: "Doctor National Provider Identifier (NPI)." },
        assigned_ward: { type: "string", description: "Nurse designated ward or station." },
        clinical_notes: { type: "string", description: "Patient personal/clinical medical observations." }
      },
      required: []
    }
  },
  change_my_password: {
    name: "change_my_password",
    description: "Change user password securely by validating old password and saving new password.",
    parameters: {
      type: "object",
      properties: {
        oldPassword: { type: "string", description: "The current password." },
        newPassword: { type: "string", description: "The new desired password." }
      },
      required: ["oldPassword", "newPassword"]
    }
  },
  update_patient_status: {
    name: "update_patient_status",
    description: "Update a patient's triaged clinical state.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The patient ID." },
        status: { type: "string", description: "Desired status: 'active', 'pending-triage', 'discharged', 'under observation', or 'inactive'." }
      },
      required: ["patientId", "status"]
    }
  },
  update_patient_details: {
    name: "update_patient_details",
    description: "Update a patient's clinical and demographic details, such as full name, phone, address, email, SSN, Insurance ID, status, and clinical notes. Accessible to doctors, nurses, and admins.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "The ID of the target patient user." },
        realName: { type: "string", description: "Updated full legal name of the patient." },
        email: { type: "string", description: "Updated contact email address." },
        phone: { type: "string", description: "Updated contact phone number." },
        address: { type: "string", description: "Updated home address." },
        ssn: { type: "string", description: "Updated Social Security Number." },
        insurance_id: { type: "string", description: "Updated Insurance ID number/code." },
        clinical_notes: { type: "string", description: "Updated clinical history/assessment notes." },
        status: { type: "string", description: "Updated clinical triage status ('active', 'pending-triage', 'discharged', 'under observation', or 'inactive')." }
      },
      required: ["patientId"]
    }
  },
  discontinue_medication: {
    name: "discontinue_medication",
    description: "Deletes or discontinues medication prescriptions.",
    parameters: {
      type: "object",
      properties: {
        medId: { type: "string", description: "ID of the medication prescription to discontinue." }
      },
      required: ["medId"]
    }
  },
  create_user: {
    name: "create_user",
    description: "Create a brand new portal user account with optional demographic & profile fields.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Account username (unique)." },
        realName: { type: "string", description: "Full name of the user." },
        role: { type: "string", description: "Account role: 'patient', 'doctor', 'nurse', or 'admin'." },
        clearance_level: { type: "number", description: "Classification security clearance level (1 to 3)." },
        email: { type: "string", description: "Contact email address." },
        phone: { type: "string", description: "Contact phone number." },
        address: { type: "string", description: "Residential or home address." },
        ssn: { type: "string", description: "Social Security Number (for patients)." },
        insurance_id: { type: "string", description: "Insurance ID (for patients)." },
        npi_number: { type: "string", description: "NPI Number (for doctors)." },
        assigned_ward: { type: "string", description: "Assigned ward (for nurses)." },
        clinical_notes: { type: "string", description: "Clinical treatment/diagnosis notes (for patients)." },
        internal_notes: { type: "string", description: "Administrative internal records." }
      },
      required: ["id", "realName", "role"]
    }
  },
  delete_user: {
    name: "delete_user",
    description: "Completely deletes a patient or clinical staff user account.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID to merge out and delete." }
      },
      required: ["userId"]
    }
  },
  assign_patient_care_team: {
    name: "assign_patient_care_team",
    description: "Designate care teams dynamically.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "Target patient ID." },
        doctorId: { type: "string", description: "Doctor to assign to the patient." },
        nurseId: { type: "string", description: "Nurse to assign to the patient." }
      },
      required: ["patientId"]
    }
  },
  get_system_config: {
    name: "get_system_config",
    description: "Inspect system integration configuration parameters.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  update_system_config: {
    name: "update_system_config",
    description: "Save/override active clustering settings.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", description: "Deployment mode: 'standalone' or 'distributed'." },
        appserverUrl: { type: "string", description: "IP or URL of Application Server." },
        dbserverUrl: { type: "string", description: "IP or URL of Database Server." },
        aibrokerUrl: { type: "string", description: "IP or URL of AI Broker." }
      },
      required: ["mode"]
    }
  }
};

export function listMcpToolNames(): string[] {
  return Object.keys(MCP_TOOLS_SPEC);
}

/** Tools advertised via MCP tools/list (full catalog for Secure Access discovery). */
export function mcpToolsForDiscovery(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> {
  return Object.values(MCP_TOOLS_SPEC).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.parameters,
  }));
}
