import type { DatasetMetadata, DatasetSnapshot } from '../types/britconnect';

const DB_NAME = 'BritConnectChurnDB';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'active_workspace';
const META_STORAGE_KEY = 'britconnect_active_meta_v1';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export function getStoredMetadata(): DatasetMetadata | null {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DatasetMetadata;
  } catch {
    return null;
  }
}

export async function saveWorkspaceSnapshot(snapshot: DatasetSnapshot): Promise<void> {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(snapshot.metadata));
  } catch {
    // ignore localStorage quota issues
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(snapshot, SNAPSHOT_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to save workspace to IndexedDB'));
    };
  });
}

export async function loadWorkspaceSnapshot(): Promise<DatasetSnapshot | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(SNAPSHOT_KEY);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as DatasetSnapshot | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Failed to load workspace from IndexedDB'));
    };
  });
}

export async function clearWorkspaceSnapshot(): Promise<void> {
  try {
    localStorage.removeItem(META_STORAGE_KEY);
  } catch {
    // ignore
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(SNAPSHOT_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to clear IndexedDB'));
    };
  });
}
