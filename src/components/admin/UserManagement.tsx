import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  Edit2, 
  Trash2, 
  X, 
  Check,
  AlertCircle,
  Shield,
  Stethoscope,
  Activity,
  User as UserIcon,
  Save,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../services/api';

type UserRole = 'admin' | 'doctor' | 'nurse' | 'patient';

interface UserRecord {
  id: string;
  role: UserRole;
  realName: string;
  email: string;
  phone: string;
  address: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<Partial<UserRecord>>({
    id: '',
    role: 'patient',
    realName: '',
    email: '',
    phone: '',
    address: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Attempting direct purge to bypass potential iframe browser blocks on window.confirm
    try {
      console.log(`[DIRECTORY] Initiating purge for identity: ${id}`);
      await api.deleteAdminUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      setSuccess(`Identity ${id} successfully removed from directory.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error(`[DIRECTORY] Purge failed for ${id}:`, err);
      setError(err.message || "Failed to delete user identity.");
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!form.id || !form.realName || !form.role) {
      setError("Username, Real Name, and Role are required.");
      return;
    }

    try {
      if (editingUser) {
        await api.updateAdminUser(editingUser.id, form);
        setSuccess("User updated successfully.");
      } else {
        // Check for duplicate ID
        if (users.find(u => u.id === form.id)) {
          setError("Username already exists.");
          return;
        }
        await api.createAdminUser(form);
        setSuccess("User created successfully.");
      }
      fetchUsers();
      setShowModal(false);
      setEditingUser(null);
      setForm({ id: '', role: 'patient', realName: '', email: '', phone: '', address: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError("Failed to save user.");
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesSearch = u.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.realName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Shield className="text-amber-500" size={16} />;
      case 'doctor': return <Stethoscope className="text-blue-500" size={16} />;
      case 'nurse': return <Activity className="text-rose-500" size={16} />;
      case 'patient': return <UserIcon className="text-emerald-500" size={16} />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">User Management</h2>
            <p className="text-sm text-slate-500 font-medium italic">Directory of healthcare providers and patients</p>
          </div>
        </div>

        <button 
          onClick={() => {
            setEditingUser(null);
            setForm({ id: '', role: 'patient', realName: '', email: '', phone: '', address: '' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100 hover:bg-black transition-all transform hover:-translate-y-0.5"
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search by username or name..."
                className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-red-500 outline-none transition-all text-sm font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-xl">
              <Filter size={16} className="text-slate-400" />
              <select 
                className="bg-transparent border-none text-sm font-bold text-slate-600 outline-none py-1.5"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="doctor">Doctors</option>
                <option value="nurse">Nurses</option>
                <option value="patient">Patients</option>
              </select>
            </div>
          </div>
          
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {filteredUsers.length} Users Found
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User ID</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity / Role</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Information</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                    Synchronizing directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-medium italic">
                    No users matching criteria
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <motion.tr 
                    layout
                    key={user.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-8 py-4">
                      <span className="text-sm font-bold text-slate-900 font-mono tracking-tight">{user.id}</span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          user.role === 'admin' ? 'bg-amber-50' : 
                          user.role === 'doctor' ? 'bg-blue-50' : 
                          user.role === 'nurse' ? 'bg-rose-50' : 'bg-emerald-50'
                        }`}>
                          {getRoleIcon(user.role)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none mb-1">{user.realName}</p>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">{user.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                          <span className="w-1 h-1 bg-slate-300 rounded-full" /> {user.email}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400">{user.phone}</p>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingUser(user);
                            setForm(user);
                            setShowModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-10 right-10 flex items-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-2xl shadow-2xl font-bold z-50"
          >
            <Check size={20} /> {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-8 bg-slate-50 border-b border-slate-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {editingUser ? 'Policy Update: User Identity' : 'Provisioning: New Infrastructure Identity'}
                        </h2>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                          {editingUser ? `Modifying profile for ${editingUser.id}` : 'Create access credentials'}
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 flex items-center gap-3">
                      <AlertCircle size={18} /> {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Username (Primary Key)</label>
                      <input 
                        disabled={!!editingUser}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none transition-all text-sm font-bold disabled:opacity-50"
                        value={form.id}
                        onChange={(e) => setForm({...form, id: e.target.value.toLowerCase().replace(/\s/g, '')})}
                        placeholder="e.g. jdoe24"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Full Real Name</label>
                      <input 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none transition-all text-sm font-bold"
                        value={form.realName}
                        onChange={(e) => setForm({...form, realName: e.target.value})}
                        placeholder="e.g. John Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">User Identity Role</label>
                    <div className="grid grid-cols-4 gap-3">
                      {(['admin', 'doctor', 'nurse', 'patient'] as UserRole[]).map(role => (
                        <button
                          key={role}
                          type="button"
                          disabled={!!editingUser}
                          onClick={() => setForm({...form, role})}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            form.role === role 
                              ? 'bg-red-50 border-red-500 text-red-600 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                          } ${editingUser ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Email Address</label>
                      <input 
                        type="email"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none transition-all text-sm font-bold"
                        value={form.email}
                        onChange={(e) => setForm({...form, email: e.target.value})}
                        placeholder="e.g. user@hospital.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Phone Number</label>
                      <input 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none transition-all text-sm font-bold"
                        value={form.phone}
                        onChange={(e) => setForm({...form, phone: e.target.value})}
                        placeholder="555-0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Registered Address</label>
                    <textarea 
                      rows={2}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none transition-all text-sm font-bold resize-none"
                      value={form.address}
                      onChange={(e) => setForm({...form, address: e.target.value})}
                      placeholder="Street, City, State, ZIP"
                    />
                  </div>

                  {!editingUser && (
                     <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4 mt-4">
                        <AlertCircle className="text-amber-500 stroke-[3]" size={20} />
                        <div className="flex-1">
                           <p className="text-xs font-bold text-amber-900 leading-tight">Default Password Configuration</p>
                           <p className="text-[10px] font-medium text-amber-700/70 mt-1">
                             New users are assigned the global default password: <code className="font-bold bg-white/50 px-1 rounded">Ch@ngM3now</code>. 
                             They must change it upon first login for compliance.
                           </p>
                        </div>
                     </div>
                  )}
                </div>

                <div className="p-8 border-t border-slate-100 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 text-xs font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-black transition-all"
                  >
                    SAVE
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
