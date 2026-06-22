import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Activity, FileText, Calendar, Plus, Search, ChevronRight, Stethoscope, Thermometer, Heart, Wind, X, Save, Pill, UserCircle } from 'lucide-react';
import Patients from './Patients';
import InstitutionalMesh from './InstitutionalMesh';
import AuditLogs from './AuditLogs';
import AISettings from './AISettings';
import VitalTrustAIChatbot from './VitalTrustAIChatbot';
import { User, Appointment, Medication, Patient } from '../../types';
import { api } from '../../services/api';

export default function DoctorDashboard({ tab, user }: { tab: string, user: User }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientMeds, setPatientMeds] = useState<Medication[]>([]);
  const [showChart, setShowChart] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apts, pats] = await Promise.all([
          api.getAppointments({ doctorId: user.id }),
          api.getPatients()
        ]);
        setAppointments(apts);
        setPatients(pats);
      } catch (err) {
        console.error("Failed to fetch doctor dashboard data", err);
      }
    };
    fetchData();
  }, [user.id]);

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || id;
  };

  useEffect(() => {
    if (selectedPatient) {
      api.getMedications(selectedPatient.id).then(setPatientMeds);
    }
  }, [selectedPatient]);

  const handleAddMed = async () => {
    if (!selectedPatient || !newMed.name) return;
    try {
      const added = await api.addMedication({
        patientId: selectedPatient.id,
        ...newMed
      });
      setPatientMeds([...patientMeds, added]);
      setNewMed({ name: '', dosage: '', frequency: '' });
    } catch (err) {
      console.error("Failed to add medication", err);
    }
  };

  if (tab === 'patients') {
    return <Patients user={user} />;
  }

  if (tab === 'messages') {
    return <InstitutionalMesh />;
  }

  if (tab === 'ai_assistant') {
    return <VitalTrustAIChatbot key={user.id} user={user} />;
  }

  if (tab === 'logs') {
    return <AuditLogs />;
  }

  if (tab === 'settings') {
    return <AISettings user={user} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Clinical Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<Users className="text-red-700" />} label="Avg. Waiting Time" value="12m" subValue="-2m from yesterday" />
        <StatCard icon={<Activity className="text-red-600" />} label="Critical Alerts" value="03" subValue="2 active triages" />
        <StatCard icon={<Calendar className="text-purple-600" />} label="Appt. Today" value={appointments.length.toString()} subValue="Active schedule" />
        <StatCard icon={<FileText className="text-green-600" />} label="Notes Pending" value="02" subValue="Signed 12 today" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Schedule / Triage Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="clinical-card">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={18} className="text-epic-blue" />
                Active Patient Queue
              </h3>
            </div>
            <div className="p-0">
               {appointments.map(apt => (
                  <QueueItem 
                    key={apt.id}
                    name={getPatientName(apt.patientId)} 
                    time={apt.time} 
                    reason={apt.reason} 
                    status={apt.status} 
                    onClick={() => {
                        // In a real app we'd fetch the patient object here
                        api.getPatient(apt.patientId).then(p => {
                            setSelectedPatient(p);
                            setShowChart(true);
                        });
                    }}
                  />
               ))}
            </div>
          </div>
        </div>

        {/* Rapid Patient Summary */}
        <div className="space-y-6">
           <div className="clinical-card bg-white p-6">
              {selectedPatient ? (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200 overflow-hidden shadow-sm">
                      <UserCircle className="w-8 h-8 text-slate-300" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{selectedPatient.name}</h4>
                      <p className="text-xs text-slate-500 capitalize">{selectedPatient.status} | Name: {selectedPatient.name}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Vitals</p>
                    <VitalRow icon={<Heart size={14} />} label="HR" value={selectedPatient.vitals?.hr ? `${selectedPatient.vitals.hr} bpm` : '--'} status="Record" />
                    <VitalRow icon={<Thermometer size={14} />} label="Temp" value={selectedPatient.vitals?.temp ? `${selectedPatient.vitals.temp} °F` : '--'} status="Record" />
                    <VitalRow icon={<Wind size={14} />} label="BP" value={selectedPatient.vitals?.bp || '--'} status="Record" />
                  </div>

                  <button 
                    onClick={() => setShowChart(true)}
                    className="w-full mt-8 py-3 bg-red-700 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-100"
                  >
                    Open Full Chart
                  </button>
                </>
              ) : (
                <div className="py-12 text-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                      <Users size={32} />
                   </div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Patient Selected</p>
                </div>
              )}
           </div>

           <div className="p-6 bg-red-50 border border-red-100 rounded-2xl">
              <div className="flex items-center gap-2 text-red-800 font-bold text-xs mb-2">
                 <Stethoscope size={14} />
                 Clinical Decision Support
              </div>
              <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                AI-Agent (aibroker) suggests cross-referencing recent lab work before medication adjustment.
              </p>
           </div>
        </div>
      </div>

      <AnimatePresence>
          {showChart && selectedPatient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChart(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex h-[80vh] overflow-hidden">
                      <div className="w-64 bg-slate-50 border-r border-slate-100 p-6">
                          <div className="flex items-center gap-3 mb-8">
                             <div className="w-10 h-10 rounded-full bg-epic-blue flex items-center justify-center text-white font-bold">{selectedPatient.name[0]}</div>
                             <div>
                                <p className="text-sm font-bold text-slate-900">{selectedPatient.name}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{selectedPatient.id}</p>
                             </div>
                          </div>
                      </div>
                      <div className="flex-1 flex flex-col">
                          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
                              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                                  <FileText className="text-epic-blue" size={16} /> Clinical Chart
                              </h3>
                              <button onClick={() => setShowChart(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-8 space-y-8">
                              <div>
                                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                      <Pill size={18} className="text-epic-blue" /> Active Medications
                                  </h4>
                                  <div className="space-y-3">
                                      {patientMeds.map(med => (
                                          <div key={med.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center group">
                                              <div>
                                                  <p className="text-sm font-bold text-slate-800">{med.name} - {med.dosage}</p>
                                                  <p className="text-[11px] text-slate-500">{med.frequency} • {med.status || 'pending'}</p>
                                              </div>
                                              <button 
                                                onClick={async () => {
                                                   if (window.confirm('Delete this prescription?')) {
                                                       await api.deleteMedication(med.id);
                                                       setPatientMeds(patientMeds.filter(m => m.id !== med.id));
                                                   }
                                                }}
                                                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                              >
                                                  <X size={16} />
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                                  
                                  <div className="mt-6 p-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Add New Prescription</p>
                                      <div className="grid grid-cols-3 gap-4">
                                          <input placeholder="Med Name" className="bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-epic-blue" value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} />
                                          <input placeholder="Dosage" className="bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-epic-blue" value={newMed.dosage} onChange={e => setNewMed({...newMed, dosage: e.target.value})} />
                                          <input placeholder="Frequency" className="bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-epic-blue" value={newMed.frequency} onChange={e => setNewMed({...newMed, frequency: e.target.value})} />
                                      </div>
                                      <button onClick={handleAddMed} className="mt-4 w-full py-2 bg-epic-blue text-white rounded-lg text-xs font-bold hover:bg-epic-dark transition-colors flex items-center justify-center gap-2">
                                          <Plus size={14} /> SAVE
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, subValue }: any) {
  return (
    <div className="clinical-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">{icon}</div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">Live</span>
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
      <p className="text-[10px] text-slate-400 mt-2 font-medium">{subValue}</p>
    </div>
  );
}

function QueueItem({ name, time, reason, status, active, onClick }: any) {
  return (
    <div 
        onClick={onClick}
        className={`p-4 flex items-center justify-between border-b border-slate-50 transition-all hover:bg-slate-50 cursor-pointer ${active ? 'bg-red-50 border-l-4 border-l-epic-blue' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className="text-right w-16">
          <p className="text-xs font-bold text-slate-900">{time}</p>
          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">EST</p>
        </div>
        <div className="h-8 w-[1px] bg-slate-100 shrink-0" />
        <div>
          <p className="text-sm font-bold text-slate-900">Name: {name}</p>
          <p className="text-[11px] text-slate-500 font-medium">{reason}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${status === 'Waiting' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {status}
         </span>
         <ChevronRight size={14} className="text-slate-300" />
      </div>
    </div>
  );
}

function VitalRow({ icon, label, value, status, warning }: any) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-slate-500">
        <div className="p-1.5 bg-slate-50 rounded-md border border-slate-100">{icon}</div>
        <span className="text-xs font-bold uppercase tracking-tight">{label}</span>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${warning ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{status}</p>
      </div>
    </div>
  );
}
