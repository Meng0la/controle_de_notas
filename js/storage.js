export const storage = (() => {
  const DB_NAME = 'controle-nf-pro';
  const STORE_NAME = 'settings';

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(type, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, type);
      const store = tx.objectStore(STORE_NAME);
      const req = callback(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async get(key) {
      const value = await withStore('readonly', (store) => store.get(key));
      return value === undefined ? null : value;
    },
    async set(key, value) {
      await withStore('readwrite', (store) => store.put(value, key));
    }
  };
})();
