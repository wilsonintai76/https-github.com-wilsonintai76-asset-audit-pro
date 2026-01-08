/**
 * Local Storage Persistence Layer
 * Replaces Firebase for a pure frontend focus.
 */

// Simple event emitter for reactive updates
const listeners: Record<string, Set<(snapshot: any) => void>> = {};

const notify = (collectionName: string) => {
  if (!listeners[collectionName]) return;
  const data = JSON.parse(localStorage.getItem(`audit_pro_${collectionName}`) || '[]');
  const snapshot = {
    docs: data.map((item: any) => ({
      id: item.id,
      data: () => item,
      ref: { id: item.id }
    }))
  };
  listeners[collectionName].forEach(cb => cb(snapshot));
};

export const db = {}; // Dummy db object

export const collection = (db: any, name: string) => name;

export const doc = (db: any, collectionName: string, id: string) => ({ collectionName, id });

export const addDoc = async (collectionName: string, data: any) => {
  const current = JSON.parse(localStorage.getItem(`audit_pro_${collectionName}`) || '[]');
  const newDoc = { ...data, id: Math.random().toString(36).substr(2, 9) };
  const updated = [...current, newDoc];
  localStorage.setItem(`audit_pro_${collectionName}`, JSON.stringify(updated));
  notify(collectionName);
  return { id: newDoc.id };
};

export const updateDoc = async (docRef: any, data: any) => {
  const { collectionName, id } = docRef;
  const current = JSON.parse(localStorage.getItem(`audit_pro_${collectionName}`) || '[]');
  const updated = current.map((item: any) => 
    item.id === id ? { ...item, ...data } : item
  );
  localStorage.setItem(`audit_pro_${collectionName}`, JSON.stringify(updated));
  notify(collectionName);
};

export const onSnapshot = (q: any, callback: (snapshot: any) => void) => {
  const collectionName = typeof q === 'string' ? q : q.collectionName;
  if (!listeners[collectionName]) listeners[collectionName] = new Set();
  listeners[collectionName].add(callback);
  
  // Initial call
  notify(collectionName);
  
  return () => {
    listeners[collectionName].delete(callback);
  };
};

export const query = (collectionName: string, ...args: any[]) => ({ collectionName });

export const orderBy = (field: string, direction: string = 'asc') => ({ type: 'orderBy', field, direction });

export const getDocs = async (collectionName: string) => {
  const name = typeof collectionName === 'string' ? collectionName : (collectionName as any).collectionName;
  const data = JSON.parse(localStorage.getItem(`audit_pro_${name}`) || '[]');
  return {
    docs: data.map((item: any) => ({
      id: item.id,
      data: () => item,
      ref: { id: item.id }
    }))
  };
};

export const writeBatch = (db: any) => ({
  delete: (docRef: any) => {
    const { collectionName, id } = docRef;
    const current = JSON.parse(localStorage.getItem(`audit_pro_${collectionName}`) || '[]');
    const updated = current.filter((item: any) => item.id !== id);
    localStorage.setItem(`audit_pro_${collectionName}`, JSON.stringify(updated));
  },
  commit: async () => {
    Object.keys(listeners).forEach(notify);
  }
});

export const setDoc = async (docRef: any, data: any) => {
  const { collectionName, id } = docRef;
  const current = JSON.parse(localStorage.getItem(`audit_pro_${collectionName}`) || '[]');
  const idx = current.findIndex((item: any) => id === item.id);
  let updated;
  if (idx !== -1) {
    updated = [...current];
    updated[idx] = { ...data, id };
  } else {
    updated = [...current, { ...data, id }];
  }
  localStorage.setItem(`audit_pro_${collectionName}`, JSON.stringify(updated));
  notify(collectionName);
};

// Mock collections
export const auditsCol = 'audits';
export const notificationsCol = 'notifications';
export const usersCol = 'users';
export const crossAuditsCol = 'crossAudits';
export const departmentsCol = 'departments';
export const locationsCol = 'locations';
