// Native IndexedDB storage wrapper for Nova Canvas
// Solves browser localStorage 5MB quota limitation for multi-page documents and PDF imports

const DB_NAME = 'nova_canvas_db';
const STORE_NAME = 'app_store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryCache: Record<string, any> = {};

const getDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
};

// Asynchronously get item from IndexedDB with fallback to memoryCache or localStorage
export const getIdbItem = async <T>(key: string, defaultVal: T): Promise<T> => {
  if (key in memoryCache) {
    return memoryCache[key] as T;
  }

  try {
    const db = await getDB();
    return new Promise<T>((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result !== undefined && request.result !== null) {
          memoryCache[key] = request.result;
          resolve(request.result as T);
        } else {
          // Fallback to localStorage if legacy data exists
          try {
            const localVal = localStorage.getItem(key);
            if (localVal !== null) {
              const parsed = JSON.parse(localVal);
              memoryCache[key] = parsed;
              // Migrate to IndexedDB
              setIdbItem(key, parsed);
              resolve(parsed as T);
              return;
            }
          } catch {
            // ignore
          }
          memoryCache[key] = defaultVal;
          resolve(defaultVal);
        }
      };

      request.onerror = () => {
        resolve(defaultVal);
      };
    });
  } catch {
    // If IndexedDB fails, fallback to memoryCache or localStorage
    try {
      const localVal = localStorage.getItem(key);
      if (localVal !== null) {
        return JSON.parse(localVal);
      }
    } catch {
      // ignore
    }
    return defaultVal;
  }
};

// Asynchronously set item to IndexedDB and update memoryCache & localStorage (if fits)
export const setIdbItem = async <T>(key: string, value: T): Promise<void> => {
  memoryCache[key] = value;

  // Try to keep localStorage updated for small metadata (skip large pages)
  try {
    const json = JSON.stringify(value);
    if (json.length < 500000) { // Only store in localStorage if < 500KB
      localStorage.setItem(key, json);
    }
  } catch {
    // Ignore localStorage quota errors
  }

  try {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB save error for ${key}:`, err);
  }
};

// Synchronous getter from memory cache with initial localStorage check
export const getCachedData = <T>(key: string, defaultVal: T): T => {
  if (key in memoryCache) {
    return memoryCache[key] as T;
  }
  try {
    const localVal = localStorage.getItem(key);
    if (localVal !== null) {
      const parsed = JSON.parse(localVal);
      memoryCache[key] = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }
  return defaultVal;
};

// Pre-hydrate memoryCache from IndexedDB at application boot
export const initIdbStorage = async (keys: string[]) => {
  await Promise.all(keys.map(k => getIdbItem(k, null)));
};
