/**
 * MCP tool execution helpers — all data access goes through HTTP APIs (dbserver + auth).
 * Imported into server.ts to keep the main file maintainable.
 */
import { canSendMessage } from "./src/messaging-rules";

export type McpDbClient = {
  get: (path: string) => Promise<any>;
  post: (path: string, body: any) => Promise<any>;
  put: (path: string, body: any) => Promise<any>;
  delete: (path: string, body?: any) => Promise<any>;
};

export type McpAuthClient = {
  put: (path: string, body: any) => Promise<any>;
  post: (path: string, body: any) => Promise<any>;
};

export const ROLE_TOOLS: Record<string, string[]> = {
  patient: [
    "get_my_profile", "get_my_clinical_summary", "get_my_medications", "get_my_appointments",
    "get_my_lab_results", "get_my_billing", "get_my_messages",
    "create_appointment", "update_appointment", "cancel_appointment", "reschedule_appointment",
    "cancel_appointments_by_date", "reschedule_appointments_by_date",
    "send_message", "delete_messages", "pay_bill",
    "update_my_profile", "change_my_password"
  ],
  nurse: [
    "get_ward_roster", "get_patient_vitals", "record_vitals", "get_medication_tasks",
    "update_medication_status", "update_patient_status",
    "get_all_appointments", "create_appointment", "update_appointment",
    "cancel_appointment", "reschedule_appointment",
    "cancel_appointments_by_date", "reschedule_appointments_by_date",
    "get_my_messages", "send_message", "broadcast_message", "delete_messages",
    "get_billing_records",
    "update_my_profile", "change_my_password"
  ],
  doctor: [
    "get_ward_roster", "get_assigned_patient_deep_dive", "get_all_appointments",
    "get_patient_vitals", "record_vitals", "prescribe_medication", "discontinue_medication",
    "update_patient_status",
    "create_appointment", "update_appointment", "cancel_appointment", "reschedule_appointment",
    "cancel_appointments_by_date", "reschedule_appointments_by_date",
    "get_my_messages", "send_message", "broadcast_message", "delete_messages",
    "get_billing_records",
    "update_my_profile", "change_my_password"
  ],
  admin: [
    "query_audit_logs", "get_user_directory", "manage_user_persona", "get_infrastructure_topology",
    "emergency_system_reset", "create_user", "delete_user", "assign_patient_care_team",
    "get_system_config", "update_system_config",
    "get_clinicians", "get_ward_roster", "get_assigned_patient_deep_dive", "get_all_appointments",
    "get_patient_vitals", "record_vitals", "get_medication_tasks", "update_medication_status",
    "prescribe_medication", "discontinue_medication", "update_patient_status",
    "create_appointment", "update_appointment", "cancel_appointment", "reschedule_appointment",
    "cancel_appointments_by_date", "reschedule_appointments_by_date",
    "get_my_messages", "send_message", "broadcast_message", "delete_messages",
    "get_billing_records",
    "get_my_profile", "get_my_clinical_summary", "get_my_medications", "get_my_appointments",
    "get_my_lab_results", "get_my_billing", "pay_bill",
    "update_my_profile", "change_my_password"
  ]
};

function canModifyAppointment(apt: any, uId: string, uRole: string): boolean {
  if (uRole === "admin") return true;
  if (uRole === "patient") return apt.patientId === uId;
  if (uRole === "doctor") return apt.doctorId === uId;
  if (uRole === "nurse") return apt.nurseId === uId;
  return false;
}

/** Normalize natural-language or ISO dates to YYYY-MM-DD for appointment matching. */
export function normalizeAppointmentDate(input: string): string | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const withYear = /\b\d{4}\b/.test(trimmed) ? trimmed : `${trimmed}, 2026`;
  const parsed = new Date(withYear);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return null;
}

function datesMatch(aptDate: string, queryInput: string): boolean {
  const normalized = normalizeAppointmentDate(queryInput);
  if (normalized) return aptDate === normalized;
  return aptDate === String(queryInput || "").trim();
}

