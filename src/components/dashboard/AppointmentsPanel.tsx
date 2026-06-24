import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Plus, Save, X, Trash2, Edit2 } from 'lucide-react';
import { User, Appointment, Patient } from '../../types';
import { api } from '../../services/api';

interface AppointmentsPanelProps {
  user: User;
}

type StaffOption = { id: string; name: string };

function parseTimeMinutes(time: string): number {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
}

function sortAppointments(list: Appointment[], user: User): Appointment[] {
  const isAssigned = (apt: Appointment) => {
    if (user.role === 'doctor') return apt.doctorId === user.id;
    if (user.role === 'nurse') return apt.nurseId === user.id;
    if (user.role === 'patient') return apt.patientId === user.id;
    return false;
  };

  const byDateTime = (a: Appointment, b: Appointment) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return parseTimeMinutes(a.time) - parseTimeMinutes(b.time);
  };

  if (user.role === 'doctor' || user.role === 'nurse') {
    const mine = list.filter(isAssigned).sort(byDateTime);
    const others = list.filter((a) => !isAssigned(a)).sort(byDateTime);
    return [...mine, ...others];
  }

  return [...list].sort(byDateTime);
}

export default function AppointmentsPanel({ user }: AppointmentsPanelProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<StaffOption[]>([]);
  const [nurses, setNurses] = useState<StaffOption[]>([]);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Appointment>>({});

  const isClinicalStaff = user.role === 'doctor' || user.role === 'nurse';
  const isPatient = user.role === 'patient';

  useEffect(() => {
    const load = async () => {
      const params = isPatient
        ? { patientId: user.id, requesterId: user.id, requesterRole: user.role }
        : { requesterId: user.id, requesterRole: user.role };
      const [apts, pats, docList, nurseList] = await Promise.all([
        api.getAppointments(params),
        isClinicalStaff || isPatient ? api.getPatients() : Promise.resolve([]),
        api.getDoctors(),
        api.getNurses(),
      ]);
      setAppointments(apts);
      setPatients(pats);
      setDoctors(docList);
      setNurses(nurseList);
    };
    load().catch(console.error);
  }, [user.id, user.role, isClinicalStaff, isPatient]);

  const sorted = useMemo(() => sortAppointments(appointments, user), [appointments, user]);

  const nameForPatient = (id: string) => patients.find((p) => p.id === id)?.name || id;
  const nameForDoctor = (id: string) => doctors.find((d) => d.id === id)?.name || id;
  const nameForNurse = (id: string) => nurses.find((n) => n.id === id)?.name || id;

  const canModify = (apt: Appointment) => {
    if (isPatient) return apt.patientId === user.id;
    if (user.role === 'doctor') return apt.doctorId === user.id;
    if (user.role === 'nurse') return apt.nurseId === user.id;
    return true;
  };

  const isAssignedToMe = (apt: Appointment) => {
    if (user.role === 'doctor') return apt.doctorId === user.id;
    if (user.role === 'nurse') return apt.nurseId === user.id;
    return false;
  };

  const openCreate = () => {
    const base: Partial<Appointment> = {
      patientId: isPatient ? user.id : '',
      doctorId: '',
      nurseId: '',
      date: new Date().toISOString().split('T')[0],
      time: '9:00 AM',
      reason: 'Consultation',
      status: 'pending',
    };
    if (isPatient) {
      const p = patients.find((x) => x.id === user.id);
      if (p) {
        base.doctorId = p.assignedDoctorId || '';
        base.nurseId = p.assignedNurseId || '';
      }
    } else if (isClinicalStaff) {
      base.doctorId = user.role === 'doctor' ? user.id : '';
      base.nurseId = user.role === 'nurse' ? user.id : '';
    }
    setForm(base);
    setCreating(true);
  };

  const handleSave = async () => {
    if (!form.patientId || !form.doctorId || !form.nurseId || !form.date || !form.time || !form.reason) return;
    try {
      if (creating) {
        const created = await api.createAppointment({
          ...(form as Appointment),
          requesterId: user.id,
          requesterRole: user.role,
        });
        setAppointments((prev) => [...prev, created]);
        setCreating(false);
      } else if (editing) {
        const updated = await api.updateAppointment(editing.id, {
          date: form.date,
          time: form.time,
          reason: form.reason,
          status: form.status,
          doctorId: form.doctorId,
          nurseId: form.nurseId,
          requesterId: user.id,
          requesterRole: user.role,
        });
        setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setEditing(null);
      }
      setForm({});
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAppointment(id, user.id, user.role);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      setToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (apt: Appointment) => {
    setEditing(apt);
    setForm({ ...apt });
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">
          {isPatient ? 'My Appointments' : 'Clinical Appointments'}
        </h3>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-epic-blue text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-epic-dark transition-colors"
        >
          <Plus size={14} /> Schedule
        </button>
      </div>

      {isClinicalStaff && (
        <p className="text-xs text-slate-500">
          Rows highlighted in rose indicate appointments assigned to you. Edit and delete are available only for your assigned visits.
        </p>
      )}

      <div className="clinical-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase font-bold tracking-wider text-gray-400 border-b border-gray-100">
                {!isPatient && <th className="px-6 py-4">Patient</th>}
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Nurse</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={isPatient ? 7 : 8} className="px-6 py-12 text-center text-gray-400">
                    <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                    No appointments scheduled.
                  </td>
                </tr>
              ) : sorted.map((apt, idx) => {
                const assigned = isAssignedToMe(apt);
                const modifiable = canModify(apt);
                return (
                  <motion.tr
                    key={apt.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`transition-colors ${
                      assigned ? 'bg-rose-100 hover:bg-rose-200/90' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {!isPatient && (
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">{nameForPatient(apt.patientId)}</p>
                        <p className="text-[10px] font-mono text-slate-400">{apt.patientId}</p>
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{apt.date}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{apt.time}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{apt.reason}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{nameForDoctor(apt.doctorId)}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{nameForNurse(apt.nurseId)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        apt.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {modifiable ? (
                        <div className="flex justify-end gap-3">
                          <button onClick={() => startEdit(apt)} className="text-xs font-bold text-epic-blue hover:underline flex items-center gap-1">
                            <Edit2 size={12} /> Edit
                          </button>
                          <button onClick={() => setToDelete(apt.id)} className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">View only</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {(creating || editing) && (
          <Modal title={creating ? 'Schedule Appointment' : 'Edit Appointment'} onClose={() => { setCreating(false); setEditing(null); setForm({}); }}>
            <div className="p-6 space-y-4">
              {isClinicalStaff && (
                <Field label="Patient">
                  <select className="field-input" value={form.patientId || ''} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                    <option value="">Select patient…</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Doctor">
                {isClinicalStaff ? (
                  <select className="field-input" value={form.doctorId || ''} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                    <option value="">Select doctor…</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (
                  <input className="field-input" value={nameForDoctor(form.doctorId || '')} readOnly />
                )}
              </Field>
              <Field label="Nurse">
                {isClinicalStaff ? (
                  <select className="field-input" value={form.nurseId || ''} onChange={(e) => setForm({ ...form, nurseId: e.target.value })}>
                    <option value="">Select nurse…</option>
                    {nurses.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                ) : (
                  <input className="field-input" value={nameForNurse(form.nurseId || '')} readOnly />
                )}
              </Field>
              <Field label="Description">
                <input className="field-input" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </Field>
              <Field label="Date">
                <input type="date" className="field-input" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Time">
                <input className="field-input" value={form.time || ''} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="e.g. 10:30 AM" />
              </Field>
              <Field label="Status">
                <select className="field-input" value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value as Appointment['status'] })}>
                  {['pending', 'confirmed', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <button onClick={handleSave} className="w-full py-3 bg-epic-blue text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <Save size={16} /> Save
              </button>
            </div>
          </Modal>
        )}

        {toDelete && (
          <Modal title="Delete Appointment" onClose={() => setToDelete(null)}>
            <div className="p-8 space-y-6 text-center">
              <p className="text-sm text-slate-600">Remove this appointment from the schedule?</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setToDelete(null)} className="px-5 py-2.5 border border-slate-200 rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={() => handleDelete(toDelete)} className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs">Delete</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <style>{`.field-input { width: 100%; border-bottom: 1px solid #e2e8f0; padding: 0.5rem 0; outline: none; font-size: 0.875rem; font-weight: 600; } .field-input:focus { border-color: #7c1a1a; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
