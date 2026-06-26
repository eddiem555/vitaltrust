import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, Smartphone, ChevronRight, Loader2, Stethoscope, Building2, UserCircle } from 'lucide-react';
import { User } from '../../types';
import { api } from '../../services/api';
import { VERSION, VERSION_DATE } from '../../version';

interface LoginProps {
  onLogin: (user: User) => void;
}

function countPasswordCharacterClasses(password: string): number {
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;
  return classes;
}

function validateBootstrapPassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (countPasswordCharacterClasses(password) < 3) {
    return "Password must include at least 3 of: lowercase, uppercase, number, symbol.";
  }
  return null;
}

export default function Login({ onLogin }: LoginProps) {
  const [showSplash, setShowSplash] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [bootstrapError, setBootstrapError] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapSuccess, setBootstrapSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.defaultPasswordConfigured === false) {
          setNeedsBootstrap(true);
        }
      })
      .catch(() => {
        setNeedsBootstrap(false);
      });
  }, []);

  useEffect(() => {
    // Splash screen disabled by default to restore original design behavior
    const timer = setTimeout(() => setShowSplash(false), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBootstrapError('');

    const policyError = validateBootstrapPassword(bootstrapPassword);
    if (policyError) {
      setBootstrapError(policyError);
      return;
    }

    setBootstrapLoading(true);
    try {
      const res = await api.bootstrapDefaultPassword(bootstrapPassword);
      if (res?.success) {
        setBootstrapSuccess(true);
        setNeedsBootstrap(false);
        setUsername('admin');
        setPassword(bootstrapPassword);
        setBootstrapPassword('');
      } else {
        setBootstrapError(res?.error || 'Failed to create default credentials.');
      }
    } catch (err: any) {
      setBootstrapError(err?.message || 'Failed to create default credentials.');
    } finally {
      setBootstrapLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await api.login(username, password);
      // Ensure we have a valid response object
      if (res && res.success) {
        onLogin(res.user);
      } else {
        setError(res?.error || "Invalid institutional credentials. Please verify your username and password.");
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Login catch:", err);
      // Better error diagnostics
      if (err.message?.includes("HTML instead of JSON") || err.message?.includes("Unexpected token")) {
        setError("Clinical authentication service returned an invalid response. Please check backend status.");
      } else if (err.message?.includes("Failed to fetch") || err.message?.includes("unreachable")) {
        setError("Clinical authentication service unreachable. Please ensure the backend is started.");
      } else if (err.message?.includes("Duo SSO")) {
        setError(err.message);
      } else {
        setError("Invalid credentials. If this is a Duo-managed account, please use the SSO button below.");
      }
      setIsLoading(false);
    }
  };

  const handleDuoLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getDuoAuthUrl();
      if (!data || !data.url) {
        throw new Error("Duo OIDC is not configured or returned an empty URL.");
      }
      
      const { url } = data;
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        url,
        'Duo Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        setError("Popup blocked. Please allow popups for Duo authentication.");
        setIsLoading(false);
      }
    } catch (err: any) {
      setError("Duo connectivity error: " + err.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin - In production you would be more strict
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        onLogin(event.data.user);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLogin]);

  if (needsBootstrap) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-red-200 shadow-xl p-10 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-[#7c1a1a] border border-red-100">
              <Shield size={28} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Create Default Credentials</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Please create a password that can be used for initial login for users in the Vital Trust local user store.
              Login with username <span className="font-bold text-slate-800">admin</span> and the password you create below.
            </p>
            <p className="text-xs text-slate-400">
              Minimum 8 characters with at least 3 character classes (lowercase, uppercase, number, symbol).
            </p>
          </div>

          <form onSubmit={handleBootstrapSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Default Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={bootstrapPassword}
                  onChange={(e) => setBootstrapPassword(e.target.value)}
                  placeholder="Create default password"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7c1a1a] focus:border-transparent outline-none transition-all text-sm font-semibold text-slate-800"
                  required
                  autoFocus
                />
              </div>
            </div>

            {bootstrapError && (
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-semibold leading-relaxed">
                <Shield className="shrink-0" size={15} />
                {bootstrapError}
              </div>
            )}

            <button
              type="submit"
              disabled={bootstrapLoading}
              className="w-full bg-[#7c1a1a] hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-red-900/10 disabled:opacity-50 active:translate-y-px text-sm"
            >
              {bootstrapLoading ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  Create Default Credentials
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center text-white p-6 overflow-hidden bg-[#7c1a1a]">
        {/* Hospital Room Background - Centered */}
        <div 
          className="absolute inset-0 opacity-30 bg-cover bg-center mix-blend-overlay"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519494140681-8917becdb8b0?q=80&w=2000&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="mb-6 mt-24 flex flex-col items-center gap-4">
             <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em]">
                POWERED BY CDW — SECURED BY CISCO
             </p>
             <img 
                src="/cdwlogo.jpg" 
                alt="CDW Logo" 
                className="h-16 w-auto object-contain rounded-xl shadow-lg border border-white/10" 
                referrerPolicy="no-referrer"
             />
             <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
               <Stethoscope className="w-10 h-10 text-white" />
             </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <h1 className="text-5xl font-bold tracking-tighter mb-2">Vital Trust EHR</h1>
            <p className="text-white/70 font-light text-xl tracking-wide uppercase">Version: {VERSION} ({VERSION_DATE})</p>
          </motion.div>
          
          <div className="mt-16 flex gap-3">
            {[0, 1, 2].map(i => (
              <motion.div 
                key={i}
                animate={{ 
                  y: [0, -10, 0],
                  opacity: [0.3, 1, 0.3],
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2, 
                  delay: i * 0.3,
                  ease: "easeInOut"
                }}
                className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              />
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-12 text-white/40 text-[11px] font-bold uppercase tracking-[0.3em] flex items-center gap-3 backdrop-blur-sm bg-white/5 py-2 px-4 rounded-full border border-white/10"
        >
           <Shield size={14} className="text-white" /> Infrastructure Secured by Cisco
        </motion.div>
      </div>
    );
  }  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-8 lg:p-12 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(#7c1a1a_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]" />
      
      {/* The Centered Login Card */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col md:flex-row overflow-hidden relative z-10 min-h-[580px] md:min-h-[620px]">
        
        {/* Left Side: Brand/Aesthetic Inside Card */}
        <div className="w-full md:w-1/2 bg-[#7c1a1a] p-8 md:p-10 lg:p-12 flex flex-col justify-between text-white relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-overlay"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519494140681-8917becdb8b0?q=80&w=2000&auto=format&fit=crop')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          
          {/* Top Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl border border-white/20">
                <Stethoscope size={22} className="text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">VitalTrust</span>
            </div>
          </div>

          {/* Middle Text */}
          <div className="relative z-10 my-auto py-10">
            <h2 className="text-2xl lg:text-3.5xl font-extrabold leading-tight tracking-tight mb-5 max-w-sm">
              Patient-Centric Care, <br />Enterprise-Grade Security.
            </h2>
            <p className="text-white/80 text-sm leading-relaxed font-normal max-w-xs">
              Connecting clinicians, patients and administrators in a secure environment.
            </p>
          </div>

          {/* Bottom Branding & Logos */}
          <div className="relative z-10 space-y-4 pt-6 border-t border-white/10">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.23em]">
              POWERED BY CDW - SECURED BY CISCO.
            </p>
            <div>
              <img 
                src="/cdwlogo.jpg" 
                alt="Partner Logo" 
                className="h-14 w-auto object-contain rounded-xl shadow-lg bg-white border border-white/10 p-0.5" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-[0.14em]">
              <Building2 size={12} />
              <span>VERSION: {VERSION} ({VERSION_DATE})</span>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-10 lg:p-12 bg-white flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-6">
              {/* Mobile Header indicator */}
              <div className="flex md:hidden items-center gap-2 mb-6 text-[#7c1a1a]">
                <div className="p-1.5 bg-red-50 rounded-lg border border-red-100">
                  <Stethoscope size={18} />
                </div>
                <span className="text-base font-bold tracking-tight">VitalTrust</span>
              </div>

              <h3 className="text-2xl lg:text-3xl font-extrabold text-slate-950 tracking-tight">Patient or Clinician Sign-In</h3>
              <p className="text-slate-500 mt-2 text-sm font-medium">
                {bootstrapSuccess
                  ? "Default credentials created. Sign in with username admin and your new password."
                  : "Please enter your institutional credentials."}
              </p>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7c1a1a] focus:border-transparent outline-none transition-all placeholder:text-slate-300 text-sm font-semibold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7c1a1a] focus:border-transparent outline-none transition-all placeholder:text-slate-300 text-sm font-semibold text-slate-800"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-semibold leading-relaxed">
                  <Shield className="shrink-0" size={15} />
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#7c1a1a] hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-red-900/10 disabled:opacity-50 active:translate-y-px mt-2 text-sm"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    Login
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6">
              <div className="flex items-center w-full gap-4 mb-4">
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Or Sign In with</span>
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <button
                 onClick={handleDuoLogin}
                 disabled={isLoading}
                 className="w-full bg-white border-2 border-[#7c1a1a] text-[#7c1a1a] hover:bg-[#7c1a1a] hover:text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2.5 transition-all group disabled:opacity-50 text-sm shadow-sm"
              >
                <Shield className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
                Cisco Duo SSO
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                <Shield size={12} className="text-slate-400" /> Secure Login Active
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
