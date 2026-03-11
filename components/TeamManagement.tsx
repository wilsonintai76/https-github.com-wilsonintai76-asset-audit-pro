
import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { User, UserRole, Department } from '../types';
import { IssueCertificateModal } from './IssueCertificateModal';
import { gateway } from '../services/dataGateway';
import { Filter, Plus, User as UserIcon, Check, X, Award, Stamp, Pencil, Trash2, Key } from 'lucide-react';

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
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ 
  users, onAddMember, onBulkAddMembers, onUpdateMember, onDeleteMember, onUpdateRoles, onUpdateStatus, currentUserRoles, departments, customConfirm, customAlert 
}) => {
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [certifyingUser, setCertifyingUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    staffId: '',
    name: '',
    email: '',
    departmentId: '',
    role: 'Staff' as UserRole,
    designation: '' as string,
    contactNumber: '',
    pin: ''
  });

  const isAdmin = currentUserRoles.includes('Admin');

  // Pending users logic
  const pendingUsers = useMemo(() => users.filter(u => u.status === 'Pending'), [users]);
  const verifiedUsers = useMemo(() => users.filter(u => u.status !== 'Pending'), [users]);

  const filteredUsers = useMemo(() => {
    return verifiedUsers.filter(u => 
      selectedDeptFilter === 'All' || u.departmentId === selectedDeptFilter
    );
  }, [verifiedUsers, selectedDeptFilter]);

  const handleVerify = async (user: User) => {
      try {
          await gateway.verifyUser(user.id);
          onUpdateMember(user.id, { isVerified: true, status: 'Active' });
      } catch (e) {
          console.error("Verification failed", e);
          alert("Failed to verify user.");
      }
  };

  const determineRoles = (primaryRole: string): UserRole[] => {
    const role = primaryRole.trim();
    switch (role) {
      case 'Admin': return ['Admin', 'Coordinator', 'Supervisor', 'Staff'];
      case 'Coordinator': return ['Coordinator', 'Supervisor', 'Staff'];
      case 'Supervisor': return ['Supervisor', 'Staff'];
      case 'Auditor': return ['Auditor', 'Staff'];
      case 'Staff': return ['Staff'];
      case 'Guest': return ['Guest'];
      default: return ['Staff'];
    }
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
          const id = row['StaffId'] || row['id'] || row['ID'];
          const name = row['Name'] || row['name'];
          const email = row['Email'] || row['email'];
          
          if (name && email && id) {
            newUsers.push({
              id,
              name, email,
              departmentId: row['Department'] || row['department'] || '',
              roles: determineRoles(row['Role'] || row['role'] || 'Staff'),
              contactNumber: row['Contact'] || row['contact'] || '',
              status: 'Active',
              lastActive: 'Just now',
              isVerified: true // Bulk import assumes trusted verification
            });
          }
        });
        if (newUsers?.length > 0) onBulkAddMembers(newUsers);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedRoles = determineRoles(formData.role);

    if (formData.pin && !/^\d{4}$/.test(formData.pin)) {
      alert("PIN must be exactly 4 digits.");
      return;
    }

    if (editingId) {
      // Editing existing user
      const updates: any = { ...formData, roles: assignedRoles };
      delete updates.staffId; // Not a column in users table (it's 'id')
      delete updates.role;    // Not a column in users table (it's 'roles')
      if (!formData.pin) delete updates.pin; // Don't overwrite with empty string if unchanged
      
      // If the user is changing a temporary ID to a real one
      if (editingId.startsWith('T-') && formData.staffId !== editingId) {
        if (!/^\d{4}$/.test(formData.staffId)) {
          alert("New Staff ID must be exactly 4 digits.");
          return;
        }
        // We need to pass the new ID to the update function
        updates.id = formData.staffId;
      }

      onUpdateMember(editingId, updates);
      setEditingId(null);
    } else {
      // Adding new user - Validate 4 digit ID or T-xxxx
      if (!/^\d{4}$/.test(formData.staffId) && !/^T-\d{4}$/.test(formData.staffId)) {
        alert("Staff ID must be exactly 4 digits (or T-xxxx for temporary).");
        return;
      }

      onAddMember({ 
        id: formData.staffId,
        name: formData.name,
        email: formData.email,
        departmentId: formData.departmentId,
        designation: formData.designation as any,
        roles: assignedRoles,
        contactNumber: formData.contactNumber,
        pin: formData.pin || '1234', // Default PIN if not provided
        status: 'Active', 
        lastActive: 'Just now',
        isVerified: true
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ staffId: '', name: '', email: '', departmentId: '', role: 'Staff', designation: '', contactNumber: '', pin: '' });
    setIsFormOpen(false);
    setEditingId(null);
  };

  const getHighestRole = (user: User): UserRole => {
    if (user.roles.includes('Admin')) return 'Admin';
    if (user.roles.includes('Coordinator')) return 'Coordinator';
    if (user.roles.includes('Supervisor')) return 'Supervisor';
    if (user.roles.includes('Auditor')) return 'Auditor';
    if (user.roles.includes('Guest')) return 'Guest';
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
      staffId: user.id, // Display ID but it will be disabled
      name: user.name,
      email: user.email,
      departmentId: user.departmentId || '',
      role: getHighestRole(user),
      designation: user.designation || '',
      contactNumber: user.contactNumber || '',
      pin: '' // Leave blank so we don't show existing PIN, only update if typed
    });
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Institutional Team</h3>
          <p className="text-sm text-slate-500">Manage credentials, certification status, and access levels.</p>
        </div>

        <div className="flex items-center gap-3">
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
      {isAdmin && pendingUsers?.length > 0 && (
          <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200">
                      <UserIcon className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-amber-800 uppercase text-xs tracking-widest">Pending Approvals ({pendingUsers?.length || 0})</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingUsers.map(user => (
                      <div key={user.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                          <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm truncate">{user.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{user.id}</span>
                                  <span className="text-[9px] text-slate-500 truncate">{user.designation} • {departments.find(d => d.id === user.departmentId)?.name || user.departmentId}</span>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              {user.id.startsWith('T-') ? (
                                <button 
                                    onClick={() => startEdit(user)}
                                    className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-all active:scale-95"
                                    title="Edit & Verify"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                              ) : (
                                <button 
                                    onClick={() => handleVerify(user)}
                                    className="w-8 h-8 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                    title="Verify User"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                              )}
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
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
             <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Staff ID</label>
              <input 
                required 
                disabled={!!editingId && !editingId.startsWith('T-')} // Only allow editing if it's a temporary ID
                placeholder="e.g. 1001"
                className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold ${!!editingId && !editingId.startsWith('T-') ? 'opacity-60 cursor-not-allowed' : ''}`}
                value={formData.staffId} 
                onChange={e => {
                    // Allow T-xxxx or digits
                    const val = e.target.value;
                    if (val.startsWith('T-')) {
                      setFormData({ ...formData, staffId: val });
                    } else {
                      const digits = val.replace(/\D/g, '').slice(0,4);
                      setFormData({ ...formData, staffId: digits });
                    }
                }} 
              />
              {editingId?.startsWith('T-') && (
                <p className="text-[9px] text-amber-600 font-bold mt-1">Please update temporary ID to a real 4-digit Staff ID.</p>
              )}
            </div>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Full Name</label>
              <input required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Email</label>
              <input required type="email" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Department</label>
              <select required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.departmentId} onChange={e => setFormData({ ...formData, departmentId: e.target.value })}>
                <option value="">Select Dept</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Designation</label>
              <select required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })}>
                <option value="">Select Designation</option>
                <option value="Head Of Department">Head Of Department</option>
                <option value="Coordinator">Coordinator</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Lecturer">Lecturer</option>
              </select>
            </div>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Role Level (RBAC)</label>
              <select required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}>
                <option value="Guest">Guest (Viewer)</option>
                <option value="Auditor">Auditor</option>
                <option value="Staff">Staff</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Coordinator">Coordinator</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Contact</label>
              <input className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.contactNumber} onChange={e => setFormData({ ...formData, contactNumber: e.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-black uppercase text-slate-400">PIN (4 Digits)</label>
              <input 
                type="password" 
                maxLength={4}
                pattern="\d{4}"
                placeholder={editingId ? "Leave blank to keep current" : "e.g. 1234"}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" 
                value={formData.pin} 
                onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0,4) })} 
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">{editingId ? 'Update' : 'Save'} Member</button>
            <button type="button" onClick={resetForm} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-24">Staff ID</th>
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
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded text-xs w-fit">{user.id}</span>
                          {user.id.startsWith('T-') && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded-md border border-amber-200 w-fit">Temp ID</span>
                          )}
                        </div>
                    </td>
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
                            <button 
                              onClick={() => {
                                customConfirm(
                                  "Reset PIN", 
                                  `Are you sure you want to reset the PIN for ${user.name} to the default (1234)?`, 
                                  () => {
                                    onUpdateMember(user.id, { pin: '1234' });
                                    customAlert(`PIN for ${user.name} has been reset to 1234.`);
                                  }
                                );
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-100 rounded-xl hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                              title="Reset PIN to Default (1234)"
                            >
                              <Key className="w-4 h-4" />
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
