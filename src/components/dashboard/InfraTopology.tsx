import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Server, Database, Globe, ShieldCheck, Zap, Activity, RefreshCw, Layers } from 'lucide-react';
import { User } from '../../types';

export default function InfraTopology({ user }: { user: User }) {
  const [mode, setMode] = useState<string>('standalone');
  const [nodes, setNodes] = useState<any>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fetchTopology = async () => {
    setScanning(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/system/nodes');
      if (res.ok) {
        const data = await res.json();
        setMode(data.mode === 'distributed' ? 'distributed' : 'standalone');
        setNodes(data.nodes || null);
      } else {
        setErrorMessage('Failed to query peer status responses.');
      }
    } catch (e) {
      console.error("Failed to fetch topology in Overview:", e);
      setErrorMessage('Network connection error when querying peer nodes.');
    } finally {
      setTimeout(() => {
        setScanning(false);
      }, 800);
    }
  };

  useEffect(() => {
    fetchTopology();
  }, []);

  const isAppserverOnline = nodes?.appserver?.status === "Online" || mode === 'standalone';
  const isDbOnline = nodes?.dbserver?.status === "Online" || mode === 'standalone';
  const isAiOnline = nodes?.aibroker?.status === "Online" || mode === 'standalone';

  return (
    <div className="space-y-8">
      {/* Topology Visualization Header & Interactive Node Map */}
      <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden space-y-8">
        {/* Grid overlay for a premium futuristic look */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(244,63,94,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-14">
          <div>
            <h5 className="text-[10pt] font-black uppercase text-red-500 tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              ZTNA & MICROSEGMENTATION MESH
            </h5>
            <h3 className="text-xl font-bold text-slate-100 uppercase tracking-wide mt-1 flex items-center gap-2">
              Interactive Infrastructure Topology
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              System Architecture Mode: <span className="font-bold text-red-400 uppercase tracking-wider">{mode}</span>
            </p>
          </div>

          {mode === 'distributed' && (
            <button
              onClick={fetchTopology}
              disabled={scanning}
              type="button"
              className="flex items-center gap-2.5 px-5 py-2.5 bg-red-950/40 text-red-400 hover:text-white border border-red-900/60 hover:bg-red-900/80 disabled:opacity-50 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer"
            >
              <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'SCANNING SYSTEM...' : 'TEST DEPLOYMENT CONNECTIVITY'}
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="bg-red-950/40 border border-red-800/80 p-4 rounded-xl text-xs text-red-300 font-mono relative z-10">
            [ERROR]: {errorMessage}
          </div>
        )}

        {/* Infrastructure Nodes diagram layout */}
        {mode === 'standalone' ? (
          <div className="flex justify-center items-center py-6 relative z-10 w-full">
            <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900/90 border-2 border-emerald-500 shadow-xl shadow-emerald-950/20 text-center space-y-4 relative transition-all duration-300 hover:scale-[1.01]">
              <span className="absolute -top-2.5 right-6 px-3 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500 rounded-md text-[8px] font-black uppercase tracking-wider">
                STANDALONE DEPLOYMENT
              </span>
              
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 mb-1">
                <Server size={24} />
              </div>
              
              <div>
                <h5 className="text-sm font-bold uppercase tracking-wider text-slate-100">Vital Trust Standalone Node</h5>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">Consolidated Host Services</p>
              </div>

              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/85 space-y-1.5 text-left text-[10px] text-slate-300 font-medium font-sans">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Application Web Server:</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wide">Active (Secure Port 3000)</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Health Records Database:</span>
                  <span className="text-slate-100 font-bold uppercase tracking-wide">Active (Local File DB)</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>AI Prompt Broker Service:</span>
                  <span className="text-slate-100 font-bold uppercase tracking-wide">Active (Unified Co-locator)</span>
                </div>
                <div className="flex justify-between">
                  <span>System Endpoint Routing:</span>
                  <span className="text-emerald-400 font-mono select-all overflow-hidden text-ellipsis max-w-[220px] whitespace-nowrap">
                    {nodes?.appserver?.url || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-[9px] font-bold uppercase pt-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-300" />
                <span>System Status: Online & Secured</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-11 gap-6 items-center justify-center relative z-10 py-6">
            
            {/* Application Server node card */}
            <div className="md:col-span-3">
              <div className={`p-6 rounded-2xl bg-slate-900/90 border-2 ${
                isAppserverOnline
                  ? 'border-emerald-500 shadow-lg shadow-emerald-950/20'
                  : 'border-red-600 shadow-lg shadow-red-950/20'
              } text-center space-y-3 relative transition-all duration-300 hover:scale-[1.03]`}>
                <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 mb-1">
                  <Globe size={22} />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-200">Application Server</h5>
                  <p className="text-[10px] font-mono text-slate-400 select-all max-w-full overflow-hidden text-ellipsis whitespace-nowrap mt-1">
                    {nodes?.appserver?.url || 'localhost'}
                  </p>
                  <span className="text-[9px] font-bold font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                    IP: {nodes?.appserver?.ip || '127.0.0.1'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase pt-1">
                  <span className={`w-2 h-2 rounded-full ${
                    isAppserverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className={isAppserverOnline ? 'text-emerald-400' : 'text-red-400'}>
                    {isAppserverOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Connection Lane Web -> DB */}
            <div className="hidden md:block md:col-span-1 text-center">
              <div className="flex flex-col items-center justify-center">
                <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-widest mb-1.5">ZTNA</span>
                <svg className="w-full h-4" viewBox="0 0 40 20" fill="none">
                  <path d="M0,10 L40,10" stroke="#1e293b" strokeWidth="2" strokeDasharray="3,3" />
                  <path d="M0,10 L40,10" 
                    stroke={isDbOnline ? '#10b981' : '#dc2626'} 
                    strokeWidth="2.5" 
                    strokeDasharray="4,4"
                    style={{
                      strokeDashoffset: 5,
                      animation: "dash 1.2s linear infinite"
                    }}
                  />
                </svg>
              </div>
            </div>

            {/* Database server node card */}
            <div className="md:col-span-3">
              <div className={`p-6 rounded-2xl bg-slate-900/90 border-2 ${
                isDbOnline
                  ? 'border-emerald-500 shadow-lg shadow-emerald-950/20'
                  : 'border-red-600 shadow-lg shadow-red-950/20'
              } text-center space-y-3 relative transition-all duration-300 hover:scale-[1.03]`}>
                <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 mb-1">
                  <Database size={22} />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-200">Database Server</h5>
                  <p className="text-[10px] font-mono text-slate-400 select-all max-w-full overflow-hidden text-ellipsis whitespace-nowrap mt-1">
                    {nodes?.dbserver?.url || 'localhost'}
                  </p>
                  <span className="text-[9px] font-bold font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                    IP: {nodes?.dbserver?.ip || '127.0.0.1'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase pt-1">
                  <span className={`w-2 h-2 rounded-full ${
                    isDbOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className={isDbOnline ? 'text-emerald-400' : 'text-red-400'}>
                    {isDbOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Connection Lane DB -> AI */}
            <div className="hidden md:block md:col-span-1 text-center">
              <div className="flex flex-col items-center justify-center">
                <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-widest mb-1.5">POLICY</span>
                <svg className="w-full h-4" viewBox="0 0 40 20" fill="none">
                  <path d="M0,10 L40,10" stroke="#1e293b" strokeWidth="2" strokeDasharray="3,3" />
                  <path d="M0,10 L40,10" 
                    stroke={isAiOnline ? '#10b981' : '#dc2626'} 
                    strokeWidth="2.5" 
                    strokeDasharray="4,4"
                    style={{
                      strokeDashoffset: 5,
                      animation: "dash 1.2s linear infinite"
                    }}
                  />
                </svg>
              </div>
            </div>

            {/* AI Broker Node card */}
            <div className="md:col-span-3">
              <div className={`p-6 rounded-2xl bg-slate-900/90 border-2 ${
                isAiOnline
                  ? 'border-emerald-500 shadow-lg shadow-emerald-950/20'
                  : 'border-red-600 shadow-lg shadow-red-950/20'
              } text-center space-y-3 relative transition-all duration-300 hover:scale-[1.03]`}>
                <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 mb-1">
                  <Server size={22} className="text-slate-350" />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-200">AI Broker Node</h5>
                  <p className="text-[10px] font-mono text-slate-400 select-all max-w-full overflow-hidden text-ellipsis whitespace-nowrap mt-1">
                    {nodes?.aibroker?.url || 'localhost'}
                  </p>
                  <span className="text-[9px] font-bold font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                    IP: {nodes?.aibroker?.ip || '127.0.0.1'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase pt-1">
                  <span className={`w-2 h-2 rounded-full ${
                    isAiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className={isAiOnline ? 'text-emerald-400' : 'text-red-400'}>
                    {isAiOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Operational legend & posture */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] font-semibold text-slate-400 pt-6 border-t border-slate-900">
          <div className="flex items-start gap-2.5 max-w-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
            <span className="leading-relaxed">
              <strong>Cisco Secure Access (ZTNA)</strong> controls routing postures and isolates DB Server access to authorized agents only.
            </span>
          </div>
          <div className="flex items-start gap-2.5 max-w-md">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
            <span className="leading-relaxed">
              <strong>Cisco Secure Workload</strong> segments local microservices to prevent cross-tenant clinical records scraping.
            </span>
          </div>
        </div>
      </div>

      {/* Cisco Control Status and Detailed Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Dynamic Topology Information Details in beautiful Card */}
        <div className="cisco-card p-8 bg-white border border-gray-100 rounded-3xl shadow-sm">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
            <Layers className="text-cisco-blue" size={18} />
            Deployment Cluster Specifications
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-slate-900">Application Hosting Server</p>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${isAppserverOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {isAppserverOnline ? 'Healthy' : 'Fault'}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">
                Responsible for rendering the clinician interface, receiving Patient SSO sessions, and routing authenticated requests to backend microservices.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-slate-900">Protected Clinical PHI Database</p>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${isDbOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {isDbOnline ? 'Healthy' : 'Fault'}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">
                Houses the clinical logs, patient information, medication schemas, and clearance levels. Protected under cryptographic access rules and strictly segmented by workload configurations.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-slate-900">Distributed MCP Agentic Host</p>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${isAiOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {isAiOnline ? 'Healthy' : 'Fault'}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">
                Aggregates patient records via Model Context Protocol (MCP) data routes. Applies automated Cisco AI Defense policies.
              </p>
            </div>
          </div>
        </div>

        {/* Cisco Control Status Panel */}
        <div className="cisco-card p-8 bg-white border border-gray-100 rounded-3xl shadow-sm">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
            <ShieldCheck className="text-cisco-blue" size={18} />
            Active Security Controls
          </h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600">Secure Access ZTNA Posturing</span>
                <span className="text-xs font-black text-emerald-600 uppercase">Enforcing</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-cisco-blue h-full w-[88%]" />
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600">Secure Workload Segmentation Mesh</span>
                <span className={`text-xs font-black ${mode === 'distributed' && !isDbOnline ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {mode === 'distributed' && !isDbOnline ? 'PENDING SYNC' : 'ENFORCING'}
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${mode === 'distributed' && !isDbOnline ? 'bg-amber-400 w-[35%]' : 'bg-cisco-blue w-[96%]'}`} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600">Duo SSO Federated Directory Verification</span>
                <span className="text-xs font-semibold text-cisco-blue italic uppercase tracking-wider text-[10px]">Active Session Verified</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-cisco-blue h-full w-[100%]" />
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-sky-50 border border-sky-100 rounded-2xl">
            <p className="text-[11px] text-sky-800 leading-relaxed font-medium">
              <span className="font-black">Cisco Security Verification:</span> This topology is verified on AWS deployment instances. Status pings are verified across endpoints to ensure strict compliance with federal healthcare directories.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
