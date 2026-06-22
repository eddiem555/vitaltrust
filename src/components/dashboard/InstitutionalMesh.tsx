import React from 'react';
import { Mail, Send, User, Clock, Shield } from 'lucide-react';

export default function InstitutionalMesh() {
  const messages = [
    { from: "Dr. Gregory House", subject: "Robert Ross: Post-Op", time: "10m ago", preview: "The patient is responding well to the non-opioid protocol..." },
    { from: "Nurse Ratched", subject: "Medication Shortage", time: "1h ago", preview: "Warning: Stock of Insulin Glargine is low in Wing B." },
    { from: "IT Security", subject: "ZTNA Update", time: "4h ago", preview: "Cisco Secure Access policies updated for high-risk PHI." }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 tracking-tight">Institutional Messaging Mesh</h3>
        <button className="px-4 py-2 bg-epic-blue text-white rounded-xl text-xs font-bold flex items-center gap-2">
           <Send size={14} /> New Encryption Mesh
        </button>
      </div>

      <div className="clinical-card divide-y divide-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className="p-6 hover:bg-slate-50 transition-all cursor-pointer flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
               <User size={20} />
            </div>
            <div className="flex-1">
               <div className="flex justify-between mb-1">
                  <p className="text-sm font-bold text-slate-900">{msg.from}</p>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> {msg.time}
                     </span>
                     <Shield size={10} className="text-green-500" />
                  </div>
               </div>
               <p className="text-xs font-bold text-epic-blue mb-1">{msg.subject}</p>
               <p className="text-xs text-slate-500 line-clamp-1">{msg.preview}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-slate-100 border border-dotted border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center opacity-60">
         <Mail size={32} className="text-slate-400 mb-2" />
         <p className="text-xs font-bold text-slate-500">End-to-End Encrypted Communication</p>
         <p className="text-[10px] text-slate-400">Policy: Local clinical mesh only. No external exfiltration allowed.</p>
      </div>
    </div>
  );
}
