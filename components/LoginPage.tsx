
import React, { useState, useEffect } from 'react';
import { UserRole, Department } from '../types';
import { authService } from '../services/auth';
import { gateway } from '../services/dataGateway';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  IdCard, 
  Lock, 
  Loader2, 
  ArrowRight, 
  Shield, 
  Settings, 
  UserCheck, 
  ClipboardCheck 
} from 'lucide-react';

interface LoginPageProps {
  onGoogleLogin: () => void;
  onDemoLogin: (role: UserRole) => void;
  isLoggingIn: boolean;
  error: string | null;
  onBack: () => void;
  onLoginSuccess?: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onDemoLogin, isLoggingIn, error: propError, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'demo' | 'register'>('staff');
  
  // Staff Login State
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration State
  const [regData, setRegData] = useState({
    id: '',
    name: '',
    email: '',
    pin: '',
    departmentId: '',
    contactNumber: ''
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [regSuccess, setRegSuccess] = useState(false);

  // Demo Role State
  const [selectedRole, setSelectedRole] = useState<UserRole>('Staff');

  useEffect(() => {
    if (activeTab === 'register') {
      gateway.getDepartments().then(setDepartments).catch(console.error);
    }
  }, [activeTab]);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      const user = await authService.login(staffId, pin);
      // Save session
      localStorage.setItem('audit_pro_session', JSON.stringify(user));
      
      if (onLoginSuccess) {
        await onLoginSuccess(user);
      } else {
        window.location.reload(); 
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError(err.message || "Invalid Staff ID or PIN. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    if (!/^\d{4}$/.test(regData.id)) {
        setLoginError("Staff ID must be exactly 4 digits.");
        setIsSubmitting(false);
        return;
    }

    try {
        await authService.register(regData);
        setRegSuccess(true);
        setLoginError(null);
        setTimeout(() => {
            setRegSuccess(false);
            setActiveTab('staff');
            setStaffId(regData.id);
        }, 3000);
    } catch (err: any) {
        setLoginError("Registration failed. ID may already exist.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const roles: { id: UserRole; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'Admin', label: 'Admin', icon: Shield, desc: 'Full system access' },
    { id: 'Coordinator', label: 'Coordinator', icon: Settings, desc: 'Schedule & Locations' },
    { id: 'Supervisor', label: 'Supervisor', icon: UserCheck, desc: 'Manage Assignments' },
    { id: 'Staff', label: 'Staff', icon: ClipboardCheck, desc: 'View & Self-Assign (if certified)' },
  ];

  const displayError = propError || loginError;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[0%] left-[0%] w-[40%] h-[40%] bg-indigo-400/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="flex-grow flex items-center justify-center p-4 relative z-10">
        <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-500/30 mx-auto mb-6">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Institutional Console</h2>
              <p className="text-slate-500 text-sm">Secure Asset Audit Management System</p>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
              <button 
                onClick={() => setActiveTab('staff')}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Staff Login
              </button>
              {/* Demo Mode Disabled
              <button 
                onClick={() => setActiveTab('demo')}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'demo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Demo
              </button>
              */}
            </div>

            {displayError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-start gap-3 text-left animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div className="text-xs text-red-600 font-medium leading-relaxed">
                  {displayError}
                </div>
              </div>
            )}

            {regSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 flex items-start gap-3 text-left animate-in slide-in-from-top-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <div className="text-xs text-emerald-700 font-medium leading-relaxed">
                        Registration successful! Please wait for Admin approval. Redirecting...
                    </div>
                </div>
            )}

            {activeTab === 'staff' && (
              <div className="space-y-5">
                <form onSubmit={handleStaffLogin} className="space-y-5">
                    <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Staff ID</label>
                    <div className="relative group">
                        <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                        type="text" 
                        required
                        placeholder="e.g. 1001"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        />
                    </div>
                    </div>

                    <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Security PIN (4 Digits)</label>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                        type="password" 
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="••••"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0,4))}
                        />
                    </div>
                    </div>

                    <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-2"
                    >
                    {isSubmitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                    ) : (
                        <>Login <ArrowRight className="w-4 h-4" /></>
                    )}
                    </button>
                </form>
                
                <div className="text-center pt-2">
                    <button 
                        onClick={() => setActiveTab('register')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        New User? Register Staff Account
                    </button>
                </div>
              </div>
            )}

            {activeTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Staff ID (4 Digits)</label>
                            <input 
                                required 
                                maxLength={4}
                                pattern="\d{4}"
                                placeholder="e.g. 1001"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                                value={regData.id}
                                onChange={e => setRegData({...regData, id: e.target.value.replace(/\D/g, '').slice(0,4)})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Name</label>
                            <input 
                                required 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                value={regData.name}
                                onChange={e => setRegData({...regData, name: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Email Address</label>
                        <input 
                            required 
                            type="email"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            value={regData.email}
                            onChange={e => setRegData({...regData, email: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Department</label>
                        <select
                            required 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            value={regData.departmentId}
                            onChange={e => setRegData({...regData, departmentId: e.target.value})}
                        >
                            <option value="">Select Department</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Security PIN (4 Digits)</label>
                            <input 
                                required 
                                type="password"
                                maxLength={4}
                                pattern="\d{4}"
                                placeholder="••••"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                                value={regData.pin}
                                onChange={e => setRegData({...regData, pin: e.target.value.replace(/\D/g, '').slice(0,4)})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact</label>
                            <input 
                                required 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                value={regData.contactNumber}
                                onChange={e => setRegData({...regData, contactNumber: e.target.value})}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-70 mt-2"
                    >
                        {isSubmitting ? 'Registering...' : 'Create Account'}
                    </button>
                    
                    <button 
                        type="button"
                        onClick={() => setActiveTab('staff')}
                        className="w-full text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                        Back to Login
                    </button>
                </form>
            )}

            {activeTab === 'demo' && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center mb-2">
                   <p className="text-xs text-blue-700 font-medium">Demo Mode bypasses authentication for testing purposes.</p>
                </div>
                
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label 
                      key={role.id}
                      className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all group ${
                        selectedRole === role.id 
                          ? 'border-blue-500 bg-blue-50/50' 
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="demoRole"
                        className="sr-only"
                        checked={selectedRole === role.id}
                        onChange={() => setSelectedRole(role.id)}
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg mr-4 transition-colors ${
                        selectedRole === role.id ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                      }`}>
                        <role.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-grow">
                        <div className={`text-sm font-bold ${selectedRole === role.id ? 'text-blue-900' : 'text-slate-700'}`}>
                          {role.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {role.desc}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedRole === role.id ? 'border-blue-500' : 'border-slate-200'
                      }`}>
                        {selectedRole === role.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>}
                      </div>
                    </label>
                  ))}
                </div>

                <button 
                  onClick={() => onDemoLogin(selectedRole)}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-4"
                >
                  Enter Demo as {selectedRole}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-medium">
              Institutional Asset Audit Pro Edition v2.5
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
