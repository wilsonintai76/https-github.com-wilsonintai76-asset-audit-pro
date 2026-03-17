import React from 'react';
import { Phone, UserCheck, Plus, X } from 'lucide-react';
import { AuditSchedule, User } from '../types';

interface AuditorAssignmentSlotProps {
  slotNum: 1 | 2;
  audit: AuditSchedule;
  users: User[];
  currentUser: User | null;
  canManageAssignments: boolean;
  canSelfAssignSelf: boolean;
  userCanAudit: boolean;
  isCurrentUserAssigned: boolean;
  isPast: boolean;
  isDateValid: boolean;
  hasPhases: boolean;
  isUserOverLimit: boolean;
  hasFieldRole: boolean;
  isCertified: boolean;
  isSupervisor: boolean;
  isCoordinator: boolean;
  onAssign: (id: string, slot: 1 | 2, date: string, phaseId: string) => void;
  onUnassign: (id: string, slot: 1 | 2) => void;
  getUserContact: (userId: string) => string | null;
  getEntityName: (deptId: string) => string;
  maxAssetsPerDay: number;
}

export const AuditorAssignmentSlot: React.FC<AuditorAssignmentSlotProps> = ({
  slotNum,
  audit,
  users,
  currentUser,
  canManageAssignments,
  canSelfAssignSelf,
  userCanAudit,
  isCurrentUserAssigned,
  isPast,
  isDateValid,
  hasPhases,
  isUserOverLimit,
  hasFieldRole,
  isCertified,
  isSupervisor,
  isCoordinator,
  onAssign,
  onUnassign,
  getUserContact,
  getEntityName,
  maxAssetsPerDay
}) => {
  const slotKey = slotNum === 1 ? 'auditor1Id' : 'auditor2Id';
  const auditorId = audit[slotKey as keyof AuditSchedule] as string | null;
  const isAssigned = !!auditorId;
  const auditor = users.find(u => u.id === auditorId);
  const contact = auditorId ? getUserContact(auditorId) : null;
  const isMe = auditorId === currentUser?.id;
  
  const canRemove = isAssigned && isMe && !isPast;
  
  // Check eligibility: Has field role + Valid Cert + No Conflict
  const isDisabled = isAssigned || !canSelfAssignSelf || !userCanAudit || isCurrentUserAssigned || isPast || !isDateValid || !hasPhases || isUserOverLimit;
  
  let disableReason = "";
  if (isAssigned) {
    disableReason = "Slot already occupied";
  } else if (isUserOverLimit) {
    disableReason = `Assignment Limit: Adding this audit exceeds your daily asset limit of ${maxAssetsPerDay} assets.`;
  } else if (!hasFieldRole) {
    disableReason = "Access Denied: Your role does not permit auditing.";
  } else if (!isCertified) {
    // Customize message based on role for better clarity
    if (isSupervisor || isCoordinator) {
        disableReason = "Certification Required: Supervisors/Coordinators must hold a valid certificate to audit.";
    } else {
        disableReason = "Certification Required: Your auditor certificate is expired or invalid.";
    }
  } else if (!userCanAudit) {
     const myEnt = getEntityName(currentUser?.departmentId || '');
     const targetEnt = getEntityName(audit.departmentId);
     disableReason = myEnt === targetEnt ? "Conflict of Interest: You cannot audit your own department." : "Unauthorized Target: This location is outside your assigned audit matrix.";
  } else if (isCurrentUserAssigned) {
    disableReason = "Already assigned to a slot in this audit instance.";
  } else if (isPast) {
    disableReason = "This audit date has already passed.";
  } else if (!hasPhases) {
    disableReason = "Scheduling is locked until an active phase is configured.";
  } else if (!isDateValid) {
    disableReason = "The current audit date is outside the authorized phase window.";
  }

  return (
    <div className="min-h-[44px]">
      {isAssigned ? (
        <div className="flex items-center justify-between w-full bg-blue-50/50 rounded-xl p-2 border border-blue-100 group transition-all">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5 uppercase tracking-tighter">
              {auditor?.name || "Unknown"}
              {isMe && <span className="text-[10px] text-blue-600 font-bold normal-case ml-1">(You)</span>}
            </div>
              {contact && (
              <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5 font-bold">
                <Phone className="w-2 h-2 opacity-50" />
                {contact}
              </div>
            )}
          </div>
          
          {canRemove && (
            <button 
              onClick={() => onUnassign(audit.id, slotNum)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Remove Assignment"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <button 
          onClick={() => onAssign(audit.id, slotNum, audit.date, audit.phaseId)}
          disabled={isDisabled}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            isDisabled 
              ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-white border-2 border-blue-100 text-blue-600 hover:border-blue-300 hover:bg-blue-50 shadow-sm'
          }`}
          title={disableReason}
        >
          <Plus className="w-3 h-3" />
          Assign
        </button>
      )}
    </div>
  );
};
