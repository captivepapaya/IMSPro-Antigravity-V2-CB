export interface FileIndexEntry {
    path: string; // Relative path acting as unique key
    name: string;
    tokens: string[]; // Search tokens
    width: number; // 0 if unknown
    height: number; // 0 if unknown
    size: number;
    lastModified: number;
}

export const idb = {
    dbName: 'vca_db',
    storeName: 'handles',
    idxStoreName: 'file_index',

    async getDb() {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2); // Version 2
            request.onupgradeneeded = (e) => {
                const db = (e.target as any).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
                if (!db.objectStoreNames.contains(this.idxStoreName)) {
                    db.createObjectStore(this.idxStoreName, { keyPath: 'path' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Handles Storage
    async set(key: string, value: any) {
        const db = await this.getDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async get(key: string) {
        const db = await this.getDb();
        return new Promise<any>((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    // Index Storage
    async saveIndexEntries(entries: FileIndexEntry[]) {
        const db = await this.getDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.idxStoreName, 'readwrite');
            const store = tx.objectStore(this.idxStoreName);
            // Use looping put for massive inserts (or block if too large, but browser handles transaction queue well)
            entries.forEach(e => store.put(e));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async clearIndex() {
        const db = await this.getDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.idxStoreName, 'readwrite');
            tx.objectStore(this.idxStoreName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async getFullIndex(): Promise<FileIndexEntry[]> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.idxStoreName, 'readonly');
            const req = tx.objectStore(this.idxStoreName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }
};

