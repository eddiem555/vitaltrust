import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Calendar, MessageSquare, CreditCard, ShieldCheck, Heart, Thermometer, Wind, X, Save, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import InstitutionalMesh from './InstitutionalMesh';
import VitalTrustAIChatbot from './VitalTrustAIChatbot';
import AISettings from './AISettings';
import AuditLogs from './AuditLogs';
import { User, Appointment, Medication, BillingRecord, Patient } from '../../types';
import { api } from '../../services/api';

export default function PatientDashboard({ tab, user }: { tab: string, user: User }) {
  const [activeView, setActiveView] = useState<string | null>(null);
  const [patientProfile, setPatientProfile] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [aptToCancel, setAptToCancel] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profile, meds, bills, apts, msgs, labs] = await Promise.all([
          api.getPatient(user.id),
          api.getMedications(user.id),
          api.getBilling(user.id),
          api.getAppointments({ patientId: user.id }),
          api.getMessages(user.id),
          api.getLabResults(user.id)
        ]);
        setPatientProfile(profile);
        setMedications(meds);
        setBilling(bills);
        setAppointments(apts);
        setMessages(msgs);
        setLabResults(labs);
      } catch (err) {
        console.error("Failed to fetch clinical data", err);
      }
    };
    fetchData();
  }, [user.id]);

  const handleUpdateApt = async () => {
    if (!editingApt) return;
    try {
      const updated = await api.updateAppointment(editingApt.id, {
        date: editingApt.date,
        time: editingApt.time
      });
      setAppointments(appointments.map(a => a.id === updated.id ? updated : a));
      setEditingApt(null);
    } catch (err) {
      console.error("Failed to update appointment", err);
    }
  };

  const handleDeleteApt = async (id: string) => {
    try {
      await api.deleteAppointment(id);
      setAppointments(appointments.filter(a => a.id !== id));
    } catch (err) {
      console.error("Failed to cancel appointment", err);
    }
  };

  if (tab === 'messages') {
    return <InstitutionalMesh />;
  }

  if (tab === 'ai_assistant') {
    return <VitalTrustAIChatbot key={user.id} user={user} />;
  }

  if (tab === 'settings') {
    return <AISettings user={user} />;
  }

  if (tab === 'logs') {
    return <AuditLogs />;
  }

  if (tab === 'appointments') {
      return (
          <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-800">My Appointments</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {appointments.map(apt => (
                      <div key={apt.id} className="clinical-card p-6 border-l-4 border-l-epic-blue">
                          <div className="flex justify-between items-start mb-4">
                             <div className="p-2 bg-red-50 rounded-lg text-epic-blue">
                                <Calendar size={20} />
                             </div>
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${apt.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                {apt.status}
                             </span>
                          </div>
                          <p className="font-bold text-slate-900">{apt.reason}</p>
                          <p className="text-sm text-slate-500 mt-1">{apt.date} at {apt.time}</p>
                          <div className="flex gap-4 mt-4">
                            <button 
                              onClick={() => setEditingApt(apt)}
                              className="text-xs font-bold text-epic-blue hover:underline flex items-center gap-1"
                            >
                              Reschedule <ChevronRight size={14} />
                            </button>
                            <button 
                              onClick={() => setAptToCancel(apt.id)}
                              className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              Cancel <X size={14} />
                            </button>
                          </div>
                      </div>
                  ))}
              </div>

              <AnimatePresence>
                  {editingApt && (
                      <Modal title="Reschedule Appointment" onClose={() => setEditingApt(null)}>
                          <div className="space-y-4 p-6">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">New Date</label>
                                  <input 
                                    type="date"
                                    className="w-full border-b border-slate-200 py-2 outline-none focus:border-epic-blue text-sm font-bold"
                                    value={editingApt.date}
                                    onChange={(e) => setEditingApt({...editingApt, date: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">New Time</label>
                                  <input 
                                    type="text"
                                    className="w-full border-b border-slate-200 py-2 outline-none focus:border-epic-blue text-sm font-bold"
                                    value={editingApt.time}
                                    onChange={(e) => setEditingApt({...editingApt, time: e.target.value})}
                                    placeholder="e.g. 10:30 AM"
                                  />
                              </div>
                              <button 
                                onClick={handleUpdateApt}
                                className="w-full py-3 bg-epic-blue text-white rounded-xl font-bold text-sm shadow-lg shadow-red-100 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                              >
                                <Save size={18} /> SAVE
                              </button>
                          </div>
                      </Modal>
                  )}

                  {aptToCancel && (
                      <Modal title="Cancel Scheduled Appointment" onClose={() => setAptToCancel(null)}>
                          <div className="p-8 space-y-6 text-center">
                              <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 border border-red-100">
                                  <X size={28} />
                              </div>
                              <div className="space-y-2">
                                  <h4 className="text-lg font-bold text-slate-900">Are you absolutely sure?</h4>
                                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                                      This scheduled consultation will be immediately released from your electronic health record. This action cannot be reversed.
                                  </p>
                              </div>
                              <div className="flex gap-3 justify-center pt-2">
                                  <button 
                                      type="button"
                                      onClick={() => setAptToCancel(null)} 
                                      className="px-5 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer animate-pulse-slow"
                                  >
                                      No, Keep It
                                  </button>
                                  <button 
                                      type="button"
                                      onClick={async () => {
                                          await handleDeleteApt(aptToCancel);
                                          setAptToCancel(null);
                                      }} 
                                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all cursor-pointer"
                                  >
                                      Yes, Cancel Appointment
                                  </button>
                              </div>
                          </div>
                      </Modal>
                  )}
              </AnimatePresence>
          </div>
      )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-[#7c1a1a] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-red-900/10">
         <div className="absolute top-0 right-0 w-[400px] h-full opacity-10 pointer-events-none translate-x-20">
            <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
              <path d="M100 170c-15-15-80-60-80-100a40 40 0 0 1 80-15 40 40 0 0 1 80 15c0 40-65 85-80 100Z" stroke="white" strokeWidth="2" />
            </svg>
         </div>
         <div className="relative z-10">
            <h3 className="text-3xl font-bold mb-3 tracking-tight">Hello, {user.realName}!</h3>
            <p className="text-white/80 max-w-md text-lg leading-relaxed font-medium">
                Your medical records are secured by Vital Trust. Case Status: <span className="font-bold uppercase">{patientProfile?.status || 'Active'}</span>
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         <div className="xl:col-span-2 space-y-6">
            <h4 className="font-bold text-slate-800 text-lg tracking-tight">My Health Record</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {[
                 { id: 'records', label: 'Lab Results', desc: labResults.length > 0 ? `View ${labResults.length} test results` : 'No results found', icon: <FileText className="text-red-600" />, iconBg: 'bg-red-50' },
                 { id: 'medications', label: 'Medications', desc: `${medications.length} active prescriptions`, icon: <Calendar className="text-indigo-600" />, iconBg: 'bg-indigo-50' },
                 { id: 'messages', label: 'Messages', desc: messages.length > 0 ? `${messages.length} secure messages` : 'No messages', icon: <MessageSquare className="text-emerald-600" />, iconBg: 'bg-emerald-50' },
                 { id: 'billing', label: 'Billing', desc: `Balance: $${billing.reduce((acc, b) => b.status !== 'paid' ? acc + b.amount : acc, 0).toFixed(2)}`, icon: <CreditCard className="text-amber-600" />, iconBg: 'bg-amber-50' },
               ].map((card) => (
                 <div 
                   key={card.id}
                   onClick={() => setActiveView(card.id as any)}
                   className="group p-6 bg-white border border-slate-100 rounded-3xl transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 cursor-pointer"
                 >
                   <div className={`w-12 h-12 ${card.iconBg} rounded-2xl flex items-center justify-center mb-6`}>
                     {card.icon}
                   </div>
                   <h5 className="font-bold text-slate-800 text-base mb-1">{card.label}</h5>
                   <p className="text-sm text-slate-500 font-medium">{card.desc}</p>
                 </div>
               ))}
            </div>

            <div className="bg-white border border-slate-200/60 rounded-3xl p-8 mt-8">
               <h5 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <ShieldCheck size={18} className="text-emerald-500" />
                 SafeAccess Logs
               </h5>
               <div className="space-y-4">
                  <LogEvent time="Today, 08:42 AM" event="Record Access" location="Main Clinic (appserver)" />
                  <LogEvent time="Yesterday, 02:15 PM" event="Medication Refill" location="Pharmacy Portal" />
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full">
                <h4 className="font-bold text-lg text-slate-800 mb-8 tracking-tight">Clinical Vitals</h4>
                <div className="space-y-10">
                    <VitalItem label="Weight" value="184 lbs" date="Today" />
                    <VitalItem label="Heart Rate" value={patientProfile?.vitals?.hr ? `${patientProfile.vitals.hr} BPM` : '--'} date={patientProfile?.vitals?.lastUpdated || "N/A"} />
                    <VitalItem label="Blood Pressure" value={patientProfile?.vitals?.bp || '120/80'} date={patientProfile?.vitals?.lastUpdated || "N/A"} />
                </div>
            </div>
         </div>
      </div>

      <AnimatePresence>
          {activeView === 'medications' && (
              <Modal title="Prescription History" onClose={() => setActiveView(null)}>
                  <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                      {medications.map(med => (
                          <div key={med.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                              <div>
                                <p className="font-bold text-slate-900">{med.name} <span className="text-xs font-normal text-slate-500">({med.dosage})</span></p>
                                <p className="text-xs text-slate-600 mt-1">{med.frequency}</p>
                                <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-tighter">Started: {med.startDate}</p>
                              </div>
                              <div className={`px-2 py-1 rounded text-[10px] font-black uppercase border flex items-center gap-1 ${med.status === 'administered' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                 {med.status === 'administered' && <CheckCircle2 size={10} />}
                                 {med.status || 'Pending'}
                              </div>
                          </div>
                      ))}
                      <p className="text-[10px] text-slate-400 italic text-center pt-4">Read-only view. Contact nursing for administration updates.</p>
                  </div>
              </Modal>
          )}

          {activeView === 'records' && (
              <Modal title="Lab Results" onClose={() => setActiveView(null)}>
                  <div className="p-6 space-y-4">
                      {labResults.length > 0 ? labResults.map(lab => (
                          <div key={lab.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex justify-between items-start mb-2">
                                  <p className="font-bold text-slate-900">{lab.testName}</p>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lab.date}</span>
                              </div>
                              <p className="text-xs font-bold text-red-600 mb-1">Result: {lab.result}</p>
                              <p className="text-xs text-slate-600">{lab.notes}</p>
                          </div>
                      )) : (
                          <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                             <p className="text-sm font-medium text-slate-500">No lab results available for this patient.</p>
                          </div>
                      )}
                  </div>
              </Modal>
          )}

          {activeView === 'messages' && (
              <Modal title="Messages" onClose={() => setActiveView(null)}>
                  <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                      {messages.length > 0 ? messages.map(msg => (
                          <div key={msg.id} className={`p-4 rounded-xl border ${msg.senderId === user.id ? 'bg-red-50 border-red-100 ml-8' : 'bg-slate-50 border-slate-100 mr-8'}`}>
                              <div className="flex justify-between items-center mb-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{msg.senderId}</p>
                                  <p className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleDateString()}</p>
                              </div>
                              <p className="text-sm font-medium text-slate-800 leading-relaxed">{msg.content}</p>
                          </div>
                      )) : (
                          <div className="py-12 text-center flex flex-col items-center gap-4">
                             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                <MessageSquare size={32} />
                             </div>
                             <div className="space-y-1">
                                <p className="text-base font-bold text-slate-800">No Messages</p>
                                <p className="text-xs text-slate-500 font-medium italic">Contact your care team via clinical messaging</p>
                             </div>
                          </div>
                      )}
                  </div>
              </Modal>
          )}

          {activeView === 'billing' && (
              <Modal title="Billing History" onClose={() => setActiveView(null)}>
                  <div className="p-6 space-y-4">
                      {billing.map(bill => (
                          <div key={bill.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                  <p className="font-bold text-slate-900 text-sm">{bill.description}</p>
                                  <p className="text-[10px] text-slate-500 uppercase font-bold">{bill.date}</p>
                              </div>
                              <div className="text-right">
                                  <p className="font-bold text-slate-900">${bill.amount.toFixed(2)}</p>
                                  <span className={`text-[10px] font-bold uppercase ${bill.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                                      {bill.status}
                                  </span>
                              </div>
                          </div>
                      ))}
                  </div>
              </Modal>
          )}

          {aptToCancel && (
              <Modal title="Cancel Scheduled Appointment" onClose={() => setAptToCancel(null)}>
                  <div className="p-8 space-y-6 text-center">
                      <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 border border-red-100">
                          <X size={28} />
                      </div>
                      <div className="space-y-2">
                          <h4 className="text-lg font-bold text-slate-900">Are you absolutely sure?</h4>
                          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                              This scheduled consultation will be immediately released from your electronic health record. This action cannot be reversed.
                          </p>
                      </div>
                      <div className="flex gap-3 justify-center pt-2">
                          <button 
                              type="button"
                              onClick={() => setAptToCancel(null)} 
                              className="px-5 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer animate-pulse-slow"
                          >
                              No, Keep It
                          </button>
                          <button 
                              type="button"
                              onClick={async () => {
                                  await handleDeleteApt(aptToCancel);
                                  setAptToCancel(null);
                              }} 
                              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all cursor-pointer"
                          >
                              Yes, Cancel Appointment
                          </button>
                      </div>
                  </div>
              </Modal>
          )}
      </AnimatePresence>
    </div>
  );
}

function LogEvent({ time, event, location }: any) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-slate-50">
            <div>
                <p className="text-xs font-bold text-slate-800">{event}</p>
                <p className="text-[10px] text-slate-500">{location}</p>
            </div>
            <span className="text-[10px] font-medium text-slate-400">{time}</span>
        </div>
    )
}

function VitalItem({ label, value, date }: any) {
    return (
        <div className="flex items-end justify-between border-b border-slate-50 pb-4">
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{date}</span>
        </div>
    )
}

function Modal({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 tracking-tight">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>
                {children}
            </motion.div>
        </div>
    )
}

function PatientActionCard({ icon, label, description, onClick }: any) {
    return (
        <div 
            onClick={onClick}
            className="clinical-card p-5 border-l-4 border-l-transparent hover:border-l-epic-blue hover:shadow-md transition-all cursor-pointer group"
        >
            <div className="p-2 bg-slate-50 w-fit rounded-lg mb-4 group-hover:bg-red-50 transition-colors">{icon}</div>
            <p className="font-bold text-slate-900 text-sm mb-1">{label}</p>
            <p className="text-xs text-slate-500">{description}</p>
        </div>
    )
}
