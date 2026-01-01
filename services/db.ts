

import { CsvFile, OrderHeader, OrderItem, ProductImageRecord, OrderMedia, AddProductQueueItem, ProductReviewQueueItem } from '../types';
import { getSupabase } from './supabaseClient';

const DB_NAME = 'IMS_GEMINI_DB';
const FILES_STORE = 'files';
const HANDLES_STORE = 'file_handles';
const SETTINGS_STORE = 'settings';
const MEDIA_STORE = 'order_media'; // New Store
const DB_VERSION = 4; // Increment Version

export interface FileSlot { slot: number; handle: any; name: string; }
export interface AppSettings { id: string; value: any; }
export interface CoreConfig { url: string; updatedAt: string; name?: string; }

// --- Helper: Sanitize Data for Supabase ---
const sanitize = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item));
  }
  if (typeof obj === 'object' && obj !== null) {
    const clean: any = { ...obj };
    for (const key in clean) {
      if (typeof clean[key] === 'number') {
        if (isNaN(clean[key]) || !isFinite(clean[key])) {
          clean[key] = 0; // Fallback to 0 for invalid numbers
        }
      }
      if (clean[key] === undefined) {
        delete clean[key]; // Remove undefined keys
      }
    }
    return clean;
  }
  return obj;
};

// --- Database Init ---
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject('IndexedDB not supported'); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject('Error opening DB');
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(HANDLES_STORE)) db.createObjectStore(HANDLES_STORE, { keyPath: 'slot' });
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });

      // Create Media Store with Index on orderId for fast querying
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: 'id', autoIncrement: true });
        mediaStore.createIndex('orderId', 'orderId', { unique: false });
        mediaStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
};

// --- Media Functions ---

export const saveOrderMedia = async (media: OrderMedia): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).add(media);
  } catch (e) { console.error("Save Media Error", e); }
};

export const getMediaForOrder = async (orderId: string): Promise<OrderMedia[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const index = tx.objectStore(MEDIA_STORE).index('orderId');
      const request = index.getAll(orderId);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (e) { return []; }
};

// Optimized Batch Count for List View
export const getMediaCountsForOrders = async (orderIds: string[]): Promise<Record<string, number>> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const index = tx.objectStore(MEDIA_STORE).index('orderId');
      const counts: Record<string, number> = {};
      let pending = orderIds.length;

      if (pending === 0) { resolve({}); return; }

      orderIds.forEach(id => {
        const req = index.count(id);
        req.onsuccess = () => {
          counts[id] = req.result;
          pending--;
          if (pending === 0) resolve(counts);
        };
      });
    });
  } catch (e) { return {}; }
};

export const cleanupOldMedia = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const index = store.index('timestamp');

    // 7 Days ago
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(cutoff);

    // Delete all records older than cutoff
    // Note: delete on index isn't direct in all browsers, might need cursor.
    // Simplified approach: iterate cursor and delete.
    const request = index.openCursor(range);
    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  } catch (e) { console.error("Media Cleanup Error", e); }
};

// --- Existing Functions ---

export const saveFileToDB = async (file: CsvFile): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).put(file);
  } catch (error) { }
};

export const getAllFilesFromDB = async (): Promise<CsvFile[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const request = db.transaction(FILES_STORE, 'readonly').objectStore(FILES_STORE).getAll();
      request.onsuccess = () => resolve(request.result as CsvFile[]);
    });
  } catch (error) { return []; }
};

export const deleteFileFromDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).delete(id);
  } catch (error) { }
};

export const saveFileHandle = async (slot: number, handle: any, name: string): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    tx.objectStore(HANDLES_STORE).put({ slot, handle, name });
  } catch (error) { }
};

export const getAllFileHandles = async (): Promise<FileSlot[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const request = db.transaction(HANDLES_STORE, 'readonly').objectStore(HANDLES_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) { return []; }
};

export const deleteFileHandle = async (slot: number): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    tx.objectStore(HANDLES_STORE).delete(slot);
  } catch (error) { }
};

