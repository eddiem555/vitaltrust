import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, MoreHorizontal, ShieldAlert, Eye, EyeOff, Lock, User as UserIcon, RotateCcw, AlertTriangle, Thermometer, Activity as VitalsIcon, Heart, Save, X } from 'lucide-react';
import { api } from '../../services/api';
import { Patient, User } from '../../types';

export default function Patients({ user }: { user: User }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [phiVisible, setPhiVisible] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [editingVitals, setEditingVitals] = useState<{ id: string, hr: string, temp: string, bp: string } | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const isStaff = user.role === 'nurse' || user.role === 'doctor';
  const isAdmin = user.role === 'admin';

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPatients();
      setPatients(data);
      
      const [drs, nrs] = await Promise.all([
        fetch('/api/dbserver/doctors').then(res => res.json()),
        fetch('/api/dbserver/nurses').then(res => res.json())
      ]);
      setDoctors(drs);
      setNurses(nrs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (patientId: string, status: string) => {
    try {
      const res = await api.updatePatientStatus(patientId, status);
      if (res.success) {
        setPatients(prev => prev.map(p => p.id === patientId ? { ...p, status } : p));
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleUpdateVitals = async () => {
    if (!editingVitals) return;
    try {
      const { id, hr, temp, bp } = editingVitals;
      const res = await api.updatePatientVitals(id, { hr, temp, bp });
      if (res.success) {
        setPatients(prev => prev.map(p => 
          p.id === id 
            ? { ...p, vitals: { hr, temp, bp, lastUpdated: new Date().toISOString().split('T')[0] } } 
            : p
        ));
        setEditingVitals(null);
      }
    } catch (err) {
      console.error("Failed to update vitals", err);
    }
  };

  const handleAssignTeam = async (patientId: string, doctorId?: string, nurseId?: string) => {
    try {
      const res = await api.assignCareTeam(patientId, { doctorId, nurseId });
      if (res.success) {
        setPatients(prev => prev.map(p => 
          p.id === patientId 
            ? { ...p, assignedDoctorId: doctorId || p.assignedDoctorId, assignedNurseId: nurseId || p.assignedNurseId } 
            : p
        ));
      }
    } catch (err) {
      console.error("Failed to assign care team", err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleFactoryReset = async () => {
    setShowResetConfirm(false);
    setResetting(true);
    try {
      const res = await api.factoryReset();
      if (res.success) {
        setStatusMessage(res.message);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      alert("Failed to perform factory reset.");
    } finally {
      setResetting(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.condition && p.condition.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* EHR Administration Controls */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">EHR Recovery</h3>
                <p className="text-[10px] text-slate-500 font-medium">Reset system to development baseline</p>
              </div>
            </div>
            <button 
              onClick={() => setShowResetConfirm(true)}
              disabled={resetting}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-slate-100 disabled:opacity-50 cursor-pointer"
            >
              {resetting ? 'Resetting...' : 'Factory Reset EHR Database'}
            </button>
          </div>

          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm flex items-center gap-6">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 border border-red-100">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-red-900 uppercase text-xs tracking-widest">Administrative Override</h3>
              <p className="text-[10px] text-red-700/70 font-medium leading-tight">
                You are currently in EHR Administration mode. Monitoring is active for all database mutations and PHI access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PHI Access Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${phiVisible ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
            {phiVisible ? <ShieldAlert size={24} /> : <Lock size={24} />}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Protected Health Information (PHI)</h3>
            <p className="text-xs text-gray-500">Access to sensitive fields is monitored by Cisco Duo & Secure Workload</p>
          </div>
        </div>

        <button 
          onClick={() => setPhiVisible(!phiVisible)}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
            phiVisible 
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' 
              : 'bg-cisco-navy text-white hover:bg-slate-800'
          }`}
        >
          {phiVisible ? (
             <>
               <EyeOff size={18} /> Mask PHI Fields
             </>
          ) : (
            <>
              <Eye size={18} /> Request Access to PHI
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search patients, conditions or IDs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cisco-blue focus:border-transparent outline-none text-sm"
                />
            </div>
            <button className="p-2.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl">
                <Filter size={18} />
            </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase font-bold tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-6 py-4">Patient Name</th>
                <th className="px-6 py-4">Care Team</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Vitals</th>
                {phiVisible && (
                  <>
                    <th className="px-6 py-4">PHI Data</th>
                  </>
                )}
                <th className="px-6 py-4">Condition</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                    <td colSpan={phiVisible ? 8 : 6} className="px-6 py-12 text-center text-gray-400 font-medium">Synchronizing medical records...</td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                    <td colSpan={phiVisible ? 8 : 6} className="px-6 py-12 text-center text-gray-400">No records found.</td>
                </tr>
              ) : filteredPatients.map((patient, idx) => {
                const isAssignedToMe = 
                  (user.role === 'nurse' && patient.assignedNurseId === user.id) ||
                  (user.role === 'doctor' && patient.assignedDoctorId === user.id);

                return (
                  <motion.tr 
                      key={patient.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`transition-colors group ${
                        isAssignedToMe 
                          ? 'bg-rose-100 hover:bg-rose-200/90' 
                          : 'hover:bg-slate-50/50'
                      }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold border border-slate-200">
                          {patient.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm tracking-tight">{patient.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">UUID: {patient.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin ? (
                         <div className="space-y-1 w-32">
                            <select 
                              className="text-[10px] bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:border-red-500 font-bold text-slate-600 block w-full"
                              value={patient.assignedDoctorId || ''}
                              onChange={(e) => handleAssignTeam(patient.id, e.target.value, patient.assignedNurseId)}
                            >
                               <option value="">Physician...</option>
                               {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <select 
                              className="text-[10px] bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:border-red-500 font-bold text-slate-600 block w-full"
                              value={patient.assignedNurseId || ''}
                              onChange={(e) => handleAssignTeam(patient.id, patient.assignedDoctorId, e.target.value)}
                            >
                               <option value="">Nurse...</option>
                               {nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                            </select>
                         </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <div className={`w-1 h-1 rounded-full ${patient.assignedDoctorId ? 'bg-blue-500' : 'bg-slate-300'}`} />
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                               MD: {doctors.find(d => d.id === patient.assignedDoctorId)?.name.split(' ').pop() || 'None'}
                             </span>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className={`w-1 h-1 rounded-full ${patient.assignedNurseId ? 'bg-rose-500' : 'bg-slate-300'}`} />
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                               RN: {nurses.find(n => n.id === patient.assignedNurseId)?.name.split(' ').pop() || 'None'}
                             </span>
                          </div>
                        </div>
                      )}
                    </td>
                  <td className="px-6 py-4">
                    {isStaff ? (
                      <select 
                        value={patient.status || 'active'}
                        onChange={(e) => handleUpdateStatus(patient.id, e.target.value)}
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded border outline-none transition-all ${
                          patient.status === 'discharged' ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                          patient.status === 'pending-triage' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-green-100 text-green-700 border-green-200'
                        }`}
                      >
                         <option value="active">Active</option>
                         <option value="discharged">Discharged</option>
                         <option value="pending-triage">Triage</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                        patient.status === 'discharged' ? 'bg-slate-50 text-slate-500 border-slate-100' : 
                        patient.status === 'pending-triage' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-green-50 text-green-600 border-green-100'
                      }`}>
                        {patient.status || 'Active'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {patient.vitals ? (
                        <div className="flex items-center gap-3">
                           <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                              <Heart size={10} className="text-red-500" /> {patient.vitals.hr}
                           </div>
                           <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                              <Thermometer size={10} className="text-orange-500" /> {patient.vitals.temp}°
                           </div>
                           <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                              <VitalsIcon size={10} className="text-blue-500" /> {patient.vitals.bp}
                           </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">No recorded vitals</span>
                      )}
                      
                      {isStaff && (
                        <button 
                          onClick={() => setEditingVitals({ 
                            id: patient.id, 
                            hr: patient.vitals?.hr || '', 
                            temp: patient.vitals?.temp || '', 
                            bp: patient.vitals?.bp || '' 
                          })}
                          className="text-[9px] font-black uppercase text-red-600 hover:underline text-left w-fit"
                        >
                          {patient.vitals ? 'Update Vitals' : '+ Record Vitals'}
                        </button>
                      )}
                    </div>
                  </td>
                  {phiVisible && (
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-mono text-xs text-red-600 font-bold">{patient.ssn || 'XXX-XX-XXXX'}</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{patient.email}<br/>{patient.phone}</p>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-700 tracking-tight">{patient.condition}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedPatient(patient)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-100"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </motion.tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {editingVitals && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div>
                   <h3 className="font-bold text-slate-900">Record Patient Vitals</h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Verification ID: {editingVitals.id}</p>
                </div>
                <button onClick={() => setEditingVitals(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Heart size={12} className="text-red-500" /> Heart Rate (BPM)
                    </label>
                    <input 
                      type="text" 
                      value={editingVitals.hr}
                      onChange={(e) => setEditingVitals({...editingVitals, hr: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm font-bold"
                      placeholder="e.g. 72"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Thermometer size={12} className="text-orange-500" /> Temp (°F)
                    </label>
                    <input 
                      type="text" 
                      value={editingVitals.temp}
                      onChange={(e) => setEditingVitals({...editingVitals, temp: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm font-bold"
                      placeholder="e.g. 98.6"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <VitalsIcon size={12} className="text-blue-500" /> Blood Pressure (mmHg)
                  </label>
                  <input 
                    type="text" 
                    value={editingVitals.bp}
                    onChange={(e) => setEditingVitals({...editingVitals, bp: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm font-bold"
                    placeholder="e.g. 120/80"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                   <button 
                     onClick={handleUpdateVitals}
                     className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                   >
                     <Save size={16} /> Save Vital Records
                   </button>
                   <button 
                     onClick={() => setEditingVitals(null)}
                     className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                   >
                     Cancel
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {selectedPatient && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden max-w-2xl w-full border border-slate-200/80 shadow-2xl"
            >
              <div className="px-8 py-6 bg-[#7c1a1a] text-white flex items-center justify-between">
                <div>
                   <h3 className="font-bold text-lg text-white font-sans tracking-tight">Patient Clinical Dossier</h3>
                   <p className="text-[10px] text-white/75 font-mono uppercase tracking-widest">EHR Record ID: {selectedPatient.id}</p>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} className="text-white" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Visual indicator of security level */}
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  phiVisible 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-red-50/50 border-red-200/60 text-red-800"
                }`}>
                  {phiVisible ? <Eye size={18} className="shrink-0 mt-0.5 text-emerald-600" /> : <Lock size={18} className="shrink-0 mt-0.5 text-red-600" />}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      {phiVisible ? "SSO/MFA Active - Protected EHR Unmasked" : "Security Gateway Masking Active"}
                    </h4>
                    <p className="text-[10px] font-bold opacity-80 leading-relaxed mt-0.5">
                      {phiVisible 
                        ? "Duo MFA Verification validated. High-value data is unmasked for authorized medical professionals. Access logs are being pushed to Cisco Secure Workload."
                        : "High-value identifiers (SSN, Insurance ID, Clinical Notes) are masked below by the secure boundary proxy. Toggle 'Show PHI' or pass MFA context to unmask."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Patient Name</p>
                    <p className="text-sm font-black text-slate-800">{selectedPatient.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date of Birth</p>
                    <p className="text-sm font-bold text-slate-700">{selectedPatient.dob}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number</p>
                    <p className="text-sm font-bold text-slate-700">{phiVisible ? selectedPatient.phone : "•••-•••-•••• (*Masked*)"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                    <p className="text-sm font-bold text-slate-700">{phiVisible ? selectedPatient.email : "••••••@••••.com (*Masked*)"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registered Home Address</p>
                  <p className="text-sm font-bold text-slate-700 leading-tight">
                    {phiVisible ? selectedPatient.address : "••••••••••••••••••••••••• (*Masked*)"}
                  </p>
                </div>

                {/* Highly critical PHI parameters (specifically requested by user) */}
                <div className="border-t border-slate-100 pt-6 grid grid-cols-2 gap-6 animate-pulse">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Social Security Number (SSN)</p>
                    {phiVisible ? (
                      <p className="font-mono text-sm font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-lg w-fit border border-red-100">
                        {selectedPatient.ssn || "N/A"}
                      </p>
                    ) : (
                      <p className="font-mono text-sm font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg w-fit border border-slate-100">
                        •••-••-•••• (Restricted)
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Insurance ID Number</p>
                    {phiVisible ? (
                      <p className="font-mono text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit border border-emerald-100">
                        {selectedPatient.insurance_id || "N/A"}
                      </p>
                    ) : (
                      <p className="font-mono text-sm font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg w-fit border border-slate-100">
                        •••••••••••• (Restricted)
                      </p>
                    )}
                  </div>
                </div>

                {/* Vitals and Condition */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Admitting Diagnosis</p>
                    <p className="text-sm font-bold text-slate-800">{selectedPatient.condition}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Prescribed Medications</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPatient.medications?.map((med, i) => (
                        <span key={i} className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {med}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Clinical Notes Box */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Official Doctor's Clinical notes</p>
                  {phiVisible ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 leading-relaxed font-sans">
                      {selectedPatient.clinical_notes || "No clinical files recorded on ledger."}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-dotted border-slate-300 rounded-2xl text-xs font-semibold text-slate-400 italic">
                      [RESTRICTED PATIENT CLINICAL HISTORY. VERIFY DUO SECURITY CONTEXT TO DECRYPT]
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end">
                   <button 
                     onClick={() => setSelectedPatient(null)}
                     className="px-8 py-3.5 bg-slate-900 font-bold uppercase tracking-widest text-[10px] text-white rounded-xl hover:bg-slate-800 transition-colors"
                   >
                     Close Dossier
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {phiVisible && (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center gap-4 text-orange-800"
        >
            <ShieldAlert size={20} className="shrink-0" />
            <p className="text-xs font-medium leading-relaxed">
                <span className="font-bold">Active Audit:</span> Access to full patient records has triggered a "Step-Up" MFA event. Your session on the <span className="font-mono">appserver</span> is being logged for HIPAA compliance.
            </p>
        </motion.div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-md w-full space-y-6">
            <div className="flex items-center gap-3 text-red-600">
              <RotateCcw size={28} className="animate-spin-slow text-red-600" />
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Restore Baseline EHR?</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-bold">
              You are about to wipe the current clinical database and restore it to the default setup configuration. All dynamic changes, vitals, prescriptions, and custom patient records will be permanently lost.
            </p>
            <div className="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-100">
              ⚠️ WARNING: This action is destructive and cannot be undone. Active user sessions will be logged out.
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button"
                onClick={() => setShowResetConfirm(false)} 
                className="px-5 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleFactoryReset} 
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all cursor-pointer"
              >
                Confirm Factory Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Save size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-950">System Baseline Restored</h3>
            <p className="text-xs text-slate-600 font-medium">{statusMessage}</p>
            <p className="text-[10px] text-slate-400 font-mono italic">Rebooting application node...</p>
          </div>
        </div>
      )}
    </div>
  );
}
