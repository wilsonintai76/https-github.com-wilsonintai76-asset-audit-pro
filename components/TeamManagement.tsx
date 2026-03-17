
import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { User, UserRole, Department } from '../types';
import { IssueCertificateModal } from './IssueCertificateModal';
import { gateway } from '../services/dataGateway';
import { Filter, Plus, User as UserIcon, Check, X, Award, Stamp, Pencil, Trash2, Key, ChevronDown } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { AuditPhase } from '../types';

interface TeamManagementProps {
  users: User[];
  onAddMember: (user: User) => void;
  onBulkAddMembers: (users: User[]) => void;
  onUpdateMember: (id: string, user: Partial<User>) => void;
  onDeleteMember: (id: string) => void;
  onUpdateRoles: (userId: string, newRoles: UserRole[]) => void;
  onUpdateStatus: (userId: string, status: 'Active' | 'Inactive' | 'Suspended' | 'Pending') => void;
  currentUserRoles: UserRole[];
  departments: Department[];
  customConfirm: (title: string, message: string, onConfirm: () => void, isDestructive?: boolean) => void;
  customAlert: (message: string) => void;
  phases?: AuditPhase[];
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ 
  users, onAddMember, onBulkAddMembers, onUpdateMember, onDeleteMember, onUpdateRoles, onUpdateStatus, currentUserRoles, departments, customConfirm, customAlert, phases = [] 
}) => {
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [certifyingUser, setCertifyingUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    departmentId: '',
    roles: ['Staff'] as UserRole[],
    designation: '' as string,
    contactNumber: ''
  });

  const isAdmin = currentUserRoles.includes('Admin');

  // Pending users logic
  const pendingUsers = useMemo(() => {
    return users.filter(u => u.status === 'Pending')
      .filter(u => selectedDeptFilter === 'All' || u.departmentId === selectedDeptFilter);
  }, [users, selectedDeptFilter]);

  const filteredUsers = useMemo(() => {
    return users
      .filter(u => selectedStatusFilter === 'Pending' ? u.status === 'Pending' : u.status !== 'Pending')
      .filter(u => selectedStatusFilter !== 'All' && selectedStatusFilter !== 'Pending' ? u.status === selectedStatusFilter : true)
      .filter(u => selectedDeptFilter === 'All' || u.departmentId === selectedDeptFilter);
  }, [users, selectedDeptFilter, selectedStatusFilter]);

  const handleVerify = async (user: User) => {
      try {
          await gateway.verifyUser(user.id);
          onUpdateMember(user.id, { isVerified: true, status: 'Active' });
      } catch (e) {
          console.error("Verification failed", e);
          alert("Failed to verify user.");
      }
  };

  const handleApproveAll = async () => {
    for (const user of pendingUsers) {
      try {
        await gateway.verifyUser(user.id);
        onUpdateMember(user.id, { isVerified: true, status: 'Active' });
      } catch (e) {
        console.error(`Failed to approve ${user.name}`, e);
      }
    }
  };

  const toggleRole = (role: UserRole) => {
    setFormData(prev => {
      const isSelected = prev.roles.includes(role);
      let newRoles: UserRole[];
      
      if (isSelected) {
        // Don't allow removing the last role
        if (prev.roles.length <= 1) return prev;
        newRoles = prev.roles.filter(r => r !== role);
      } else {
        newRoles = [...prev.roles, role];
      }
      
      return { ...prev, roles: newRoles };
    });
  };

  const getCertStatus = (expiry?: string) => {
    if (!expiry) return { label: 'None', color: 'bg-slate-100 text-slate-400' };
    const diff = new Date(expiry).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: 'Expired', color: 'bg-rose-100 text-rose-600 border-rose-200' };
    if (days <= 30) return { label: `${days}d Left`, color: 'bg-amber-100 text-amber-600 border-amber-200' };
    return { label: 'Valid', color: 'bg-blue-100 text-blue-600 border-blue-200' };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newUsers: User[] = [];
        results.data.forEach((row: any) => {
          const id = row['StaffId'] || row['id'] || row['ID'] || crypto.randomUUID();
          const name = row['Name'] || row['name'];
          const email = row['Email'] || row['email'];
          
          if (name && email) {
            newUsers.push({
              id,
              name, email,
              departmentId: row['Department'] || row['department'] || '',
              roles: (row['Role'] || row['role'] || 'Staff').split(',').map((r: string) => r.trim() as UserRole).filter(r => ['Admin', 'Coordinator', 'Supervisor', 'Staff'].includes(r)),
              contactNumber: row['Contact'] || row['contact'] || '',
              status: 'Active',
              lastActive: new Date().toISOString(),
              isVerified: true 
            });
          }
        });
        if (newUsers?.length > 0) onBulkAddMembers(newUsers);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedRoles = formData.roles;

    if (editingId) {
      // Editing existing user
      // Pass the current state to ensure email is included for the gateway fallback logic
      const currentUserState = users.find(u => u.id === editingId);
      onUpdateMember(editingId, { ...formData, email: formData.email || currentUserState?.email });
      setEditingId(null);
    } else {
      onAddMember({ 
        id: crypto.randomUUID(), // This will be overwritten by Supabase if registering, but for local state it needs an ID
        name: formData.name,
        email: formData.email,
        departmentId: formData.departmentId,
        designation: formData.designation as any,
        roles: assignedRoles,
        contactNumber: formData.contactNumber,
        status: 'Active', 
        lastActive: new Date().toISOString(),
        isVerified: true
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', departmentId: '', roles: ['Staff'], designation: '', contactNumber: '' });
    setIsFormOpen(false);
    setEditingId(null);
  };

  const getHighestRole = (user: User): UserRole => {
    if (user.roles.includes('Admin')) return 'Admin';
    if (user.roles.includes('Coordinator')) return 'Coordinator';
    if (user.roles.includes('Supervisor')) return 'Supervisor';
    return 'Staff';
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch(role) {
      case 'Admin': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Coordinator': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Supervisor': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      departmentId: user.departmentId || '',
      roles: user.roles || ['Staff'],
      designation: user.designation || '',
      contactNumber: user.contactNumber || ''
    });
    setIsFormOpen(true);
  };

  const activePhase = useMemo(() => {
    const today = new Date();
    return (phases || []).find(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [phases]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        icon={UserIcon}
        activePhase={activePhase}
        description="Manage user access, roles, and institutional certification status."
      />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Institutional Team</h3>
          <p className="text-sm text-slate-500">Manage credentials, certification status, and access levels.</p>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 w-fit">
            <Key className="w-3 h-3" />
            <span>Login accounts are automatically created upon first Google sign-in.</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm appearance-none outline-none"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
              <option value="Suspended">Suspended</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
          </div>

          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm appearance-none outline-none"
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
          </div>
          
          {isAdmin && (
            <button 
              onClick={() => { resetForm(); setIsFormOpen(true); }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Member
            </button>
          )}
        </div>
      </div>

      {/* Pending Approvals Section for Admins */}
      {isAdmin && pendingUsers?.length > 0 && selectedStatusFilter !== 'Pending' && (
          <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200">
                      <UserIcon className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-amber-800 uppercase text-xs tracking-widest">Pending Approvals ({pendingUsers?.length || 0})</h4>
                  <button
                    onClick={handleApproveAll}
                    className="ml-auto px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />Approve All
                  </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingUsers.map(user => (
                      <div key={user.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                          <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm truncate">{user.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-slate-500 truncate">{user.designation} • {departments.find(d => d.id === user.departmentId)?.name || user.departmentId}</span>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => startEdit(user)}
                                  className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-all active:scale-95"
                                  title="Edit & Verify"
                              >
                                  <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                  onClick={() => handleVerify(user)}
                                  className="w-8 h-8 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                  title="Verify User"
                              >
                                  <Check className="w-4 h-4" />
                              </button>
                              <button 
                                  onClick={() => onDeleteMember(user.id)}
                                  className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all active:scale-95"
                                  title="Reject"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-blue-600 p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{editingId ? 'Edit Team Member' : 'New Member'}</h3>
                  <p className="text-blue-100 text-xs mt-0.5">Manage institutional credentials and access levels.</p>
                </div>
              </div>
              <button 
                onClick={resetForm}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="member-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Full Name</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Email</label>
                    <input required type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Department</label>
                    <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.departmentId} onChange={e => setFormData({ ...formData, departmentId: e.target.value })}>
                      <option value="">Select Dept</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Designation</label>
                    <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })}>
                      <option value="">Select Designation</option>
                      <option value="Head Of Department">Head Of Department</option>
                      <option value="Coordinator">Coordinator</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Administrative Roles (RBAC)</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-2">
                      {(['Admin', 'Coordinator', 'Supervisor', 'Staff'] as UserRole[]).map((r) => (
                        <label key={r} className={`flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                          formData.roles.includes(r) 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                            checked={formData.roles.includes(r)}
                            onChange={() => toggleRole(r)}
                          />
                          <span className="text-xs font-bold">{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Contact</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.contactNumber} onChange={e => setFormData({ ...formData, contactNumber: e.target.value })} />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end items-center">
              <button 
                type="button" 
                onClick={resetForm} 
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="member-form"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all text-center"
              >
                {editingId ? 'Update' : 'Save'} Member
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Team Member</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Certification</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(user => {
                const highestRole = getHighestRole(user);
                const cert = getCertStatus(user.certificationExpiry);
                
                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black border border-slate-200">
                          {user.name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{user.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                             <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getRoleBadgeStyle(highestRole)}`}>
                               {highestRole}
                             </span>
                             <span className="text-[9px] text-slate-400 font-bold uppercase">{user.designation}</span>
                             <span className="text-[9px] text-slate-400 font-bold uppercase">•</span>
                             <span className="text-[9px] text-slate-400 font-bold uppercase">{departments.find(d => d.id === user.departmentId)?.name || user.departmentId}</span>
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className={`inline-flex flex-col gap-1`}>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase border w-fit ${cert.color}`}>
                             <Award className="w-3 h-3" />
                             {cert.label}
                          </div>
                          {user.certificationIssued && (
                            <span className="text-[8px] text-slate-400 font-bold ml-1">Issued: {user.certificationIssued}</span>
                          )}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => setCertifyingUser(user)}
                              className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              title="Issue Official Institutional Certificate"
                            >
                              <Stamp className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => startEdit(user)}
                              className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => onDeleteMember(user.id)}
                              className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-600 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {certifyingUser && (
        <IssueCertificateModal 
          user={certifyingUser}
          onClose={() => setCertifyingUser(null)}
          onIssue={(issued, expiry) => {
            onUpdateMember(certifyingUser.id, { 
              certificationIssued: issued,
              certificationExpiry: expiry 
            });
            setCertifyingUser(null);
          }}
        />
      )}
    </div>
  );
};
