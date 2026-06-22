/**
 * MCP tool execution helpers — all data access goes through HTTP APIs (dbserver + auth).
 * Imported into server.ts to keep the main file maintainable.
 */

export type McpDbClient = {
  get: (path: string) => Promise<any>;
  post: (path: string, body: any) => Promise<any>;
  put: (path: string, body: any) => Promise<any>;
  delete: (path: string) => Promise<any>;
};

export type McpAuthClient = {
  put: (path: string, body: any) => Promise<any>;
  post: (path: string, body: any) => Promise<any>;
};

export const ROLE_TOOLS: Record<string, string[]> = {
  patient: [
    "get_my_profile", "get_my_clinical_summary", "get_my_medications", "get_my_appointments",
    "get_my_lab_results", "get_my_billing", "get_my_messages",
    "cancel_appointment", "reschedule_appointment",
    "update_my_profile", "change_my_password"
  ],
  nurse: [
    "get_ward_roster", "get_patient_vitals", "record_vitals", "get_medication_tasks",
    "update_medication_status", "update_patient_status", "change_my_password"
  ],
  doctor: [
    "get_ward_roster", "get_assigned_patient_deep_dive", "get_all_appointments",
    "get_patient_vitals", "record_vitals", "prescribe_medication", "discontinue_medication",
    "update_patient_status", "change_my_password"
  ],
  admin: [
    "query_audit_logs", "get_user_directory", "manage_user_persona", "get_infrastructure_topology",
    "emergency_system_reset", "create_user", "delete_user", "assign_patient_care_team",
    "get_system_config", "update_system_config",
    "get_clinicians", "get_ward_roster", "get_assigned_patient_deep_dive", "get_all_appointments",
    "get_patient_vitals", "record_vitals", "get_medication_tasks", "update_medication_status",
    "prescribe_medication", "discontinue_medication", "update_patient_status",
    "get_my_profile", "get_my_clinical_summary", "get_my_medications", "get_my_appointments",
    "get_my_lab_results", "get_my_billing", "get_my_messages",
    "cancel_appointment", "reschedule_appointment", "update_my_profile", "change_my_password"
  ]
};

function enrichRoster(patientsList: any) {
  if (!Array.isArray(patientsList)) return patientsList;
  return patientsList.map((p: any) => {
    const statusNormalized = (p.status || "active").toLowerCase().trim();
    return {
      ...p,
      isTriage: statusNormalized === "pending-triage" || statusNormalized === "triage",
      isDischarged: statusNormalized === "discharged",
      isActive: statusNormalized === "active",
      isInactive: statusNormalized === "discharged" || statusNormalized === "inactive",
      statusLabel: p.status === "pending-triage" ? "Triage (pending-triage)" : p.status
    };
  });
}

