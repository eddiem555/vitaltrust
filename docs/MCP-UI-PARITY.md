# VitalTrust — Web UI vs MCP Tool Parity Matrix

This document lists CRUD capabilities exposed in the **web portal** by role, and maps each to the corresponding **MCP tool** (if any). Use it to review gaps before demos.

**Legend:** ✅ = implemented in both · ⚠️ = UI only · 🔧 = MCP only · ❌ = missing from MCP

---

## Patient

| Resource | Create | Read | Update | Delete | Web UI location | MCP tool(s) | Status |
|----------|--------|------|--------|--------|-----------------|-------------|--------|
| Own profile | — | ✅ | ✅ | — | Profile modal | `get_my_profile`, `update_my_profile` | ✅ |
| Password | — | — | ✅ | — | Profile modal | `change_my_password` | ✅ |
| Clinical summary | — | ✅ | — | — | My Care Plan | `get_my_clinical_summary` | ✅ |
| Medications | — | ✅ | — | — | My Care Plan modal | `get_my_medications` | ✅ (read-only both) |
| Lab results | — | ✅ | — | — | My Care Plan modal | `get_my_lab_results` | ✅ |
| Appointments | ✅ | ✅ | ✅ | ✅ | Appointments | `get_my_appointments`, `create_appointment`, `update_appointment`, `reschedule_appointment`, `cancel_appointment`, `cancel_appointments_by_date`, `reschedule_appointments_by_date` | ✅ |
| Messages | ✅ | ✅ | — | ✅ | Messages | `get_my_messages`, `send_message`, `delete_messages` | ✅ |
| Billing | — | ✅ | — | — | Billing (nav) | `get_my_billing`, `pay_bill` | ✅ |

---

## Doctor

| Resource | Create | Read | Update | Delete | Web UI location | MCP tool(s) | Status |
|----------|--------|------|--------|--------|-----------------|-------------|--------|
| Ward roster / patients | — | ✅ | — | — | Patient Lists | `get_ward_roster`, `get_assigned_patient_deep_dive` | ✅ |
| Patient vitals | — | ✅ | ✅ | — | Patient detail | `get_patient_vitals`, `record_vitals` | ✅ |
| Patient status | — | — | ✅ | — | Patient detail | `update_patient_status` | ✅ |
| Medications | ✅ | ✅ | — | ✅ | Patient detail | `prescribe_medication`, `discontinue_medication` | ✅ |
| Appointments (assigned) | ✅ | ✅ | ✅ | ✅ | Appointments | `get_all_appointments`, `create_appointment`, `update_appointment`, `cancel_appointment`, `reschedule_appointment`, `cancel_appointments_by_date`, `reschedule_appointments_by_date` | ✅ |
| Messages | ✅ | ✅ | — | ✅ | Messages | `get_my_messages`, `send_message`, `broadcast_message`, `delete_messages` | ✅ |
| Billing (by clinician) | — | — | — | — | *AI only* | `get_billing_records` | 🔧 |
| Own profile / password | — | ✅ | ✅ | — | Profile modal | `update_my_profile`, `change_my_password` | ✅ |

---

## Nurse

| Resource | Create | Read | Update | Delete | Web UI location | MCP tool(s) | Status |
|----------|--------|------|--------|--------|-----------------|-------------|--------|
| Ward roster | — | ✅ | — | — | Patient Lists | `get_ward_roster` | ✅ |
| Patient vitals | — | ✅ | ✅ | — | Patient detail | `get_patient_vitals`, `record_vitals` | ✅ |
| Patient status | — | — | ✅ | — | Patient detail | `update_patient_status` | ✅ |
| Medications (MAR) | — | ✅ | ✅ | — | Patient detail | `get_medication_tasks`, `update_medication_status` | ✅ |
| Appointments (assigned) | ✅ | ✅ | ✅ | ✅ | Appointments | `get_all_appointments`, `create_appointment`, `update_appointment`, `cancel_appointment`, `reschedule_appointment`, `cancel_appointments_by_date`, `reschedule_appointments_by_date` | ✅ |
| Messages | ✅ | ✅ | — | ✅ | Messages | `get_my_messages`, `send_message`, `broadcast_message`, `delete_messages` | ✅ |
| Billing (by clinician) | — | — | — | — | *AI only* | `get_billing_records` | 🔧 |
| Own profile / password | — | ✅ | ✅ | — | Profile modal | `update_my_profile`, `change_my_password` | ✅ |

---

## Administrator

| Resource | Create | Read | Update | Delete | Web UI location | MCP tool(s) | Status |
|----------|--------|------|--------|--------|-----------------|-------------|--------|
| Users | ✅ | ✅ | ✅ | ✅ | Settings / User Mgmt | `create_user`, `get_user_directory`, `manage_user_persona`, `delete_user` | ✅ |
| Care team assignment | — | — | ✅ | — | Patient admin | `assign_patient_care_team` | ✅ |
| Audit logs | — | ✅ | — | — | Audit Logs | `query_audit_logs` | ✅ |
| System config | — | ✅ | ✅ | — | Settings | `get_system_config`, `update_system_config` | ✅ |
| Factory reset | — | — | — | ✅ | Settings | `emergency_system_reset` | ✅ |
| All clinical data | ✅ | ✅ | ✅ | ✅ | Patient Lists + AI | Full admin tool set | ✅ |
| Billing (all / by filter) | — | — | — | — | *AI only* | `get_billing_records` | 🔧 |
| Messages | ✅ | ✅ | — | ✅ | Messages | `get_my_messages`, `send_message`, `broadcast_message`, `delete_messages` | ✅ |

---

## Known intentional differences

1. **Billing for clinicians** — Doctors, nurses, and admins query billing via AI (`get_billing_records`); patients have a dedicated Billing page.
2. **Admin appointments** — No Appointments nav item; full schedule via `get_all_appointments` in AI.
3. **Role broadcast messaging** — `broadcast_message` (all users in a role) is available via AI for nurses, doctors, and admins only; the web UI sends one message at a time.

---

## Mutation safety (AI assistant)

All write operations **must** call an MCP tool and confirm the tool response before telling the user an action succeeded. The system prompt enforces this for profile updates, message deletion, payments, and scheduling. Bulk appointment requests (cancel/move all on a date) must use `cancel_appointments_by_date` or `reschedule_appointments_by_date` — reading the schedule alone does not mutate data.

---

*Generated for VitalTrust 3.0.350 — review after factory reset when seed data changes.*
