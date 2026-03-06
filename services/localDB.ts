
import { AuditSchedule, User, Department, Location, CrossAuditPermission, AppNotification, AuditPhase, KPITier } from '../types';

const DB_NAME = 'AssetAuditProDB_v3'; 
const DB_VERSION = 2; // Bumped to trigger upgrade for kpiTiers

type StoreName = 'audits' | 'users' | 'departments' | 'locations' | 'crossAudits' | 'notifications' | 'auditPhases' | 'kpiTiers';

export class ItemNotFoundError extends Error {
  constructor(id: string, storeName: string) {
    super(`Item ${id} not found in ${storeName}`);
    this.name = 'ItemNotFoundError';
  }
}

class LocalDB {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const stores: StoreName[] = ['audits', 'users', 'departments', 'locations', 'crossAudits', 'notifications', 'auditPhases', 'kpiTiers'];
        
        stores.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
    });
  }

  private async getStore(storeName: StoreName, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.open();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add<T>(storeName: StoreName, item: T): Promise<T> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(item); // put handles both add and update if key exists
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async update<T>(storeName: StoreName, id: string, updates: Partial<T>): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        // If item exists, merge. If not, create new with id and updates.
        const updatedItem = data ? { ...data, ...updates } : { id, ...updates };
        const putRequest = store.put(updatedItem);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: StoreName): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const localDB = new LocalDB();
