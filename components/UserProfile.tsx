
import React, { useState, useMemo } from 'react';
import { User, Department } from '../types';
import { Mail, CheckCircle2, User as UserIcon, Phone, Info, Loader2, Award, AlertCircle, RotateCw, Shield, KeyRound } from 'lucide-react';

interface UserProfileProps {
  user: User;
  departments: Department[];
  onUpdate: (id: string, data: Partial<User>) => Promise<void> | void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, departments, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    contactNumber: user.contactNumber || '',
    departmentId: user.departmentId || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    
    try {
      const updates: Partial<User> = { ...formData };
      
      if (user.status === 'Pending') {
        updates.status = 'Active';
      }
      
      await onUpdate(user.id, updates);
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      // Error is handled by App.tsx showError, we just stop the saving state here
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenew = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    onUpdate(user.id, { 
      certificationIssued: today,
      certificationExpiry: nextYear.toISOString().split('T')[0] 
    });
    alert("Certification successfully self-renewed for 1 year.");
  };

  const certStatus = useMemo(() => {
    if (!user.certificationExpiry) return 'Uncertified';
    const expiry = new Date(user.certificationExpiry);
    const today = new Date();
    return expiry > today ? 'Valid' : 'Expired';
  }, [user.certificationExpiry]);

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
          <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-3xl shadow-xl">
            {user.picture ? (
              <img src={user.picture} className="w-24 h-24 rounded-2xl object-cover" alt="Profile" />
            ) : (
              <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black">
                {user.name[0]}
              </div>
            )}
          </div>
        </div>

        <div className="pt-16 pb-8 px-8">
          {user.status === 'Pending' && (
            <div className="mb-6 flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-800">Account Pending Approval</p>
                <p className="text-xs text-amber-700 mt-0.5">Your account is currently pending administrator approval. You can update your profile details in the meantime.</p>
              </div>
            </div>
          )}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900">{user.name}</h2>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <Mail className="w-3 h-3 text-blue-500" />
                {user.email}
              </p>
            </div>
            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />
              Verified Institutional Account
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Official Display Name</label>
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-colors group-focus-within:text-blue-500" />
                      <input 
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter your full legal name"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Personal Contact Number</label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-colors group-focus-within:text-blue-500" />
                      <input 
                        required
                        type="tel"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        placeholder="+1 (555) 000-0000"
                        value={formData.contactNumber}
                        onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Department</label>
                    <div className="relative group">
                      <select 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
                        value={formData.departmentId}
                        onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                      >
                        <option value="">Select Department</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-900 mb-1">Account Metadata</h4>
                    <p className="text-[10px] text-blue-700/70 leading-relaxed font-medium">
                      Assigned Department: <strong>{departments.find(d => d.id === user.departmentId)?.name || 'General'}</strong><br/>
                      Roles: <strong>{user.roles.join(', ')}</strong><br/>
                      Last Login: <strong>{user.lastActive}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-3 px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : (
                      <>Save Changes</>
                    )}
                  </button>
                  
                  {showSuccess && (
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold animate-in fade-in slide-in-from-left-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Profile updated successfully
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="space-y-6">
               {/* Certification Section */}
               <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Certification Management</h4>
                  <div className="flex flex-col gap-4">
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</p>
                       <div className="flex items-center justify-between">
                         <span className={`text-sm font-black uppercase tracking-tight ${certStatus === 'Valid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                           {certStatus}
                         </span>
                         {certStatus === 'Valid' ? <Award className="w-5 h-5 text-blue-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
                       </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Issued Date</p>
                        <p className="text-sm font-black text-slate-900 font-mono">{user.certificationIssued || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Expiry Date</p>
                        <p className="text-sm font-black text-slate-900 font-mono">{user.certificationExpiry || 'N/A'}</p>
                      </div>
                    </div>

                    <button 
                      onClick={handleRenew}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      <RotateCw className="w-4 h-4 mr-2 inline-block" />
                      Self-Renew Cert
                    </button>

                    <p className="text-[9px] text-slate-400 font-medium leading-relaxed italic text-center">
                      Manual renewal adds 1 year of validity from today.
                    </p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-md">
            <h3 className="text-xl font-bold mb-2">Institutional Security</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Certification ensures you remain compliant with JKE and Kamsis institutional inspection standards.
            </p>
          </div>
          <button className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
            Audit Logs
          </button>
        </div>
        <Shield className="absolute -right-4 -bottom-4 text-white/5 w-40 h-40 pointer-events-none" />
      </div>
    </div>
  );
};