async function listAppointmentsForUser(
  db: McpDbClient,
  uId: string,
  uRole: string
): Promise<any[]> {
  if (uRole === "patient") {
    const list = await db.get(`/api/dbserver/appointments?patientId=${uId}`);
    return Array.isArray(list) ? list : [];
  }
  if (uRole === "doctor") {
    const list = await db.get(`/api/dbserver/appointments?doctorId=${uId}`);
    return Array.isArray(list) ? list : [];
  }
  const list = await db.get("/api/dbserver/appointments");
  return Array.isArray(list) ? list : [];
}

async function getAppointmentById(db: McpDbClient, appointmentId: string): Promise<any | null> {
  const all = await db.get("/api/dbserver/appointments");
  if (!Array.isArray(all)) return null;
  return all.find((a: any) => a.id === appointmentId) || null;
}

type DirectoryUser = { id: string; role: string; realName: string };

async function getUserDirectory(db: McpDbClient): Promise<DirectoryUser[]> {
  const directory = await db.get("/api/dbserver/users/directory");
  return Array.isArray(directory) ? directory : [];
}

/** Resolve a portal user by exact id or by display-name substring (supports slug forms like charles_xavier). */
async function resolveDirectoryUser(
  db: McpDbClient,
  identifier: string
): Promise<{ user: DirectoryUser } | { error: string; matches?: DirectoryUser[] }> {
  const directory = await getUserDirectory(db);
  const trimmed = String(identifier || "").trim();
  if (!trimmed) return { error: "Empty user identifier" };

  const byId = directory.find((u) => u.id === trimmed);
  if (byId) return { user: byId };

  const needle = trimmed.toLowerCase().replace(/_/g, " ");
  const matches = directory.filter((u) =>
    String(u.realName || "").toLowerCase().includes(needle)
  );
  if (matches.length === 1) return { user: matches[0] };
  if (matches.length > 1) {
    return {
      error: `Multiple users match "${trimmed}". Use receiverId with a specific user id.`,
      matches: matches.map((u) => ({ id: u.id, role: u.role, realName: u.realName })),
    };
  }
  return {
    error: `No user found matching "${trimmed}". Call get_clinicians or inspect the user directory for valid ids (e.g. patient31, doctor1, nurse4).`,
  };
}

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
      if (uRole !== "admin") {
        const apt = await getAppointmentById(db, appointmentId);
        if (!apt) return { error: "Appointment not found" };
        if (!canModifyAppointment(apt, uId, uRole)) {
          return { error: `Forbidden: You may only cancel appointments you are assigned to.` };
        }
      }
      const qs = `?requesterId=${encodeURIComponent(uId)}&requesterRole=${encodeURIComponent(uRole)}`;
      await db.delete(`/api/dbserver/appointments/${appointmentId}${qs}`);
      return { success: true, message: "Appointment cancelled successfully" };
    }

    case "reschedule_appointment": {
      const { appointmentId, date, time } = args;
      if (!appointmentId || !date || !time) {
        return { error: "Missing required parameters: appointmentId, date, time" };
      }
      if (uRole !== "admin") {
        const apt = await getAppointmentById(db, appointmentId);
        if (!apt) return { error: "Appointment not found" };
        if (!canModifyAppointment(apt, uId, uRole)) {
          return { error: `Forbidden: You may only reschedule appointments you are assigned to.` };
        }
      }
      return db.put(`/api/dbserver/appointments/${appointmentId}`, {
        date,
        time,
        requesterId: uId,
        requesterRole: uRole,
      });
    }

    case "update_appointment": {
      const { appointmentId, date, time, reason, status, doctorId, nurseId } = args;
      if (!appointmentId) return { error: "Missing required parameter: appointmentId" };
      if (uRole !== "admin") {
        const apt = await getAppointmentById(db, appointmentId);
        if (!apt) return { error: "Appointment not found" };
        if (!canModifyAppointment(apt, uId, uRole)) {
          return { error: `Forbidden: You may only update appointments you are assigned to.` };
        }
      }
      const payload: any = { requesterId: uId, requesterRole: uRole };
      if (date !== undefined) payload.date = date;
      if (time !== undefined) payload.time = time;
      if (reason !== undefined) payload.reason = reason;
      if (status !== undefined) payload.status = status;
      if (doctorId !== undefined) payload.doctorId = doctorId;
      if (nurseId !== undefined) payload.nurseId = nurseId;
      return db.put(`/api/dbserver/appointments/${appointmentId}`, payload);
    }

    case "cancel_appointments_by_date": {
      const { date } = args;
      if (!date) return { error: "Missing required parameter: date (YYYY-MM-DD or e.g. August 9)" };
      const normalizedDate = normalizeAppointmentDate(date);
      const all = await listAppointmentsForUser(db, uId, uRole);
      const targets = all.filter(
        (apt) => datesMatch(apt.date, date) && canModifyAppointment(apt, uId, uRole)
      );
      if (targets.length === 0) {
        return {
          success: true,
          cancelled: 0,
          message: `No modifiable appointments found on ${normalizedDate || date}`,
        };
      }
      const qs = `?requesterId=${encodeURIComponent(uId)}&requesterRole=${encodeURIComponent(uRole)}`;
      const cancelled: string[] = [];
      const errors: string[] = [];
      for (const apt of targets) {
        try {
          await db.delete(`/api/dbserver/appointments/${apt.id}${qs}`);
          cancelled.push(apt.id);
        } catch (err: any) {
          errors.push(`${apt.id}: ${err?.message || String(err)}`);
        }
      }
      return {
        success: errors.length === 0,
        cancelled: cancelled.length,
        date: normalizedDate || date,
        appointmentIds: cancelled,
        errors: errors.length ? errors : undefined,
      };
    }

    case "reschedule_appointments_by_date": {
      const { sourceDate, targetDate } = args;
      if (!sourceDate || !targetDate) {
        return { error: "Missing required parameters: sourceDate and targetDate" };
      }
      const normalizedTarget = normalizeAppointmentDate(targetDate);
      if (!normalizedTarget) {
        return { error: `Could not parse targetDate: ${targetDate}` };
      }
      const all = await listAppointmentsForUser(db, uId, uRole);
      const targets = all.filter(
        (apt) => datesMatch(apt.date, sourceDate) && canModifyAppointment(apt, uId, uRole)
      );
      if (targets.length === 0) {
        return {
          success: true,
          rescheduled: 0,
          message: `No modifiable appointments found on ${sourceDate}`,
        };
      }
      const rescheduled: string[] = [];
      const errors: string[] = [];
      for (const apt of targets) {
        try {
          await db.put(`/api/dbserver/appointments/${apt.id}`, {
            date: normalizedTarget,
            time: apt.time,
            requesterId: uId,
            requesterRole: uRole,
          });
          rescheduled.push(apt.id);
        } catch (err: any) {
          errors.push(`${apt.id}: ${err?.message || String(err)}`);
        }
      }
      return {
        success: errors.length === 0,
        rescheduled: rescheduled.length,
        sourceDate: normalizeAppointmentDate(sourceDate) || sourceDate,
        targetDate: normalizedTarget,
        appointmentIds: rescheduled,
        errors: errors.length ? errors : undefined,
      };
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

    case "create_appointment": {
      const { patientId, date, time, reason, doctorId, nurseId } = args;
      if (!date || !time || !reason) {
        return { error: "Missing required parameters: date, time, reason" };
      }
      const payload: any = {
        date,
        time,
        reason,
        requesterId: uId,
        requesterRole: uRole,
      };
      if (uRole === "patient") {
        payload.patientId = uId;
      } else if (patientId) {
        payload.patientId = patientId;
      } else {
        return { error: "Missing required parameter: patientId (required for doctors, nurses, and admins)" };
      }
      if (doctorId) payload.doctorId = doctorId;
      else if (uRole === "doctor") payload.doctorId = uId;
      if (nurseId) payload.nurseId = nurseId;
      else if (uRole === "nurse") payload.nurseId = uId;
      return db.post("/api/dbserver/appointments", payload);
    }

    case "send_message": {
      const { receiverId, receiverName, content } = args;
      if (!content) return { error: "Missing required parameter: content" };
      const lookup = receiverId || receiverName;
      if (!lookup) {
        return { error: "Missing required parameter: receiverId or receiverName" };
      }
      const resolved = await resolveDirectoryUser(db, receiverName || receiverId);
      if ("error" in resolved) {
        return resolved.matches
          ? { error: resolved.error, matches: resolved.matches }
          : { error: resolved.error };
      }
      const receiver = resolved.user;
      if (receiver.id === uId) {
        return { error: "Cannot send a message to yourself." };
      }
      if (!canSendMessage(uRole as any, receiver.role as any)) {
        return { error: "Messaging policy violation: patient-to-patient messaging is not permitted." };
      }
      return db.post("/api/dbserver/messages", {
        senderId: uId,
        receiverId: receiver.id,
        content,
      });
    }

    case "broadcast_message": {
      const { receiverRole, content } = args;
      if (!content) return { error: "Missing required parameter: content" };
      if (!receiverRole) return { error: "Missing required parameter: receiverRole (patient, nurse, doctor, or admin)" };
      if (uRole === "patient" && String(receiverRole).toLowerCase() === "patient") {
        return { error: "Messaging policy violation: patients cannot broadcast to other patients." };
      }
      return db.post("/api/dbserver/messages/broadcast", {
        senderId: uId,
        receiverRole: String(receiverRole).toLowerCase().trim(),
        content,
      });
    }

    case "delete_messages": {
      const { messageIds, fromUserId, fromUserName } = args;
      let ids: string[] = Array.isArray(messageIds) ? messageIds : [];
      if (ids.length === 0) {
        let senderId = fromUserId;
        if (!senderId && fromUserName) {
          const resolved = await resolveDirectoryUser(db, fromUserName);
          if ("error" in resolved) {
            return resolved.matches
              ? { error: resolved.error, matches: resolved.matches }
              : { error: resolved.error };
          }
          senderId = resolved.user.id;
        }
        if (!senderId) {
          return { error: "Provide messageIds, fromUserId, or fromUserName to delete messages" };
        }
        const mine = await db.get(`/api/dbserver/messages?userId=${uId}`);
        ids = (Array.isArray(mine) ? mine : [])
          .filter((m: any) => m.senderId === senderId && (m.receiverId === uId || m.senderId === uId))
          .map((m: any) => m.id);
      }
      if (ids.length === 0) {
        return { success: true, deleted: 0, message: "No matching messages to delete" };
      }
      return db.delete("/api/dbserver/messages", { ids, userId: uId });
    }

    case "pay_bill": {
      const { billingId } = args;
      if (!billingId) return { error: "Missing required parameter: billingId" };
      if (uRole === "patient") {
        const mine = await db.get(`/api/dbserver/billing?patientId=${uId}`);
        const bill = Array.isArray(mine) ? mine.find((b: any) => b.id === billingId) : null;
        if (!bill) return { error: "Forbidden: Patients can only pay their own billing records." };
      }
      return db.put(`/api/dbserver/billing/${billingId}`, { status: "paid" });
    }

    case "get_billing_records": {
      if (uRole !== "admin" && uRole !== "doctor" && uRole !== "nurse") {
        return { error: "Forbidden: Clinicians and administrators only. Patients use get_my_billing." };
      }
      const { patientId, doctorId, nurseId } = args || {};
      const params = new URLSearchParams();
      if (patientId) params.set("patientId", patientId);
      if (doctorId) params.set("doctorId", doctorId);
      else if (uRole === "doctor") params.set("doctorId", uId);
      if (nurseId) params.set("nurseId", nurseId);
      else if (uRole === "nurse") params.set("nurseId", uId);
      const qs = params.toString();
      return db.get(`/api/dbserver/billing${qs ? `?${qs}` : ""}`);
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
      if (uRole !== "doctor" && uRole !== "admin" && uRole !== "nurse") {
        return { error: "Forbidden: Clinical staff and administrators only" };
      }
      const { patientId, doctorId, nurseId } = args || {};
      if (patientId) {
        return db.get(`/api/dbserver/appointments?patientId=${patientId}`);
      }
      if (doctorId) {
        return db.get(`/api/dbserver/appointments?doctorId=${doctorId}`);
      }
      if (nurseId) {
        return db.get(`/api/dbserver/appointments?nurseId=${nurseId}`);
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
      if (uRole === "doctor") {
        return db.get(`/api/dbserver/appointments?doctorId=${uId}`);
      }
      // Nurses: return full schedule (matches web UI); pass nurseId arg to filter to own queue
      return db.get("/api/dbserver/appointments");
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