export const saveSetting = async (key: string, value: any): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put({ id: key, value });
    try {
      const supabase = getSupabase();
      await supabase.from('app_settings').upsert({ id: key, value }, { onConflict: 'id' });
    } catch (e) { }
  } catch (error) { }
};

export const getSetting = async (key: string): Promise<any> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('app_settings').select('value').eq('id', key).maybeSingle();
    if (!error && data) {
      const db = await initDB();
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      tx.objectStore(SETTINGS_STORE).put({ id: key, value: data.value });
      return data.value;
    }
  } catch (e) { }
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const request = db.transaction(SETTINGS_STORE, 'readonly').objectStore(SETTINGS_STORE).get(key);
      request.onsuccess = () => resolve(request.result?.value);
    });
  } catch (error) { return undefined; }
};

export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('app_settings').select('*', { count: 'exact', head: true });
    return !error;
  } catch (e) { return false; }
};

export const saveCoreConfig = async (config: CoreConfig) => saveSetting('core_csv_config', config);
export const getCoreConfig = async (): Promise<CoreConfig | null> => getSetting('core_csv_config');

export const saveGeneralConfig = async (config: CoreConfig) => saveSetting('general_csv_config', config);
export const getGeneralConfig = async (): Promise<CoreConfig | null> => getSetting('general_csv_config');

export const saveSubCatConfig = async (config: CoreConfig) => saveSetting('subcat_csv_config', config);
export const getSubCatConfig = async (): Promise<CoreConfig | null> => getSetting('subcat_csv_config');

export const saveOrderToSupabase = async (header: OrderHeader, items: OrderItem[]): Promise<boolean> => {
  try {
    const supabase = getSupabase();

    const cleanHeader = sanitize(header);
    const cleanItems = sanitize(items).map((i: any) => {
      const { DESC, ...rest } = i;
      return rest;
    });

    const { error: hErr } = await supabase.from('orders_header').upsert([cleanHeader], { onConflict: 'UUID' });

    if (hErr) {
      console.error("Save Header Error", hErr);
      const { error: hErr2 } = await supabase.from('orders_header').upsert([cleanHeader], { onConflict: 'INDEX' });
      if (hErr2) return false;
    }

    if (cleanItems.length > 0) {
      if (cleanHeader.UUID) {
        await supabase.from('orders_items').delete().eq('UUID', cleanHeader.UUID);
      } else {
        await supabase.from('orders_items').delete().eq('INDEX', cleanHeader.INDEX);
      }
      const { error: iErr } = await supabase.from('orders_items').insert(cleanItems);
      if (iErr) return false;
    }
    return true;
  } catch (e) { console.error("Save Logic Exception", e); return false; }
};

// --- NEW: Void Order (Update Status Only) ---
export const voidOrder = async (index: string): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('orders_header')
      .update({
        OSTATUS: 'Void',
        IS_SYNCED: false // Reset sync so GAS updates the spreadsheet
      })
      .eq('INDEX', index);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Void Order Failed", e);
    return false;
  }
};

export const getOrderStats = async () => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('orders_header').select('INDEX, created_at').order('created_at', { ascending: true });
    if (error || !data) return null;
    return { count: data.length, first: data[0]?.created_at, last: data[data.length - 1]?.created_at };
  } catch (e) { return null; }
};

export const getOrdersByRange = async (startStr: string, endStr: string) => {
  try {
    const supabase = getSupabase();
    const s = startStr.replace(/-/g, '') + '0000';
    const e = endStr.replace(/-/g, '') + '2359';
    const { data } = await supabase.from('orders_header')
      .select('*')
      .gte('TIME', s)
      .lte('TIME', e)
      .order('TIME', { ascending: false });
    return data || [];
  } catch (e) { return []; }
};

export const getOrderItems = async (index: string) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('orders_items').select('*').eq('INDEX', index);
    return data || [];
  } catch (e) { return []; }
};

export const updateOrderSyncStatus = async (index: string, status: boolean) => {
  try {
    const supabase = getSupabase();
    await supabase.from('orders_header').update({ IS_SYNCED: status }).eq('INDEX', index);
  } catch (e) { }
};

