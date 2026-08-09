/**
 * TyProX IndexedDB Persistence & Offline Cache (Phase 3 & ADR-029)
 * Stores session runs, Typing DNA, drills, and user settings offline with background sync.
 */

export class IndexedDBCache {
  private static DB_NAME = 'typrox_offline_db';
  private static DB_VERSION = 1;
  private static STORE_SESSIONS = 'sessions';
  private static STORE_SETTINGS = 'settings';

  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        this.dbPromise = null;
        reject(new Error('IndexedDB unavailable'));
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_SESSIONS)) {
          db.createObjectStore(this.STORE_SESSIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.STORE_SETTINGS)) {
          db.createObjectStore(this.STORE_SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  public static async saveSession(sessionData: Record<string, unknown>): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_SESSIONS, 'readwrite');
      const store = tx.objectStore(this.STORE_SESSIONS);
      store.put({
        id: sessionData.id || `offline_${Date.now()}`,
        ...sessionData,
        cachedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('IndexedDBCache.saveSession error:', err);
    }
  }

  public static async getOfflineSessions(): Promise<Record<string, unknown>[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(this.STORE_SESSIONS, 'readonly');
        const store = tx.objectStore(this.STORE_SESSIONS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  public static async clearOfflineSession(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_SESSIONS, 'readwrite');
      const store = tx.objectStore(this.STORE_SESSIONS);
      store.delete(id);
    } catch (err) {
      console.error('IndexedDBCache.clearOfflineSession error:', err);
    }
  }
}
