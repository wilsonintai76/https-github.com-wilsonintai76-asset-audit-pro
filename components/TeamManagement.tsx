
import React, { useState, useMemo, useRef } from 'react';
import { User, UserRole } from '../types';
import Papa from 'papaparse';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { ConfirmationModal } from './ConfirmationModal';

interface MemberModalProps {
  user?: User;
  onClose: () => void;
  onSave: (userData: any) => void;
  departments: string[];
}

const MemberModal: React.FC<MemberModalProps> = ({ user, onClose, onSave, departments }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
    contactNumber: user?.contactNumber || '',
    roles: user?.roles || (['Auditor'] as UserRole[])
  });

  const roleOptions: UserRole[] = ['Admin', 'Auditor', 'Supervisor'];

  const toggleRole = (role: UserRole) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.roles.length === 0) {
      alert('Please select at least one role for this member.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">{user ? 'Edit Member Profile' : 'Invite Institutional Member'}</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Credentials & Access Control</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Name</label>
              <input
                required
                placeholder="Jane Doe"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Email Address</label>
              <input
                required
                type="email"
                placeholder="jane@institution.edu"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Department</label>
              <select
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.filter(d => d !== 'All').map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Number</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                value={formData.contactNumber}
                onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Permission Roles</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {roleOptions.map(role => {
                const active = formData.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${active
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                  >
                    <i className={`fa-solid ${active ? 'fa-check-circle' : 'fa-circle-plus'} text-[10px]`}></i>
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-grow py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
            >
              Discard
            </button>
            <button
              type="submit"
              className="flex-[2] py-3.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-sm"
            >
              {user ? 'Update Profile' : 'Create Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BulkImportModal: React.FC<{
  onClose: () => void;
  onImport: (users: Omit<User, 'id'>[]) => void;
}> = ({ onClose, onImport }) => {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`Parsing Error: ${results.errors[0].message}`);
          return;
        }

        const formatted = results.data.map((row: any) => ({
          name: row['Name'] || row['Full Name'] || row['name'] || '',
          email: row['Email'] || row['email'] || '',
          department: row['Department'] || row['department'] || '',
          contactNumber: row['Contact'] || row['Phone'] || row['contactNumber'] || '',
          roles: (row['Roles'] || row['roles'] || 'Auditor').split(',').map((r: string) => r.trim() as UserRole),
          status: 'Active' as const,
        }));

        setParsedData(formatted);
        setError(null);
      }
    });
  };

  const handleConfirm = () => {
    const validUsers = parsedData.filter(u => u.name && u.email);
    if (validUsers.length === 0) {
      setError("No valid member records found. Ensure Name and Email columns exist.");
      return;
    }
    onImport(validUsers);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-6 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl font-bold">Bulk Member Import</h3>
            <p className="text-slate-400 text-xs mt-1">Upload CSV file with Name, Email, Department, Roles</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-8 flex-grow overflow-y-auto space-y-6">
          {parsedData.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                <i className="fa-solid fa-file-csv text-3xl"></i>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900">Click or drag CSV file to upload</p>
                <p className="text-xs text-slate-400 mt-1">Format: Name, Email, Department, Roles, Contact</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Data Preview ({parsedData.length} Records)</p>
                <button onClick={() => setParsedData([])} className="text-[10px] font-bold text-red-500 hover:underline">Clear List</button>
              </div>
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 font-bold text-slate-500">Name</th>
                      <th className="px-4 py-2 font-bold text-slate-500">Email</th>
                      <th className="px-4 py-2 font-bold text-slate-500">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {parsedData.slice(0, 10).map((u, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-slate-900 font-medium">{u.name || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{u.email || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{u.department || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="p-2 bg-slate-50 text-center text-[10px] text-slate-400 font-bold">
                    Showing first 10 of {parsedData.length} records...
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-600 text-xs font-medium">
              <i className="fa-solid fa-triangle-exclamation"></i>
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-grow py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all text-sm"
          >
            Cancel
          </button>
          <button
            disabled={parsedData.length === 0}
            onClick={handleConfirm}
            className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 text-sm"
          >
            Confirm & Import {parsedData.length > 0 && `(${parsedData.length} Members)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TeamManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { users, departments: deptList, addUser, updateUser, deleteUser } = useData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  const currentUserRoles = currentUser?.roles || [];
  // ... (skip lines)
  const handleDeleteClick = (userId: string) => {
    if (userId === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    setDeleteConfirmationId(userId);
  };

  const confirmDelete = () => {
    if (deleteConfirmationId) {
      deleteUser(deleteConfirmationId);
      setDeleteConfirmationId(null);
    }
  };

  const isAdmin = currentUserRoles.includes('Admin');
  const roleOptions: UserRole[] = ['Admin', 'Auditor', 'Supervisor'];

  // Flatten departments to string array or use objects
  const departments = ['All', ...deptList.map(d => d.name)];

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesDept = selectedDeptFilter === 'All' || u.department === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [users, searchTerm, selectedDeptFilter]);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Admin': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Auditor': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Supervisor': return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const handleOpenInvite = () => {
    setEditingUser(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleModalSave = (formData: any) => {
    if (editingUser) {
      updateUser(editingUser.id, formData);
    } else {
      addUser(formData);
    }
    setIsModalOpen(false);
  };

  const toggleRoleDirectly = (user: User, role: UserRole) => {
    const currentRoles = user.roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];

    if (newRoles.length === 0) return;
    updateUser(user.id, { roles: newRoles });
  };

  const handleBulkAdd = (usersToAdd: Omit<User, 'id'>[]) => {
    usersToAdd.forEach(u => addUser(u));
  };

  const handleStatusUpdate = (userId: string, newStatus: string) => {
    // Assuming 'Active' | 'Inactive'
    updateUser(userId, { status: newStatus as any });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-grow max-w-2xl gap-3">
          <div className="relative flex-grow">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative min-w-[180px]">
            <i className="fa-solid fa-sitemap absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <select
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm appearance-none cursor-pointer"
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.filter(d => d !== 'All').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkOpen(true)}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm shrink-0"
            >
              <i className="fa-solid fa-file-import text-blue-500"></i>
              Bulk Import
            </button>
            <button
              onClick={handleOpenInvite}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-slate-900/10 shrink-0"
            >
              <i className="fa-solid fa-user-plus"></i>
              Invite Member
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Email (Gmail)</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Department</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Details</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Assigned Roles</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">System Status</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Activity</th>
                {isAdmin && <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200 shrink-0 shadow-sm">
                        {user.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{user.email}</div>
                        <div className="text-[10px] text-slate-400 truncate font-medium">{user.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                        <i className="fa-solid fa-sitemap text-slate-300 text-[10px]"></i>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {user.department || <span className="text-slate-300 italic">Unassigned</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                        <i className="fa-solid fa-phone text-slate-300 text-[10px]"></i>
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        {user.contactNumber || <span className="text-slate-300 italic">N/A</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5 min-w-[200px]">
                      {roleOptions.map(role => {
                        const isActive = (user.roles || []).includes(role);
                        return (
                          <button
                            key={role}
                            disabled={!isAdmin}
                            onClick={() => toggleRoleDirectly(user, role)}
                            className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border transition-all ${isActive
                              ? `${getRoleBadge(role)} shadow-sm`
                              : 'bg-slate-50 text-slate-300 border-slate-100 opacity-40 hover:opacity-80'
                              } ${!isAdmin && 'cursor-default'}`}
                          >
                            {isActive && <i className="fa-solid fa-check mr-1 text-[7px]"></i>}
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isAdmin ? (
                      <button
                        onClick={() => handleStatusUpdate(user.id, user.status === 'Active' ? 'Inactive' : 'Active')}
                        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${user.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                        {user.status}
                      </button>
                    ) : (
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold border ${user.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        {user.status}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">
                      {user.lastActive || 'Never'}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(user)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Modify Credentials"
                        >
                          <i className="fa-solid fa-user-pen"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user.id)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Revoke Access"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-xs mx-auto">
                      <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
                        <i className="fa-solid fa-users-slash text-2xl"></i>
                      </div>
                      <h4 className="text-slate-900 font-bold mb-1">No Members Found</h4>
                      <p className="text-xs text-slate-500">We couldn't find any institutional members matching your search query or department filter.</p>
                      <button
                        onClick={() => { setSearchTerm(''); setSelectedDeptFilter('All'); }}
                        className="mt-4 text-xs font-bold text-blue-600 hover:underline"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <MemberModal
          user={editingUser}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
          departments={departments}
        />
      )}

      {isBulkOpen && (
        <BulkImportModal
          onClose={() => setIsBulkOpen(false)}
          onImport={handleBulkAdd}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleteConfirmationId}
        title="Remove Member?"
        message="This will permanently delete the user's profile and history from the institution records. This action is irreversible."
        confirmLabel="Confirm Delete"
        cancelLabel="Keep Profile"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmationId(null)}
        variant="danger"
      />
    </div>
  );
};
