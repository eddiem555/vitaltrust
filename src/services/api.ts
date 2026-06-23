/// <reference types="vite/client" />
import { Patient, User, Medication, Appointment, BillingRecord, AuditLog } from "../types";

// Distributed Service Base URLs
const getBaseUrl = (envVar?: string) => {
  if (!envVar || envVar.trim() === "" || envVar.includes("localhost:3000")) return "";
  
  if (typeof window !== "undefined") {
    // If the hostname matches current, or it's just a relative path, return empty
    if (envVar.includes(window.location.hostname)) return "";
    
    // Safety check: if envVar doesn't start with http, it might be an invalid fragment
    if (!envVar.startsWith("http")) return "";
  }
  
  return envVar.endsWith("/") ? envVar.slice(0, -1) : envVar;
};

async function handleResponse(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    let errorMsg = `Server error: ${res.status}`;
    try {
      if (text) {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || errorMsg;
      }
    } catch {
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        errorMsg = `Server returned HTML instead of JSON (${res.status}). This usually means a route is not registered or the server is misconfigured.`;
      }
    }
    throw new Error(errorMsg);
  }
  
  if (!text || text.trim() === "") {
    return { success: true };
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse JSON response:", text);
    throw new Error("Invalid server response format (expected JSON).");
  }
}

async function handleResponseSafe(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    let errorMsg = `Server error: ${res.status}`;
    try {
      if (text) {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || errorMsg;
      }
    } catch {
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        errorMsg = `Server returned HTML instead of JSON (${res.status}).`;
      }
    }
    return { success: false, error: errorMsg };
  }
  
  if (!text || text.trim() === "") {
    return { success: true };
  }

  try {
    const parsed = JSON.parse(text);
    return { success: true, ...parsed };
  } catch (err) {
    return { success: false, error: "Invalid response format from service (expected JSON)." };
  }
}

