import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { gateway } from '../services/dataGateway';
import { MOCK_USERS } from '../services/mockData';

interface DemoContextType {
  isDemoMode: boolean;
  demoUser: User | null;
  enterDemoMode: (role: 'admin' | 'coordinator' | 'supervisor' | 'auditor' | 'staff') => void;
  exitDemoMode: () => void;
  resetDemoData: () => void;
  syncLiveToDemo: () => Promise<void>;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return localStorage.getItem('inspectable_is_demo') === 'true';
  });
  
  const [demoUser, setDemoUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('inspectable_demo_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    gateway.setDemoMode(isDemoMode);
    if (isDemoMode) {
      localStorage.setItem('inspectable_is_demo', 'true');
    } else {
      localStorage.removeItem('inspectable_is_demo');
      localStorage.removeItem('inspectable_demo_user');
    }
  }, [isDemoMode]);

  const enterDemoMode = (role: 'admin' | 'coordinator' | 'supervisor' | 'auditor' | 'staff') => {
    const user = MOCK_USERS[role];
    setDemoUser(user);
    setIsDemoMode(true);
    localStorage.setItem('inspectable_demo_user', JSON.stringify(user));
    window.location.reload(); // Reload to re-initialize data with demo mode
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    setDemoUser(null);
    window.location.reload();
  };

  const resetDemoData = () => {
    localStorage.removeItem('inspectable_demo_db');
    window.location.reload();
  };

  const syncLiveToDemo = async () => {
    await gateway.replicateFromSupabase();
    window.location.reload();
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, demoUser, enterDemoMode, exitDemoMode, resetDemoData, syncLiveToDemo }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
