
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, DashboardConfig } from '../types';
import { usersCol, getDocs, updateDoc, addDoc, doc, db } from '../services/firebase';

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  showStats: true,
  showTrends: true,
  showUpcoming: true,
  showCertification: true,
  showDeptDistribution: true
};

interface AuthContextType {
  currentUser: User | null;
  hasStarted: boolean;
  login: (userData: Omit<User, 'id'>) => Promise<void>;
  logout: () => void;
  updateConfig: (config: DashboardConfig) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('audit_pro_session');
    if (savedSession) {
      setCurrentUser(JSON.parse(savedSession));
    }
    setHasStarted(true);
  }, []);

  const login = useCallback(async (userData: Omit<User, 'id'>) => {
    // Basic "auth" logic - in real app would verify credentials
    const snapshot = await getDocs(usersCol);
    const existingUserDoc = snapshot.docs.find(d => d.data().email === userData.email);

    let userToSet: User;

    if (existingUserDoc) {
      const data = existingUserDoc.data();
      userToSet = { id: existingUserDoc.id, ...data } as User;
      if (!userToSet.dashboardConfig) userToSet.dashboardConfig = DEFAULT_DASHBOARD_CONFIG;
      await updateDoc(doc(db, usersCol, existingUserDoc.id), {
        lastActive: new Date().toLocaleString()
      });
    } else {
      const newUser: Omit<User, 'id'> = {
        ...userData,
        dashboardConfig: DEFAULT_DASHBOARD_CONFIG
      };
      const docRef = await addDoc(usersCol, newUser);
      userToSet = { id: docRef.id, ...newUser } as User;
    }

    setCurrentUser(userToSet);
    localStorage.setItem('audit_pro_session', JSON.stringify(userToSet));
    setHasStarted(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('audit_pro_session');
    setCurrentUser(null);
    setHasStarted(false);
  }, []);

  const updateConfig = useCallback(async (newConfig: DashboardConfig) => {
    if (!currentUser) return;
    await updateDoc(doc(db, usersCol, currentUser.id), { dashboardConfig: newConfig });
    setCurrentUser(prev => prev ? { ...prev, dashboardConfig: newConfig } : null);
    // Update local storage as well to keep it in sync
    const updatedUser = { ...currentUser, dashboardConfig: newConfig };
    localStorage.setItem('audit_pro_session', JSON.stringify(updatedUser));
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, hasStarted, login, logout, updateConfig }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
