
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    AuditSchedule, AppNotification, User, CrossAuditPermission, Department, Location,
    UserRole
} from '../types';
import {
    db, auditsCol, notificationsCol, usersCol, crossAuditsCol, departmentsCol, locationsCol,
    onSnapshot, addDoc, updateDoc, doc, query, orderBy, writeBatch
} from '../services/firebase';
import { INITIAL_AUDITS, INITIAL_NOTIFICATIONS } from '../constants';
import { useAuth } from './AuthContext';

interface DataContextType {
    schedules: AuditSchedule[];
    notifications: AppNotification[];
    users: User[];
    crossAuditPermissions: CrossAuditPermission[];
    departments: Department[];
    locations: Location[];

    // Actions
    addNotification: (title: string, message: string, type: AppNotification['type']) => Promise<void>;
    markNotificationAsRead: (id: string) => Promise<void>;
    clearNotifications: () => Promise<void>;

    // CRUD Wrappers (Generic permission checks should probably be here or in components, 
    // but for now we'll expose the raw actions and keep checks in components or refactor checks here later)
    updateAudit: (id: string, data: Partial<AuditSchedule>) => Promise<void>;
    addLocation: (loc: Omit<Location, 'id'>) => Promise<void>;
    updateLocation: (id: string, data: Partial<Location>) => Promise<void>;
    deleteLocation: (id: string) => Promise<void>;
    addDepartment: (dept: Omit<Department, 'id'>) => Promise<void>;
    updateDepartment: (id: string, data: Partial<Department>) => Promise<void>;
    deleteDepartment: (id: string) => Promise<void>;

    addUser: (user: Omit<User, 'id'>) => Promise<void>;
    updateUser: (id: string, data: Partial<User>) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;

    addCrossAudit: (auditorDept: string, targetDept: string, isMutual: boolean) => Promise<void>;
    updateCrossAudit: (id: string, data: Partial<CrossAuditPermission>) => Promise<void>;
    deleteCrossAudit: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth(); // Can use this for RBAC logs if needed
    const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [crossAuditPermissions, setCrossAuditPermissions] = useState<CrossAuditPermission[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);

    // --- Subscriptions ---

    useEffect(() => {
        const q = query(auditsCol, orderBy("date", "asc"));
        const unsubscribe = onSnapshot(q, async (snapshot: any) => {
            const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as AuditSchedule[];
            if (data.length === 0) {
                // Simple check to seed if empty - strictly strictly implementation detail
                // In a real app we might not want to auto-seed here every time, but fine for prototype
                if (localStorage.getItem('audit_pro_seeded') !== 'true') {
                    for (const audit of INITIAL_AUDITS) { await addDoc(auditsCol, { ...audit }); }
                    localStorage.setItem('audit_pro_seeded', 'true');
                }
            } else {
                setSchedules(data);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(notificationsCol, orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, async (snapshot: any) => {
            const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as AppNotification[];
            if (data.length === 0 && localStorage.getItem('audit_pro_notifs_seeded') !== 'true') {
                for (const n of INITIAL_NOTIFICATIONS) { await addDoc(notificationsCol, { ...n }); }
                localStorage.setItem('audit_pro_notifs_seeded', 'true');
            } else {
                setNotifications(data);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(usersCol, orderBy("name", "asc"));
        return onSnapshot(q, (snapshot: any) => {
            setUsers(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        });
    }, []);

    useEffect(() => {
        return onSnapshot(crossAuditsCol, (snapshot: any) => {
            setCrossAuditPermissions(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        });
    }, []);

    useEffect(() => {
        return onSnapshot(departmentsCol, (snapshot: any) => {
            setDepartments(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        });
    }, []);

    useEffect(() => {
        return onSnapshot(locationsCol, (snapshot: any) => {
            setLocations(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        });
    }, []);

    // --- Actions ---

    const addNotification = useCallback(async (title: string, message: string, type: AppNotification['type']) => {
        await addDoc(notificationsCol, {
            title, message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type, read: false, createdAt: new Date().toISOString()
        });
    }, []);

    const markNotificationAsRead = async (id: string) => {
        await updateDoc(doc(db, notificationsCol, id), { read: true });
    };

    const clearNotifications = async () => {
        const batch = writeBatch(db);
        notifications.forEach((n) => batch.delete(doc(db, notificationsCol, n.id)));
        await batch.commit();
    };

    const updateAudit = async (id: string, data: Partial<AuditSchedule>) => {
        await updateDoc(doc(db, auditsCol, id), data);
    };

    const addLocation = async (loc: Omit<Location, 'id'>) => {
        await addDoc(locationsCol, loc);
        // Auto-schedule logic is currently in App.tsx, but good to move here or keep in component?
        // Let's keep the raw CRUD here.
    };

    const updateLocation = async (id: string, data: Partial<Location>) => {
        await updateDoc(doc(db, locationsCol, id), data);
    };

    const deleteLocation = async (id: string) => {
        // NOTE: complex logic (batch delete) matches App.tsx
        const batch = writeBatch(db);
        batch.delete(doc(db, locationsCol, id));
        await batch.commit();
    };

    const addDepartment = async (dept: Omit<Department, 'id'>) => {
        await addDoc(departmentsCol, dept);
    };
    const updateDepartment = async (id: string, data: Partial<Department>) => {
        await updateDoc(doc(db, departmentsCol, id), data);
    };
    const deleteDepartment = async (id: string) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, departmentsCol, id));
        await batch.commit();
    };

    const addUser = async (user: Omit<User, 'id'>) => {
        await addDoc(usersCol, user);
    };
    const updateUser = async (id: string, data: Partial<User>) => {
        await updateDoc(doc(db, usersCol, id), data);
    };
    const deleteUser = async (id: string) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, usersCol, id));
        await batch.commit();
    };

    const addCrossAudit = async (auditorDept: string, targetDept: string, isMutual: boolean) => {
        await addDoc(crossAuditsCol, { auditorDept, targetDept, isActive: true, isMutual });
    };
    const updateCrossAudit = async (id: string, data: Partial<CrossAuditPermission>) => {
        await updateDoc(doc(db, crossAuditsCol, id), data);
    };
    const deleteCrossAudit = async (id: string) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, crossAuditsCol, id));
        await batch.commit();
    };

    return (
        <DataContext.Provider value={{
            schedules, notifications, users, crossAuditPermissions, departments, locations,
            addNotification, markNotificationAsRead, clearNotifications,
            updateAudit,
            addLocation, updateLocation, deleteLocation,
            addDepartment, updateDepartment, deleteDepartment,
            addUser, updateUser, deleteUser,
            addCrossAudit, updateCrossAudit, deleteCrossAudit
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
