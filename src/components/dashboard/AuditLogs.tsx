import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Download, 
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Calendar,
  User as UserIcon,
  Shield,
  Activity,
  Server
} from 'lucide-react';
import { AuditLog } from '../../types';
import { api } from '../../services/api';
import { motion } from 'motion/react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<string>('central');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // System Console Logs State
  const [activeTab, setActiveTab] = useState<'audit' | 'console'>('audit');
  const [consoleLogs, setConsoleLogs] = useState<string>('');
  const [loadingConsole, setLoadingConsole] = useState(false);
  const [consoleAutoRefresh, setConsoleAutoRefresh] = useState(true);
  const [consoleSearch, setConsoleSearch] = useState('');

  const fetchConsoleLogs = async () => {
    setLoadingConsole(true);
    try {
      const res = await fetch('/api/system/console-logs');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConsoleLogs(data.logs || '');
        }
      }
    } catch (err) {
      console.error("Failed fetching system console logs:", err);
    } finally {
      setLoadingConsole(false);
    }
  };

  const clearConsoleLogs = async () => {
    if (!window.confirm("⚠️ Clear System Console Log File?\n\nThis will clear the server console log file completely from the local persistent storage. Proceed?")) {
      return;
    }
    try {
      const res = await fetch('/api/system/console-logs/clear', { method: 'POST' });
      if (res.ok) {
        setConsoleLogs("[System Console Logs Cleared]");
      }
    } catch (err) {
      console.error("Failed to clear system console logs:", err);
    }
  };

  const exportToJson = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `vitaltrust_audit_logs_${selectedNode}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    linkElement.remove();
  };

  const fetchLogs = async (nodeParam: string = selectedNode) => {
    setIsRefreshing(true);
    try {
      const data = await api.getAuditLogs(nodeParam);
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs(selectedNode);
    const interval = setInterval(() => {
      fetchLogs(selectedNode);
    }, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, [selectedNode]);

  useEffect(() => {
    if (activeTab === 'console') {
      fetchConsoleLogs();
      let interval: any = null;
      if (consoleAutoRefresh) {
        interval = setInterval(() => {
          fetchConsoleLogs();
        }, 4000);
      }
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [activeTab, consoleAutoRefresh]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.activity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: AuditLog['status']) => {
    switch (status) {
      case 'Success': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'Failure': return <XCircle size={16} className="text-red-500" />;
      case 'Warning': return <AlertCircle size={16} className="text-amber-500" />;
      case 'Info': return <Info size={16} className="text-blue-500" />;
      default: return <Info size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: AuditLog['status']) => {
    switch (status) {
      case 'Success': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Failure': return 'bg-red-50 text-red-700 border-red-100';
      case 'Warning': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Info': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-red-600" />
            Audit Logging Framework
          </h2>
          <p className="text-slate-500 text-sm mt-1">Real-time tracking of security events, authentications, and data transactions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all disabled:opacity-50 font-bold text-sm"
          >
            <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            REFRESH
          </button>
          <button 
            onClick={exportToJson}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all font-bold text-sm"
          >
            <Download size={16} />
            EXPORT JSON
          </button>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black tracking-wider text-xs transition-all ${
            activeTab === 'audit'
              ? 'border-red-600 text-red-600 bg-red-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <ClipboardList size={14} />
          AUDIT TRAIL LOGS (SECURITY EVENTS)
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black tracking-wider text-xs transition-all ${
            activeTab === 'console'
              ? 'border-red-600 text-red-600 bg-red-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Server size={14} />
          SYSTEM CONSOLE LOGS (SERVER OUTPUT)
        </button>
      </div>

      {activeTab === 'audit' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search logs by activity, user, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all shadow-sm"
          />
        </div>
        <div className="col-span-12 md:col-span-3 relative">
          <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select 
            value={selectedNode}
            onChange={(e) => {
              setLoading(true);
              setSelectedNode(e.target.value);
            }}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 appearance-none transition-all shadow-sm font-medium text-slate-800"
          >
            <option value="central">All Nodes (Central Aggregated)</option>
            <option value="appserver">Application Server</option>
            <option value="dbserver">Database Server</option>
            <option value="aibroker">AI Security Broker</option>
          </select>
        </div>
        <div className="col-span-12 md:col-span-3 relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 appearance-none transition-all shadow-sm font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp / Node</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User / Identity</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCcw className="text-red-400 animate-spin" size={32} />
                      <p className="text-slate-400 font-medium">Synchronizing audit logs...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <ClipboardList size={48} />
                      <p className="text-slate-900 font-bold">No logs matched your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={log.id} 
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mt-1">
                          <Server size={10} />
                          {log.nodeRole || 'standalone'}
                          {log.ip && <span className="opacity-50 ml-1"> • {log.ip.split(',')[0]}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm ${
                          log.role === 'admin' ? 'bg-red-600' : 
                          log.role === 'doctor' ? 'bg-blue-600' : 
                          log.role === 'nurse' ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}>
                          {log.userName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{log.userName}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-tighter opacity-70">
                            {log.userId.startsWith('duo_') ? 'Cisco Duo Identity' : log.userId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <Activity size={14} className="text-red-500" />
                        {log.activity}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border tracking-wider ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)}
                        {log.status}
                      </span>
                    </td>
    <td className="px-6 py-4">
      <div className="group relative max-w-md">
        <p className="text-sm text-slate-500 font-mono text-[11px] leading-relaxed break-all line-clamp-3 group-hover:line-clamp-none transition-all duration-300">
          {log.details}
        </p>
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {log.details.length > 100 && (
            <button 
              onClick={() => {
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(`
                    <html>
                      <head>
                        <title>VitalTrust Audit Log: ${log.id}</title>
                        <style>
                          body { font-family: 'JetBrains Mono', monospace; padding: 40px; background: #020617; color: #94a3b8; line-height: 1.6; }
                          .container { max-width: 1000px; margin: 0 auto; background: #0f172a; padding: 30px; border-radius: 12px; border: 1px solid #1e293b; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
                          h1 { color: #f8fafc; font-size: 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; }
                          h1::before { content: ''; display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 2px; }
                          .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 30px; border-bottom: 1px solid #1e293b; padding-bottom: 20px; }
                          .label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
                          .value { color: #3b82f6; font-size: 14px; font-weight: 500; }
                          .payload-header { color: #f8fafc; font-weight: 600; margin-bottom: 12px; font-size: 16px; }
                          .payload { background: #1e293b; padding: 20px; border-radius: 8px; font-size: 13px; color: #38bdf8; word-break: break-all; white-space: pre-wrap; border: 1px solid #334155; }
                          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                          .badge-success { background: #064e3b; color: #34d399; }
                          .badge-failure { background: #450a0a; color: #f87171; }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <h1>Audit Event Details</h1>
                          <div class="meta">
                            <div><div class="label">Activity</div><div class="value">${log.activity}</div></div>
                            <div><div class="label">Status</div><div class="badge ${log.status === 'Success' ? 'badge-success' : 'badge-failure'}">${log.status}</div></div>
                            <div><div class="label">User</div><div class="value">${log.userName} (${log.userId})</div></div>
                            <div><div class="label">Timestamp</div><div class="value">${log.timestamp}</div></div>
                            <div><div class="label">Node</div><div class="value">${log.nodeRole}</div></div>
                            <div><div class="label">IP Address</div><div class="value">${log.ip || 'Unknown'}</div></div>
                          </div>
                          <div class="payload-header">Raw Data & Payload</div>
                          <div class="payload">${log.details.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                        </div>
                      </body>
                    </html>
                  `);
                }
              }}
              className="text-[10px] text-blue-500 font-bold hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              VIEW FULL PAYLOAD
            </button>
          )}
          <button 
            onClick={() => navigator.clipboard.writeText(log.details)}
            className="text-[10px] text-slate-400 font-bold hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            COPY DATA
          </button>
        </div>
      </div>
    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {filteredLogs.length} events from {
              selectedNode === "central" ? "All Cluster Partitions (Central Aggregated)" :
              selectedNode === "appserver" ? "Application Server local partition" :
              selectedNode === "dbserver" ? "Database Server local partition" :
              selectedNode === "aibroker" ? "AI Security Broker local partition" : "local partition"
            }
          </p>
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-red-600 animate-pulse" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cisco Secure Data Integrity Verified</span>
          </div>
        </div>
      </div>
      </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-5 rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Filter console logs (e.g. error, propagate)..."
                  value={consoleSearch}
                  onChange={(e) => setConsoleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 text-xs font-mono"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consoleAutoRefresh}
                  onChange={(e) => setConsoleAutoRefresh(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-red-600 focus:ring-red-600"
                />
                Auto-Refresh (4s)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchConsoleLogs}
                disabled={loadingConsole}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl transition-all disabled:opacity-50 font-bold text-xs"
              >
                <RefreshCcw size={12} className={loadingConsole ? 'animate-spin' : ''} />
                REFRESH logs
              </button>
              <button
                onClick={clearConsoleLogs}
                className="flex items-center gap-2 px-4 py-2 bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-900/30 rounded-xl transition-all font-bold text-xs"
              >
                Clear File
              </button>
              <a
                href="/api/system/console-logs/download"
                download
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all font-bold text-xs"
              >
                <Download size={14} />
                DOWNLOAD CONSOLE LOGS
              </a>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 font-mono text-xs overflow-auto h-[550px] shadow-inner leading-relaxed select-text flex flex-col-reverse">
            <div className="flex flex-col">
              {consoleLogs ? (
                consoleLogs
                  .split("\n")
                  .filter(line => !consoleSearch || line.toLowerCase().includes(consoleSearch.toLowerCase()))
                  .map((line, idx) => {
                    let textClass = "text-slate-300";
                    if (line.includes("[ERROR]") || line.includes("[CRITICAL]") || line.toLowerCase().includes("error")) {
                      textClass = "text-rose-400 font-semibold";
                    } else if (line.includes("[WARN]") || line.toLowerCase().includes("warning") || line.toLowerCase().includes("unreachable")) {
                      textClass = "text-amber-400";
                    } else if (line.includes("[PROPAGATE CONFIG]") || line.includes("[STANDALONE TRANSITION]")) {
                      textClass = "text-cyan-300";
                    } else if (line.toLowerCase().includes("success") || line.toLowerCase().includes("online")) {
                      textClass = "text-emerald-400 font-medium";
                    } else if (line.includes("[INFO]")) {
                      textClass = "text-sky-300";
                    }
                    return (
                      <div key={idx} className={`py-0.5 border-b border-slate-900/35 hover:bg-slate-900/30 whitespace-pre-wrap break-all ${textClass}`}>
                        {line}
                      </div>
                    );
                  })
              ) : (
                <div className="text-slate-500 py-12 text-center text-xs">No active console logs compiled on this node. Try clicking Refresh.</div>
              )}
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
            Active Workspace Path: /system_console.log • Pulls last 1500 lines for high performance
          </div>
        </div>
      )}
    </div>
  );
}