export const api = {
  async getPatients(): Promise<Patient[]> {
    const res = await fetch(`/api/dbserver/patients`);
    return handleResponse(res);
  },

  async getPatient(id: string): Promise<Patient> {
    const res = await fetch(`/api/dbserver/patients/${id}`);
    return handleResponse(res);
  },

  async chatWithAgent(message: string, userId: string) {
    const res = await fetch(`/api/aibroker/mcp/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, userId }),
    });
    return handleResponse(res);
  },

  async login(username: string, password?: string) {
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return handleResponseSafe(res);
  },

  async getDuoAuthUrl() {
    const res = await fetch(`/api/auth/duo/url`);
    return handleResponse(res);
  },

  async updateUserProfile(userData: { 
    id: string; 
    realName: string; 
    email?: string; 
    phone?: string; 
    address?: string;
    npi_number?: string;
    assigned_ward?: string;
    clearance_level?: number;
    internal_notes?: string;
    ssn?: string;
    insurance_id?: string;
    clinical_notes?: string;
  }) {
    const res = await fetch(`/api/auth/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },

  async getAppointments(params: { patientId?: string; doctorId?: string; nurseId?: string; requesterId?: string; requesterRole?: string }): Promise<Appointment[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const res = await fetch(`/api/dbserver/appointments?${query}`);
    return handleResponse(res);
  },

  async createAppointment(data: Partial<Appointment> & { requesterId?: string; requesterRole?: string }) {
    const res = await fetch(`/api/dbserver/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateAppointment(id: string, data: Partial<Appointment> & { requesterId?: string; requesterRole?: string }) {
    const res = await fetch(`/api/dbserver/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteAppointment(id: string, requesterId?: string, requesterRole?: string) {
    const query = new URLSearchParams();
    if (requesterId) query.set('requesterId', requesterId);
    if (requesterRole) query.set('requesterRole', requesterRole);
    const res = await fetch(`/api/dbserver/appointments/${id}?${query.toString()}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  async getMedications(patientId: string): Promise<any[]> {
    const res = await fetch(`/api/dbserver/medications?patientId=${patientId}`);
    return handleResponse(res);
  },

  async addMedication(data: { patientId: string, name: string, dosage: string, frequency: string, startDate?: string }) {
    const res = await fetch(`/api/dbserver/medications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  
  async updateMedicationStatus(medicationId: string, status: string) {
    const res = await fetch(`/api/dbserver/medications/${medicationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  async deleteMedication(id: string) {
    const res = await fetch(`/api/dbserver/medications/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete medication");
  },

  async updateMedicationDetails(id: string, details: Partial<Medication>) {
    const res = await fetch(`/api/dbserver/medications/${id}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    return handleResponse(res);
  },

  async updatePatientStatus(patientId: string, status: string) {
    const res = await fetch(`/api/dbserver/patients/${patientId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  async updatePatientVitals(patientId: string, vitals: { hr: string, temp: string, bp: string }) {
    const res = await fetch(`/api/dbserver/patients/${patientId}/vitals`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vitals),
    });
    return handleResponse(res);
  },

  async getBilling(patientId: string): Promise<any[]> {
    const res = await fetch(`/api/dbserver/billing?patientId=${patientId}`);
    return handleResponse(res);
  },

  async getMessages(userId: string): Promise<any[]> {
    const res = await fetch(`/api/dbserver/messages?userId=${userId}`);
    return handleResponse(res);
  },

  async sendMessage(data: { senderId: string; receiverId: string; content: string }) {
    const res = await fetch(`/api/dbserver/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteMessages(ids: string[], userId: string) {
    const res = await fetch(`/api/dbserver/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, userId }),
    });
    return handleResponse(res);
  },

  async getMessageDirectory(): Promise<Pick<User, 'id' | 'role' | 'realName'>[]> {
    const res = await fetch(`/api/dbserver/users/directory`);
    return handleResponse(res);
  },

  async getDoctors(): Promise<{ id: string; name: string }[]> {
    const res = await fetch(`/api/dbserver/doctors`);
    return handleResponse(res);
  },

  async getNurses(): Promise<{ id: string; name: string }[]> {
    const res = await fetch(`/api/dbserver/nurses`);
    return handleResponse(res);
  },
  
  async getLabResults(patientId: string): Promise<any[]> {
    const res = await fetch(`/api/dbserver/lab-results?patientId=${patientId}`);
    return handleResponse(res);
  },

  async assignCareTeam(patientId: string, careTeam: { doctorId?: string, nurseId?: string }) {
    const res = await fetch(`/api/dbserver/admin/assign-care-team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, ...careTeam }),
    });
    return handleResponse(res);
  },

  async removeCareTeamAssignment(patientId: string) {
    const res = await fetch(`/api/dbserver/admin/assign-doctor/${patientId}`, {
      method: "DELETE"
    });
    return handleResponse(res);
  },
  
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const res = await fetch(`/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, oldPassword, newPassword }),
    });
    return handleResponseSafe(res);
  },

  // Admin User Management
  async getAdminUsers(): Promise<any[]> {
    const res = await fetch(`/api/dbserver/admin/users`);
    return handleResponse(res);
  },

  async createAdminUser(userData: any) {
    const res = await fetch(`/api/dbserver/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },

  async updateAdminUser(id: string, userData: any) {
    const res = await fetch(`/api/dbserver/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },

  async deleteAdminUser(id: string) {
    const res = await fetch(`/api/dbserver/admin/users/${id}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  async factoryReset(): Promise<{ success: boolean, message: string }> {
    const res = await fetch(`/api/dbserver/admin/factory-reset`, {
      method: "POST",
    });
    return handleResponse(res);
  },

  async getAuditLogs(node: string = "central"): Promise<AuditLog[]> {
    const res = await fetch(`/api/system/node-logs?node=${node}`);
    return handleResponse(res);
  }
};
