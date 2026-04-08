/**
 * Tiny IndexedDB wrapper for offline read of songs + snippets.
 *
 * The database has two object stores: `songs` and `snippets`. Records are
 * keyed on `id` and namespaced per user via the `user_id` field, so multiple
 * accounts on the same device do not see each other's cached data.
 */

const DB_NAME = 'kendang-offline';
const DB_VERSION = 1;
const STORES = ['songs', 'snippets'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('by_user', 'user_id', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDb().then((db) => {
    const t = db.transaction(storeName, mode);
    return t.objectStore(storeName);
  });
}

/** Replace the cached list for a given user (clears old rows for that user first). */
export async function cacheList(storeName, userId, items) {
  if (!STORES.includes(storeName)) throw new Error(`Unknown store: ${storeName}`);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite');
    const store = t.objectStore(storeName);
    const idx = store.index('by_user');
    const req = idx.openCursor(IDBKeyRange.only(userId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        for (const item of items) {
          store.put({ ...item, user_id: userId });
        }
      }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** Read all cached items for a given user. */
export async function readList(storeName, userId) {
  if (!STORES.includes(storeName)) return [];
  const store = await tx(storeName);
  const idx = store.index('by_user');
  return new Promise((resolve, reject) => {
    const out = [];
    const req = idx.openCursor(IDBKeyRange.only(userId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        // Strip the user_id field so callers see the original shape.
        // eslint-disable-next-line no-unused-vars
        const { user_id, ...rest } = cursor.value;
        out.push(rest);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Upsert a single item. */
export async function putItem(storeName, userId, item) {
  if (!STORES.includes(storeName)) return;
  const store = await tx(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ ...item, user_id: userId });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete a single item. */
export async function deleteItem(storeName, id) {
  if (!STORES.includes(storeName)) return;
  const store = await tx(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
