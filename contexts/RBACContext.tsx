import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { RBACMatrix, UserRole } from '../types';
import { gateway } from '../services/dataGateway';

export const DEFAULT_RBAC_MATRIX: RBACMatrix = {
  'view:overview': ['Admin', 'Coordinator', 'Supervisor', 'Auditor', 'Staff'],
  'view:schedule:all': ['Admin', 'Coordinator'],
  'view:schedule:own': ['Admin', 'Coordinator', 'Supervisor', 'Auditor', 'Staff'],
  'edit:audit:date': ['Admin', 'Coordinator', 'Supervisor'],
  'edit:audit:assign': ['Admin', 'Coordinator', 'Supervisor', 'Auditor'],
  'view:audit:assigned': ['Admin', 'Coordinator', 'Supervisor', 'Auditor', 'Staff'],
  'view:team:all': ['Admin', 'Coordinator'],
  'view:team:own': ['Admin', 'Coordinator', 'Supervisor'],
  'edit:team': ['Admin', 'Coordinator'],
  'manage:departments': ['Admin', 'Coordinator'],
  'manage:locations': ['Admin', 'Coordinator'],
  'manage:system': ['Admin']
};

interface RBACContextType {
  rbacMatrix: RBACMatrix;
  isLoading: boolean;
  hasPermission: (permission: string, userRoles: UserRole[]) => boolean;
  updateRBAC: (newMatrix: RBACMatrix) => Promise<void>;
  refreshRBAC: () => Promise<void>;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

export const RBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rbacMatrix, setRbacMatrix] = useState<RBACMatrix>(DEFAULT_RBAC_MATRIX);
  const [isLoading, setIsLoading] = useState(true);

  const refreshRBAC = useCallback(async () => {
    try {
      setIsLoading(true);
      const settings = await gateway.getSystemSettings();
      const rbacSetting = settings.find(s => s.id === 'rbac_matrix');
      if (rbacSetting?.value) {
        setRbacMatrix(rbacSetting.value as RBACMatrix);
      }
    } catch (error) {
      console.error('Failed to load RBAC matrix:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRBAC();
  }, [refreshRBAC]);

  const hasPermission = useCallback((permission: string, userRoles: UserRole[]) => {
    const allowedRoles = rbacMatrix[permission] || [];
    return (userRoles || []).some(role => allowedRoles.includes(role));
  }, [rbacMatrix]);

  const updateRBAC = async (newMatrix: RBACMatrix) => {
    try {
      await gateway.updateSystemSetting('rbac_matrix', newMatrix);
      setRbacMatrix(newMatrix);
    } catch (error) {
      console.error('Failed to update RBAC matrix:', error);
      throw error;
    }
  };

  return (
    <RBACContext.Provider value={{ rbacMatrix, isLoading, hasPermission, updateRBAC, refreshRBAC }}>
      {children}
    </RBACContext.Provider>
  );
};

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (context === undefined) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
};