export async function runMcpTool(
  toolName: string,
  args: any,
  uId: string,
  uRole: string,
  db: McpDbClient,
  auth: McpAuthClient,
  ctx: {
    liveConfig: any;
    version: string;
    versionDate: string;
    saveSystemConfig: (config: Record<string, unknown>) => void;
  }
): Promise<any> {
  switch (toolName) {
    // --- PATIENT (mirrors PatientDashboard + profile settings) ---
    case "get_my_profile":
      return db.get(`/api/dbserver/admin/users/${uId}`);

    case "get_my_clinical_summary":
      return db.get(`/api/dbserver/patients/${uId}`);

    case "get_my_medications":
      return db.get(`/api/dbserver/medications?patientId=${uId}`);

    case "get_my_appointments":
      return db.get(`/api/dbserver/appointments?patientId=${uId}`);

    case "get_my_lab_results":
      return db.get(`/api/dbserver/lab-results?patientId=${uId}`);

    case "get_my_billing":
      return db.get(`/api/dbserver/billing?patientId=${uId}`);

    case "get_my_messages":
      return db.get(`/api/dbserver/messages?userId=${uId}`);

    case "cancel_appointment": {
      const { appointmentId } = args;
      if (!appointmentId) return { error: "Missing required parameter: appointmentId" };
      if (uRole === "admin") {
        await db.delete(`/api/dbserver/appointments/${appointmentId}`);
        return { success: true, message: "Appointment cancelled successfully" };
      }
      const mine = await db.get(`/api/dbserver/appointments?patientId=${uId}`);
      const apt = Array.isArray(mine) ? mine.find((a: any) => a.id === appointmentId) : null;
      if (!apt) return { error: "Forbidden: Patients can only cancel their own appointments." };
      await db.delete(`/api/dbserver/appointments/${appointmentId}`);
      return { success: true, message: "Appointment cancelled successfully" };
    }

    case "reschedule_appointment": {
      const { appointmentId, date, time } = args;
      if (!appointmentId || !date || !time) {
        return { error: "Missing required parameters: appointmentId, date, time" };
      }
      if (uRole !== "admin") {
        const mine = await db.get(`/api/dbserver/appointments?patientId=${uId}`);
        const apt = Array.isArray(mine) ? mine.find((a: any) => a.id === appointmentId) : null;
        if (!apt) return { error: "Forbidden: Patients can only reschedule their own appointments." };
      }
      return db.put(`/api/dbserver/appointments/${appointmentId}`, { date, time });
    }

    case "update_my_profile": {
      const { realName, email, phone, address, ssn, insurance_id, npi_number, assigned_ward, clinical_notes } = args;
      const payload: any = { id: uId };
      if (realName !== undefined) payload.realName = realName;
      if (email !== undefined) payload.email = email;
      if (phone !== undefined) payload.phone = phone;
      if (address !== undefined) payload.address = address;
      if (ssn !== undefined) payload.ssn = ssn;
      if (insurance_id !== undefined) payload.insurance_id = insurance_id;
      if (npi_number !== undefined) payload.npi_number = npi_number;
      if (assigned_ward !== undefined) payload.assigned_ward = assigned_ward;
      if (clinical_notes !== undefined) payload.clinical_notes = clinical_notes;
      return auth.put("/api/auth/profile", payload);
    }

    case "change_my_password": {
      const { oldPassword, newPassword } = args;
      if (!oldPassword || !newPassword) return { error: "Both old and new passwords are required" };
      return auth.post("/api/auth/change-password", { userId: uId, oldPassword, newPassword });
    }

    // --- NURSE (mirrors NurseDashboard + Patients staff actions) ---
    case "get_ward_roster":
      if (uRole !== "nurse" && uRole !== "doctor" && uRole !== "admin") {
        return { error: "Unauthorized access to ward roster" };
      }
      return enrichRoster(await db.get("/api/dbserver/patients"));

    case "get_patient_vitals": {
      if (uRole !== "nurse" && uRole !== "doctor" && uRole !== "admin") return { error: "Unauthorized" };
      const p = await db.get(`/api/dbserver/patients/${args.patientId}`);
      return p?.vitals || p;
    }

    case "record_vitals": {
      if (uRole !== "nurse" && uRole !== "doctor" && uRole !== "admin") return { error: "Unauthorized" };
      const { patientId, hr, temp, bp } = args;
      return db.put(`/api/dbserver/patients/${patientId}/vitals`, { hr, temp, bp });
    }

    case "get_medication_tasks":
      if (uRole !== "nurse" && uRole !== "admin") return { error: "Unauthorized" };
      return db.get("/api/dbserver/medications");

    case "update_medication_status": {
      if (uRole !== "nurse" && uRole !== "admin") return { error: "Unauthorized" };
      const { medId, status } = args;
      return db.put(`/api/dbserver/medications/${medId}`, { status });
    }

    case "update_patient_status": {
      if (uRole !== "nurse" && uRole !== "doctor" && uRole !== "admin") return { error: "Forbidden: Clinicians only" };
      const { patientId, status } = args;
      if (!patientId || !status) return { error: "Missing patientId or target status" };
      return db.put(`/api/dbserver/patients/${patientId}/status`, { status });
    }

    // --- DOCTOR (mirrors DoctorDashboard + Patients staff actions) ---
    case "get_assigned_patient_deep_dive": {
      if (uRole !== "doctor" && uRole !== "admin") return { error: "Unauthorized" };
      const { patientId } = args;
      const rawPatient = await db.get(`/api/dbserver/patients/${patientId}`);
      const patient = rawPatient && typeof rawPatient === "object" ? {
        ...rawPatient,
        isTriage: (rawPatient.status || "").toLowerCase().includes("triage") || rawPatient.status === "pending-triage",
        isDischarged: rawPatient.status === "discharged",
        isActive: rawPatient.status === "active",
        isInactive: rawPatient.status === "discharged" || rawPatient.status === "inactive",
        statusLabel: rawPatient.status === "pending-triage" ? "Triage (pending-triage)" : rawPatient.status
      } : rawPatient;
      const [medications, appointments, labResults] = await Promise.all([
        db.get(`/api/dbserver/medications?patientId=${patientId}`),
        db.get(`/api/dbserver/appointments?patientId=${patientId}`),
        db.get(`/api/dbserver/lab-results?patientId=${patientId}`)
      ]);
      return { patient, medications, appointments, labResults };
    }

    case "get_all_appointments": {
      if (uRole !== "doctor" && uRole !== "admin") return { error: "Forbidden: Doctors and administrators only" };
      const { patientId, doctorId } = args || {};
      if (patientId) {
        return db.get(`/api/dbserver/appointments?patientId=${patientId}`);
      }
      if (doctorId) {
        return db.get(`/api/dbserver/appointments?doctorId=${doctorId}`);
      }
      if (uRole === "admin") {
        const [appointments, patients] = await Promise.all([
          db.get("/api/dbserver/appointments"),
          db.get("/api/dbserver/patients")
        ]);
        const patientMap = new Map(
          (Array.isArray(patients) ? patients : []).map((p: any) => [p.id, p])
        );
        return (Array.isArray(appointments) ? appointments : []).map((apt: any) => {
          const patient = patientMap.get(apt.patientId);
          return {
            ...apt,
            patientName: patient?.name,
            assignedDoctorId: patient?.assignedDoctorId,
            assignedNurseId: patient?.assignedNurseId
          };
        });
      }
      return db.get(`/api/dbserver/appointments?doctorId=${uId}`);
    }

    case "get_clinicians": {
      if (uRole !== "admin" && uRole !== "doctor" && uRole !== "nurse") return { error: "Unauthorized" };
      const [doctors, nurses] = await Promise.all([
        db.get("/api/dbserver/doctors"),
        db.get("/api/dbserver/nurses")
      ]);
      return { doctors, nurses };
    }

    case "prescribe_medication": {
      if (uRole !== "doctor" && uRole !== "admin") return { error: "Unauthorized" };
      const { patientId, name, dosage, frequency } = args;
      return db.post("/api/dbserver/medications", { patientId, name, dosage, frequency });
    }

    case "discontinue_medication": {
      if (uRole !== "doctor" && uRole !== "admin") return { error: "Forbidden: Doctors and administrators only" };
      const { medId } = args;
      if (!medId) return { error: "Missing medId" };
      await db.delete(`/api/dbserver/medications/${medId}`);
      return { success: true, message: "Medication prescription discontinued" };
    }

    // --- ADMIN (mirrors UserManagement + Patients admin actions) ---
    case "query_audit_logs":
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      return db.get("/api/dbserver/admin/logs");

    case "get_user_directory":
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      return db.get("/api/dbserver/admin/users");

    case "manage_user_persona": {
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      const {
        userId, clearanceLevel, role, internal_notes,
        realName, email, phone, address, ssn, insurance_id,
        npi_number, assigned_ward, clinical_notes
      } = args;
      if (!userId) return { error: "Missing required parameter: userId" };
      const payload: any = {};
      if (clearanceLevel !== undefined) payload.clearance_level = clearanceLevel;
      if (role !== undefined) payload.role = role;
      if (internal_notes !== undefined) payload.internal_notes = internal_notes;
      if (realName !== undefined) payload.realName = realName;
      if (email !== undefined) payload.email = email;
      if (phone !== undefined) payload.phone = phone;
      if (address !== undefined) payload.address = address;
      if (ssn !== undefined) payload.ssn = ssn;
      if (insurance_id !== undefined) payload.insurance_id = insurance_id;
      if (npi_number !== undefined) payload.npi_number = npi_number;
      if (assigned_ward !== undefined) payload.assigned_ward = assigned_ward;
      if (clinical_notes !== undefined) payload.clinical_notes = clinical_notes;
      return db.put(`/api/dbserver/admin/users/${userId}`, payload);
    }

    case "create_user": {
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      const {
        id, realName, role, clearance_level,
        email, phone, address, ssn, insurance_id,
        npi_number, assigned_ward, clinical_notes, internal_notes
      } = args;
      if (!id || !realName || !role) return { error: "Missing key parameters: id, realName, role" };
      return db.post("/api/dbserver/admin/users", {
        id, realName, role, clearance_level: clearance_level || 1,
        email, phone, address, ssn, insurance_id,
        npi_number, assigned_ward, clinical_notes, internal_notes
      });
    }

    case "delete_user": {
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      const { userId } = args;
      if (!userId) return { error: "Missing required parameter: userId" };
      await db.delete(`/api/dbserver/admin/users/${userId}`);
      return { success: true, message: `Identity ${userId} deleted from directory.` };
    }

    case "assign_patient_care_team": {
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      const { patientId, doctorId, nurseId } = args;
      if (!patientId) return { error: "Missing patientId" };
      return db.post("/api/dbserver/admin/assign-care-team", { patientId, doctorId, nurseId });
    }

    case "emergency_system_reset":
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      return db.post("/api/dbserver/admin/factory-reset", {});

    case "get_infrastructure_topology":
      return {
        topology: "Cisco Secure Healthcare Grid Topology",
        instances: [
          { name: "appserver", role: "Application Server & Reverse Proxy", status: "Healthy" },
          { name: "dbserver", role: "Database Server", status: "Isolated / Protected by ZTNA" },
          { name: "aibroker", role: "AI Security Broker", status: "Active" }
        ],
        access_controls: {
          authentication: "Cisco Duo OIDC Federation",
          network_isolation: "Cisco Secure Access ZTNA Connector",
          workload_segmentation: "Cisco Secure Workload Microsegmentation Policies"
        }
      };

    case "get_system_config":
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      return {
        mode: ctx.liveConfig.mode || "standalone",
        role: ctx.liveConfig.role || "standalone",
        appserverUrl: ctx.liveConfig.appserver_url || "",
        dbserverUrl: ctx.liveConfig.dbserver_url || "",
        aibrokerUrl: ctx.liveConfig.aibroker_url || "",
        version: ctx.version,
        date: ctx.versionDate
      };

    case "update_system_config": {
      if (uRole !== "admin") return { error: "Forbidden: Admins only" };
      const { mode, appserverUrl, dbserverUrl, aibrokerUrl } = args;
      ctx.liveConfig.mode = mode || "standalone";
      if (appserverUrl !== undefined) ctx.liveConfig.appserver_url = appserverUrl;
      if (dbserverUrl !== undefined) ctx.liveConfig.dbserver_url = dbserverUrl;
      if (aibrokerUrl !== undefined) ctx.liveConfig.aibroker_url = aibrokerUrl;
      const newConfig = {
        mode: ctx.liveConfig.mode,
        role: ctx.liveConfig.role,
        appserver_url: ctx.liveConfig.appserver_url,
        dbserver_url: ctx.liveConfig.dbserver_url,
        aibroker_url: ctx.liveConfig.aibroker_url
      };
      ctx.saveSystemConfig(newConfig);
      return { success: true, message: "System integration config saved", liveConfig: ctx.liveConfig };
    }

    default:
      return { error: `Tool ${toolName} not found or not enabled for role ${uRole}` };
  }
}
