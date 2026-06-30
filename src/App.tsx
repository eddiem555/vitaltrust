import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Activity, 
  LogOut,
  Stethoscope,
  BrainCircuit,
  Users,
  Calendar,
  ClipboardList,
  User as UserIcon,
  UserCircle,
  X,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  ChevronDown,
  Edit2,
  Save,
  RotateCcw,
  Lock,
  Settings,
  BookOpen,
  MessageSquare,
  Receipt
} from 'lucide-react';
import { User } from './types';
import { api } from './services/api';
import { VERSION, VERSION_DATE } from './version';

// Components
import Login from './components/auth/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showProfile, setShowProfile] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [systemConfig, setSystemConfig] = useState<{ mode: string; role: string } | null>(null);

  // Fetch dynamic system config to check if this node is running as a restricted child node
  useEffect(() => {
    fetch('/api/system/config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          const normalizedConfig = {
            ...data,
            role: data.role || 'standalone',
            mode: data.mode === 'distributed' ? 'distributed' : 'standalone',
          };
          setSystemConfig(normalizedConfig);
          if (normalizedConfig.mode === 'distributed' && (normalizedConfig.role === 'dbserver' || normalizedConfig.role === 'aibroker')) {
            setActiveTab('settings');
          }
        }
      })
      .catch(err => console.error("Error checking system config in App:", err));
  }, []);

  // Handle OAuth Success from Popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log("[Auth] OAuth success message received:", event.data.user);
        handleLogin(event.data.user);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [systemConfig]);

  const handleLogin = (u: User) => {
    setUser(u);
    setEditForm(u);
    setShowUserDropdown(false);
    // Set default tab based on role and partition status
    if (systemConfig && systemConfig.mode === 'distributed' && 
        (systemConfig.role === 'dbserver' || systemConfig.role === 'aibroker')) {
      setActiveTab('settings');
    } else {
      if (u.role === 'admin') setActiveTab('overview');
      else if (u.role === 'doctor') setActiveTab('summary');
      else if (u.role === 'nurse') setActiveTab('summary');
      else setActiveTab('summary');
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const res = await api.updateUserProfile({
        id: user.id,
        realName: editForm.realName || user.realName,
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address,
        npi_number: editForm.npi_number,
        assigned_ward: editForm.assigned_ward,
        clearance_level: editForm.clearance_level,
        internal_notes: editForm.internal_notes,
        ssn: editForm.ssn,
        insurance_id: editForm.insurance_id,
        clinical_notes: editForm.clinical_notes,
      });

      if (res.success) {
        setUser(res.user);
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      const res = await api.changePassword(user.id, passwordForm.old, passwordForm.new);
      if (res.success) {
        setPasswordSuccess("Password updated successfully.");
        setPasswordForm({ old: '', new: '', confirm: '' });
        setTimeout(() => setIsChangingPassword(false), 2000);
      } else {
        setPasswordError(res.error);
      }
    } catch (err) {
      setPasswordError("Failed to connect to authentication service.");
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-72 bg-[#7c1a1a] text-white flex flex-col fixed h-full z-20 shadow-2xl">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center bg-white/10 overflow-hidden">
             <div className="text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
             </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Vital Trust</h1>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none">Medical Center</p>
          </div>
        </div>

        <nav className="flex-1 mt-6 space-y-1">
          {systemConfig && systemConfig.mode === 'distributed' && 
           (systemConfig.role === 'dbserver' || systemConfig.role === 'aibroker') ? (
            <>
              <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
              <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<ClipboardList size={20} />} label="Audit Logs" />
              <NavItem active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<BookOpen size={20} />} label="Documentation" />
            </>
          ) : user.role === 'admin' ? (
            <>
              <NavItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={20} />} label="Topology" />
              <NavItem active={activeTab === 'management'} onClick={() => setActiveTab('management')} icon={<UserCircle size={20} />} label="User Management" />
              <NavItem active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<MessageSquare size={20} />} label="Messages" />
              <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<ClipboardList size={20} />} label="Audit Logs" />
              <NavItem active={activeTab === 'ai_assistant'} onClick={() => setActiveTab('ai_assistant')} icon={<BrainCircuit size={20} />} label="AI Assistant" />
              <NavItem active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<BookOpen size={20} />} label="Documentation" />
              <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
            </>
          ) : user.role === 'patient' ? (
            <>
              <NavItem active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon={<Activity size={20} />} label="My Care Plan" />
              <NavItem active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} icon={<Calendar size={20} />} label="Appointments" />
              <NavItem active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<MessageSquare size={20} />} label="Messages" />
              <NavItem active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} icon={<Receipt size={20} />} label="Billing" />
              <NavItem active={activeTab === 'ai_assistant'} onClick={() => setActiveTab('ai_assistant')} icon={<BrainCircuit size={20} />} label="AI Assistant" />
              <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<ClipboardList size={20} />} label="Audit Logs" />
              <NavItem active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<BookOpen size={20} />} label="Documentation" />
              <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
            </>
          ) : (
            <>
              <NavItem active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon={<Activity size={20} />} label="Clinical Summary" />
              <NavItem active={activeTab === 'patients'} onClick={() => setActiveTab('patients')} icon={<Users size={20} />} label="Patient Lists" />
              <NavItem active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} icon={<Calendar size={20} />} label="Appointments" />
              <NavItem active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<MessageSquare size={20} />} label="Messages" />
              <NavItem active={activeTab === 'ai_assistant'} onClick={() => setActiveTab('ai_assistant')} icon={<BrainCircuit size={20} />} label="AI Assistant" />
              <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<ClipboardList size={20} />} label="Audit Logs" />
              <NavItem active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<BookOpen size={20} />} label="Documentation" />
              <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
            </>
          )}
        </nav>

        <div className="p-8 border-t border-white/5 bg-black/20 flex flex-col items-center">
              <div className="text-xs font-semibold text-white/80 tracking-wider cursor-default">
                 Version: {VERSION} ({VERSION_DATE})
             </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-10 max-w-[1600px] mx-auto">
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Medical Environment</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clinical Center</h1>
          </div>

          <div className="flex items-center gap-6 relative">
            <img 
              src="/cdwlogo.jpg" 
              alt="Cisco Partner / CDW" 
              className="h-14 w-auto object-contain rounded-lg border border-slate-200/50 shadow-sm" 
              referrerPolicy="no-referrer"
            />
            <div className="relative">
              <button 
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-3 hover:bg-slate-100 p-2 rounded-xl transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-epic-blue flex items-center justify-center border border-white/20 shadow-md text-white">
                  <span className="text-xs font-bold uppercase">{user.realName[0]}</span>
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-bold text-slate-900 leading-none">{user.realName}</p>
                  <p className="text-[12px] text-slate-500 font-medium mt-1 leading-none">({user.id})</p>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showUserDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setShowUserDropdown(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-40 overflow-hidden"
                    >
                      <div className="p-2 space-y-1">
                        <button 
                          onClick={() => {
                            setShowProfile(true);
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left rounded-xl"
                        >
                          <UserIcon size={18} className="text-epic-blue" />
                          Profile information
                        </button>
                        <hr className="border-slate-100 mx-2" />
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors text-left rounded-xl"
                        >
                          <LogOut size={18} />
                          LOGOUT
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {systemConfig && systemConfig.mode === 'distributed' && 
         (systemConfig.role === 'dbserver' || systemConfig.role === 'aibroker') && (
          <div className="bg-amber-50 border-l-4 border-amber-600 text-amber-950 p-5 rounded-2xl mb-8 shadow-sm flex items-start gap-4">
            <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Dynamic Role Partitioning Active (ZTNA Border)</h4>
              <p className="text-xs font-medium text-amber-800 leading-relaxed">
                This Vital Trust node is running in downstream <span className="font-extrabold uppercase bg-amber-200/60 px-1.5 py-0.2 rounded font-mono text-amber-950">{systemConfig.role}</span> capacity under a Cisco Distributed Deployment. 
                GUI operations for patients, doctors, audit logs, and AI chats are dynamically compiled and restricted locally to prevent multi-cloud lateral scanning.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Dashboard 
              tab={activeTab} 
              user={user} 
            />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* User Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="absolute inset-0 bg-epic-dark/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-epic-blue text-white relative">
                <button 
                  onClick={() => setShowProfile(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
                
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-bold border border-white/20">
                    {user.realName[0]}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{user.realName}</h2>
                    <p className="text-white/60 font-medium capitalize">
                      User Role: {user.role === 'admin' ? 'Administrator' : user.role}
                    </p>
                  </div>
                </div>

                {/* Edit Toggle */}
                <button 
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                    } else {
                      setEditForm(user);
                      setIsEditing(true);
                    }
                  }}
                  className="absolute bottom-4 right-8 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all border border-white/10"
                >
                  {isEditing ? <><RotateCcw size={14} /> Cancel</> : <><Edit2 size={14} /> Edit Profile</>}
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-6 max-h-[480px] overflow-y-auto scrollbar-thin">
                {isChangingPassword ? (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Security Policy: Update Password</h3>
                      <button 
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordError('');
                          setPasswordSuccess('');
                        }}
                        className="text-xs font-bold text-epic-blue hover:underline"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Password</label>
                        <input 
                          type="password"
                          className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 bg-transparent focus:border-epic-blue outline-none py-1"
                          value={passwordForm.old}
                          onChange={(e) => setPasswordForm({...passwordForm, old: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">New Password</label>
                        <input 
                          type="password"
                          placeholder="8+ chars, A-z, 0-9, symbol"
                          className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 bg-transparent focus:border-epic-blue outline-none py-1 placeholder:text-slate-300"
                          value={passwordForm.new}
                          onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Confirm New Password</label>
                        <input 
                          type="password"
                          className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 bg-transparent focus:border-epic-blue outline-none py-1"
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                        />
                      </div>

                      {passwordError && (
                        <div className="p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-lg border border-red-100 uppercase">
                          {passwordError}
                        </div>
                      )}
                      
                      {passwordSuccess && (
                        <div className="p-3 bg-green-50 text-green-600 text-[11px] font-bold rounded-lg border border-green-100 uppercase">
                          {passwordSuccess}
                        </div>
                      )}

                      <button 
                        onClick={handlePasswordChange}
                        className="w-full py-3 bg-epic-dark text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-colors"
                      >
                        Authorize Change
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    <ProfileField icon={<UserCircle className="text-epic-blue" size={18} />} label="Username" value={user.id} />
                    
                    <div className="flex items-start gap-4">
                      <div className="mt-1"><Users className="text-epic-blue" size={18} /></div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">First Name</p>
                          {isEditing ? (
                            <input 
                              className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                              value={editForm.realName?.split(' ')[0] || ''}
                              onChange={(e) => {
                                const names = editForm.realName?.split(' ') || [];
                                const last = names.length > 1 ? names.slice(1).join(' ') : '';
                                setEditForm({...editForm, realName: `${e.target.value} ${last}`.trim()});
                              }}
                            />
                          ) : (
                            <p className="text-sm font-bold text-slate-900 leading-tight">{user.realName?.split(' ')[0] || '-'}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Name</p>
                          {isEditing ? (
                            <input 
                              className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                              value={editForm.realName?.split(' ').slice(1).join(' ') || ''}
                              onChange={(e) => {
                                const names = editForm.realName?.split(' ') || [];
                                const first = names[0] || '';
                                setEditForm({...editForm, realName: `${first} ${e.target.value}`.trim()});
                              }}
                            />
                          ) : (
                            <p className="text-sm font-bold text-slate-900 leading-tight">{user.realName?.split(' ').slice(1).join(' ') || '-'}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="mt-1"><Mail className="text-epic-blue" size={18} /></div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                        {isEditing ? (
                          <input 
                            className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                            value={editForm.email}
                            onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          />
                        ) : (
                          <p className="text-sm font-bold text-slate-900 leading-tight">{user.email || 'Not configured'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="mt-1"><Phone className="text-epic-blue" size={18} /></div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contact Number</p>
                        {isEditing ? (
                          <input 
                            className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          />
                        ) : (
                          <p className="text-sm font-bold text-slate-900 leading-tight">{user.phone || 'Not configured'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="mt-1"><MapPin className="text-epic-blue" size={18} /></div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registered Address</p>
                        {isEditing ? (
                          <textarea 
                            className="w-full text-sm font-bold text-slate-900 border-b border-slate-200 focus:border-epic-blue outline-none py-1 resize-none"
                            rows={2}
                            value={editForm.address}
                            onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                          />
                        ) : (
                          <p className="text-sm font-bold text-slate-900 leading-tight">{user.address || 'Not configured'}</p>
                        )}
                      </div>
                    </div>

                    {/* Sensitive Role-Based Fields Rendered Beneath Non-Sensitive Fields */}
                    {user.role === 'doctor' && (
                      <>
                        {isEditing ? (
                          <>
                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><Stethoscope className="text-epic-blue" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-epic-blue uppercase tracking-widest mb-1">Doctor's NPI (National Provider Identifier)</p>
                                <input 
                                  type="text"
                                  className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                                  value={editForm.npi_number || ''}
                                  onChange={(e) => setEditForm({...editForm, npi_number: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><ShieldAlert className="text-red-500" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Professional Security Notes</p>
                                <textarea 
                                  className="w-full text-xs font-mono font-bold text-slate-700 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1 resize-none"
                                  rows={3}
                                  value={editForm.internal_notes || ''}
                                  onChange={(e) => setEditForm({...editForm, internal_notes: e.target.value})}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {user.npi_number && (
                              <ProfileField 
                                icon={<Stethoscope className="text-epic-blue" size={18} />} 
                                label="NPI National Provider Identifier" 
                                value={user.npi_number} 
                              />
                            )}
                            {user.internal_notes && (
                              <div className="flex items-start gap-4 p-4 bg-red-50/50 rounded-2xl border border-red-100/60 mt-2">
                                <div className="mt-1"><ShieldAlert className="text-red-600 animate-pulse" size={18} /></div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Administrative & Security Notes</p>
                                  <p className="text-xs font-bold font-mono text-slate-700 leading-relaxed">{user.internal_notes}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {user.role === 'nurse' && (
                      <>
                        {isEditing ? (
                          <>
                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><ClipboardList className="text-epic-blue" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-epic-blue uppercase tracking-widest mb-1">Nurse's Assigned Ward</p>
                                <input 
                                  type="text"
                                  className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                                  value={editForm.assigned_ward || ''}
                                  onChange={(e) => setEditForm({...editForm, assigned_ward: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><ShieldAlert className="text-red-500" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Professional Security Notes</p>
                                <textarea 
                                  className="w-full text-xs font-mono font-bold text-slate-700 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1 resize-none"
                                  rows={3}
                                  value={editForm.internal_notes || ''}
                                  onChange={(e) => setEditForm({...editForm, internal_notes: e.target.value})}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {user.assigned_ward && (
                              <ProfileField 
                                icon={<ClipboardList className="text-epic-blue" size={18} />} 
                                label="Assigned Ward" 
                                value={user.assigned_ward} 
                              />
                            )}
                            {user.internal_notes && (
                              <div className="flex items-start gap-4 p-4 bg-red-50/50 rounded-2xl border border-red-100/60 mt-2">
                                <div className="mt-1"><ShieldAlert className="text-red-600" size={18} /></div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Administrative & Security Notes</p>
                                  <p className="text-xs font-bold font-mono text-slate-700 leading-relaxed">{user.internal_notes}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {user.role === 'admin' && (
                      <>
                        {isEditing ? (
                          <>
                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><Shield className="text-epic-blue" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-epic-blue uppercase tracking-widest mb-1">Cisco Secure Access Clearance Level</p>
                                <select 
                                  className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                                  value={editForm.clearance_level || 1}
                                  onChange={(e) => setEditForm({...editForm, clearance_level: Number(e.target.value)})}
                                >
                                  <option value={1}>Level 1 (Standard)</option>
                                  <option value={2}>Level 2 (Supervisor)</option>
                                  <option value={3}>Level 3 (Administrator)</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><ShieldAlert className="text-red-500" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Administrative Security Notes</p>
                                <textarea 
                                  className="w-full text-xs font-mono font-bold text-slate-700 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1 resize-none"
                                  rows={3}
                                  value={editForm.internal_notes || ''}
                                  onChange={(e) => setEditForm({...editForm, internal_notes: e.target.value})}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {user.clearance_level !== undefined && (
                              <ProfileField 
                                icon={<Shield className="text-red-700" size={18} />} 
                                label="Cisco Secure Access clearance" 
                                value={`Clearance Level ${user.clearance_level}`} 
                              />
                            )}
                            {user.internal_notes && (
                              <div className="flex items-start gap-4 p-4 bg-red-50/50 rounded-2xl border border-red-100/60 mt-2">
                                <div className="mt-1"><ShieldAlert className="text-red-600 animate-pulse" size={18} /></div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Administrative Security Notes</p>
                                  <p className="text-xs font-bold font-mono text-slate-700 leading-relaxed">{user.internal_notes}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {user.role === 'patient' && (
                      <>
                        {isEditing ? (
                          <>
                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><Lock className="text-amber-600" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Patient Social Security Number (SSN)</p>
                                <input 
                                  type="text"
                                  className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                                  placeholder="e.g. 000-00-0000"
                                  value={editForm.ssn || ''}
                                  onChange={(e) => setEditForm({...editForm, ssn: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><Activity className="text-emerald-600" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Patient Insurance ID Number</p>
                                <input 
                                  type="text"
                                  className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1"
                                  placeholder="e.g. BCBS-000000"
                                  value={editForm.insurance_id || ''}
                                  onChange={(e) => setEditForm({...editForm, insurance_id: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                              <div className="mt-1"><ClipboardList className="text-slate-600" size={18} /></div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Official Doctor's Clinical Notes</p>
                                <textarea 
                                  className="w-full text-xs font-bold text-slate-700 bg-transparent border-b border-slate-200 focus:border-epic-blue outline-none py-1 resize-none"
                                  rows={3}
                                  placeholder="Clinical diagnosis evaluation details..."
                                  value={editForm.clinical_notes || ''}
                                  onChange={(e) => setEditForm({...editForm, clinical_notes: e.target.value})}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {user.ssn && (
                              <ProfileField 
                                icon={<Lock className="text-amber-600" size={18} />} 
                                label="Patient Social Security Number (SSN)" 
                                value={user.ssn} 
                              />
                            )}
                            {user.insurance_id && (
                              <ProfileField 
                                icon={<Activity className="text-emerald-600" size={18} />} 
                                label="Patient Insurance ID Number" 
                                value={user.insurance_id} 
                              />
                            )}
                            {user.clinical_notes && (
                              <div className="flex items-start gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100/60 mt-2">
                                <div className="mt-1"><ClipboardList className="text-amber-700" size={18} /></div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Official Doctor's Clinical Notes</p>
                                  <p className="text-xs font-bold text-slate-700 leading-relaxed font-mono">{user.clinical_notes}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleSaveProfile}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-epic-blue text-white rounded-xl font-bold shadow-lg shadow-red-100 hover:bg-epic-dark transition-colors"
                      >
                        <Save size={18} /> Save Changes
                      </button>
                      {!isChangingPassword && (
                        <button 
                          onClick={() => setIsChangingPassword(true)}
                          className="text-[10px] font-black uppercase text-epic-blue hover:underline tracking-widest flex items-center justify-center gap-2 py-2"
                        >
                          <Lock size={12} /> Change Password
                        </button>
                      )}
                    </div>
                  ) : !isChangingPassword && (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <Shield size={12} className="text-amber-500" /> Secure Environment
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileField({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-6 py-4 transition-all relative ${
        active ? 'bg-white/5 text-cisco-blue' : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      {active && <motion.div layoutId="nav-glow" className="absolute inset-y-0 left-0 w-1 bg-cisco-blue" />}
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}