export const getLastSequenceNumber = async (datePrefix: string): Promise<number> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('orders_header')
      .select('INDEX')
      .like('INDEX', `${datePrefix}%`)
      .order('INDEX', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return 0;

    const lastIndex = data[0].INDEX;
    const parts = lastIndex.split('-');
    if (parts.length === 2) {
      return parseInt(parts[1], 10) || 0;
    }
    return 0;
  } catch (e) {
    console.warn("Failed to fetch last sequence, defaulting to local/0", e);
    return 0;
  }
};

export const getProductImages = async (sku: string): Promise<ProductImageRecord[]> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('sku', sku)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error("Error fetching images", error);
      return [];
    }
    return data as ProductImageRecord[];
  } catch (e) {
    console.error("Exception fetching images", e);
    return [];
  }
};

// --- ADD PRODUCT QUEUE FUNCTIONS ---

export const getAddProductQueue = async (): Promise<AddProductQueueItem[]> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('add_product_queue')
      .select('*')
      .order('sequence_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Failed to fetch add product queue", e);
    return [];
  }
};

export const addToProductQueue = async (item: Omit<AddProductQueueItem, 'id' | 'created_at'>): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('add_product_queue')
      .insert([item]);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Failed to add to product queue", e);
    return false;
  }
};

export const removeFromProductQueue = async (id: number): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('add_product_queue')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Failed to remove from product queue", e);
    return false;
  }
};

export const getNextQueueSequence = async (): Promise<number> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('add_product_queue')
      .select('sequence_number')
      .order('sequence_number', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return 1;
    return data[0].sequence_number + 1;
  } catch (e) {
    console.error("Failed to get next queue sequence", e);
    return 1;
  }
};

// --- PRODUCT REVIEW QUEUE FUNCTIONS ---

export const getProductReviewQueue = async (): Promise<ProductReviewQueueItem[]> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('product_review_queue')
      .select('*')
      .order('sequence_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Failed to fetch product review queue", e);
    return [];
  }
};

export const addToProductReviewQueue = async (item: Omit<ProductReviewQueueItem, 'id' | 'created_at'>): Promise<boolean> => {
  try {
    console.log('🟢 DB: addToProductReviewQueue called with:', item);
    const supabase = getSupabase();
    console.log('🟢 DB: Supabase client obtained');

    const { data, error } = await supabase
      .from('product_review_queue')
      .insert([item])
      .select();

    console.log('🟢 DB: Insert result:', { data, error });

    if (error) {
      console.error('🔴 DB: Insert error:', error);
      throw error;
    }

    console.log('🟢 DB: Successfully added to queue');
    return true;
  } catch (e) {
    console.error("🔴 DB: Failed to add to product review queue", e);
    return false;
  }
};

export const removeFromProductReviewQueue = async (id: number): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('product_review_queue')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Failed to remove from product review queue", e);
    return false;
  }
};

export const getNextReviewQueueSequence = async (): Promise<number> => {
  try {
    console.log('🟢 DB: getNextReviewQueueSequence called');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('product_review_queue')
      .select('sequence_number')
      .order('sequence_number', { ascending: false })
      .limit(1);

    console.log('🟢 DB: Sequence query result:', { data, error });

    if (error) throw error;
    if (!data || data.length === 0) {
      console.log('🟢 DB: No existing sequences, returning 1');
      return 1;
    }
    const nextSeq = data[0].sequence_number + 1;
    console.log('🟢 DB: Next sequence:', nextSeq);
    return nextSeq;
  } catch (e) {
    console.error("🔴 DB: Failed to get next review queue sequence", e);
    return 1;
  }
};

// Check if SKU already exists in Product Review Queue
export const isSkuInReviewQueue = async (sku: string): Promise<boolean> => {
  try {
    console.log('🟢 DB: isSkuInReviewQueue called for SKU:', sku);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('product_review_queue')
      .select('id')
      .eq('sku', sku)
      .limit(1);

    console.log('🟢 DB: SKU check result:', { data, error });

    if (error) throw error;
    const exists = data && data.length > 0;
    console.log('🟢 DB: SKU exists:', exists);
    return exists;
  } catch (e) {
    console.error("🔴 DB: Failed to check SKU in review queue", e);
    return false;
  }
};

