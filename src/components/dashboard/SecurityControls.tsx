import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, Terminal, Activity, ChevronRight, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { User } from '../../types';

export default function SecurityControls({ user }: { user: User }) {
  const controls = [
    {
      id: 'duo',
      name: 'Cisco Duo',
      badge: 'Identity & Access',
      description: 'Enforcing MFA "Step-Up" for role-based access to PHI. Identity store synced with Duo Directory.',
      status: 'Protected',
      color: 'blue'
    },
    {
      id: 'sa',
      name: 'Cisco Secure Access',
      badge: 'Unified ZTNA',
      description: 'Ensuring branch connections and remote users are authenticated and postured before reaching the appserver.',
      status: 'Active',
      color: 'blue'
    },
    {
      id: 'sw',
      name: 'Cisco Secure Workload',
      badge: 'Agentic Micro-segmentation',
      description: 'Zero-trust policies between appserver, dbserver, and aibroker. Preventing lateral movement.',
      status: 'Segmented',
      color: 'green'
    },
    {
      id: 'aid',
      name: 'Cisco AI Defense',
      badge: 'Agentic Security',
      description: 'Inspecting AI prompts in aibroker for PII leakage and prompt injection. Runtime guardrails active.',
      status: 'Monitoring',
      color: 'orange'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {controls.map((control, idx) => (
          <motion.div 
            key={control.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="cisco-card p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl bg-${control.color}-50 text-cisco-${control.color === 'blue' ? 'blue' : 'green'}`}>
                        {control.id === 'duo' ? <Lock size={24} /> : control.id === 'sa' ? <Shield size={24} /> : control.id === 'sw' ? <Activity size={24} /> : <Zap size={24} />}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-1 rounded">
                        {control.badge}
                    </span>
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">{control.name}</h4>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    {control.description}
                </p>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cisco-navy">
                    <CheckCircle2 size={14} className="text-cisco-green" />
                    {control.status}
                </div>
                <button className="text-cisco-blue text-xs font-bold flex items-center gap-1 hover:underline">
                    View Policy <ChevronRight size={14} />
                </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Terminal View / Live Logs Simulation */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-slate-900/50">
            <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                    <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                </div>
                <span className="text-white/40 text-[11px] font-mono uppercase tracking-widest ml-4">
                    Distributed Workload Audit Log
                </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-green-500 font-mono font-bold tracking-tighter">LIVE BROADCAST</span>
            </div>
        </div>

        <div className="p-6 font-mono text-xs overflow-y-auto max-h-64 space-y-2 bg-slate-950/50 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
            <div className="flex gap-4">
                <span className="text-slate-500 shrink-0">19:26:40</span>
                <span className="text-red-400 shrink-0">[Duo-IAM]</span>
                <span className="text-white/90">Authentication successful for user: <span className="text-white font-bold">{user.id}</span> (Source: ZTNA Gateway)</span>
            </div>
            <div className="flex gap-4">
                <span className="text-slate-500 shrink-0">19:26:42</span>
                <span className="text-green-400 shrink-0">[Secure-Workload]</span>
                <span className="text-white/90">Allowing traffic: <span className="text-white">appserver</span> &rarr; <span className="text-white">dbserver</span> | Port 5432</span>
            </div>
            <div className="flex gap-4">
                <span className="text-slate-500 shrink-0">19:26:45</span>
                <span className="text-purple-400 shrink-0">[Secure-Access]</span>
                <span className="text-white/90">Policy Check: <span className="text-white">Source branch 'Site-A'</span> postured and authorized via App Connector.</span>
            </div>
             <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 2, repeat: Infinity, repeatType: 'reverse', duration: 1 }}
                className="flex gap-4"
            >
                <span className="text-slate-500 shrink-0">19:26:59</span>
                <span className="text-amber-400 shrink-0">[AI-Defense]</span>
                <span className="text-white/90 italic">Awaiting AI interaction from <span className="text-white">aibroker (MCP)</span>...</span>
            </motion.div>
        </div>
      </div>

      <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-6">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <AlertTriangle className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h5 className="font-bold text-amber-900 text-sm mb-1">Cisco Lab Engagement Note</h5>
            <p className="text-[12px] text-amber-800 leading-relaxed">
              Eddie, in your AWS lab, Ensure the <span className="font-bold italic underline">Cisco Secure Workload agent</span> is active on all VMs to visualize the real-time flows. These indicators demonstrate how the 3 workloads are independently secured despite being part of the same distributed app.
            </p>
          </div>
      </div>
    </div>
  );
}
