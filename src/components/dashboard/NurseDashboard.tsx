import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Pill, ClipboardList, Clock, Search, ChevronRight, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import Patients from './Patients';
import InstitutionalMesh from './InstitutionalMesh';
import AuditLogs from './AuditLogs';
import AISettings from './AISettings';
import VitalTrustAIChatbot from './VitalTrustAIChatbot';
import { User, Medication, Patient } from '../../types';
import { api } from '../../services/api';

export default function NurseDashboard({ tab, user }: { tab: string, user: User }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMeds = async () => {
      setIsLoading(true);
      try {
        const [medReq, patReq] = await Promise.all([
          api.getMedications(''),
          api.getPatients()
        ]);
        setMedications(medReq);
        setPatients(patReq);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeds();
  }, []);

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || id;
  };

  const handleToggleMed = async (medId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'administered' ? 'pending' : 'administered';
    try {
      const updated = await api.updateMedicationStatus(medId, newStatus);
      setMedications(prev => prev.map(m => m.id === medId ? updated : m));
    } catch (err) {
      console.error(err);
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

  const medsDue = medications.filter(m => m.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="clinical-card p-6 border-l-4 border-l-red-500">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Pending Triage</h4>
            <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-slate-900">05</span>
                <AlertCircle className="text-red-500" />
            </div>
         </div>
         <div className="clinical-card p-6 border-l-4 border-l-epic-blue">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Meds Due Now</h4>
            <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-slate-900">{medsDue || '12'}</span>
                <Pill className="text-epic-blue" />
            </div>
         </div>
         <div className="clinical-card p-6 border-l-4 border-l-green-500">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Discharged (24h)</h4>
            <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-slate-900">08</span>
                <ClipboardList className="text-green-500" />
            </div>
         </div>
      </div>

      <div className="clinical-card">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock size={18} className="text-epic-blue" />
                Medication Administration Record (MAR)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Shift: {user.realName}</span>
         </div>
         <div className="divide-y divide-slate-50">
             {isLoading ? (
                <div className="p-12 text-center text-slate-400 text-sm">Loading administration records...</div>
             ) : medications.length > 0 ? (
                medications.slice(0, 10).map(med => (
                   <MarItem 
                      key={med.id}
                      patient={getPatientName(med.patientId)} 
                      med={med.name} 
                      dose={med.dosage} 
                      time={med.frequency} 
                      status={med.status}
                      onToggle={() => handleToggleMed(med.id, med.status)}
                   />
                ))
             ) : (
                <div className="p-12 text-center text-slate-400 text-sm">No scheduled medications for this unit.</div>
             )}
         </div>
      </div>
    </div>
  );
}

function MarItem({ patient, med, dose, time, status, onToggle }: any) {
    const isPending = status === 'pending';
    return (
        <div className={`p-4 flex items-center justify-between transition-colors hover:bg-slate-50 ${isPending ? 'bg-amber-50/10' : ''}`}>
            <div className="flex items-center gap-6">
                <div className="w-12 text-center">
                    <p className="text-xs font-bold text-slate-900">{time === 'Once daily' ? '09:00 AM' : 'Due Now'}</p>
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-900">Name: {patient}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{med} — {dose}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${!isPending ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                    {status}
                </div>
                <button 
                  onClick={onToggle}
                  className={`p-2 rounded-lg transition-all ${!isPending ? 'bg-slate-100 text-slate-400' : 'bg-epic-blue text-white shadow-lg shadow-red-100 hover:bg-epic-dark'}`}
                >
                    {isPending ? <CheckCircle2 size={18} /> : <RotateCcw size={18} />}
                </button>
            </div>
        </div>
    )
}
