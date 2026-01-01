
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';
import { InventoryItem } from '../types';
import Papa from 'papaparse';

const TABLE_NAME = 'inventory_core';

// Helper: Convert CSV Row / InventoryItem to DB Row
// Helper to safely parse currency (e.g. "$1,200.50" -> 1200.50)
const parseCurrency = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    const str = String(value).replace(/[$,]/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

// Helper: Convert CSV Row / InventoryItem to DB Row
const mapItemToDbRow = (item: any) => ({
    code: item.Code,
    description: item.Description,
    su: item.SU,
    sku: item.SKU,
    barcode: item.Barcode,
    hl: parseFloat(item.HL) || 0,
    qty: parseFloat(item.Qty) || 0,
    stock: parseFloat(item.Stock) || 0,
    sold: parseFloat(item.Sold) || 0,
    color: item.Color,
    cluster: item.Cluster,
    att_color: item.AttColor,
    location: item.Location,
    comment: item.Comment,
    cat_code: item.CatCode,
    model_code: item.ModelCode,
    category: item.Category,
    sub_cat: item.SubCat,
    net_cost: parseCurrency(item.NetCost),
    disc_rate: parseCurrency(item.DiscRate),
    final_cost: parseCurrency(item.FinalCost),
    ref_price: parseCurrency(item.RefPrice),
    list_price: parseCurrency(item.ListPrice),
    sale_price: (item.SalePrice && parseCurrency(item.SalePrice) > 0) ? parseCurrency(item.SalePrice) : null,
    post_id: item.PostID,
    post_status: item.PostStatus,
    stock_status: item.StockStatus || '',
    n_category: item.nCategory,
    n_sub_category: item.nSubCategory,
    product_tag: item.ProductTag,
    product_style: item.ProductStyle,
    post_title: item.PostTitle,
    post_slug: item.PostSlug,
    post_content: item.PostContent,
    post_short_desc: item.PostShortDesc,
    product_cat: item.ProductCat,
    focus_kw: item.FocusKW,
    meta_title: item.MetaTitle,
    meta_desc: item.MetaDesc,
    product_page: item.ProductPage,
    images: item.Images,
    image: item.Image,
    tap_prt_name: item.TapPrtName,
    pn_desc: item.PNDesc,
    pn_len: parseFloat(item.PNLen) || 0,
    per: parseFloat(item.Per) || 0,
    raw_data: item, // Store FULL original object to preserve extra columns
    updated_at: new Date().toISOString()
});

// Helper: Convert DB Row to InventoryItem
const mapDbRowToItem = (row: any): InventoryItem => {
    // 1. Start with the raw_data (if it exists) to get all original extra columns
    const base = (row.raw_data && typeof row.raw_data === 'object') ? { ...row.raw_data } : {};

    // 2. Overlay standard fields to ensure strict typing and latest DB values
    return {
        ...base,
        Code: row.code,
        SU: row.su || base.SU || '',
        SKU: row.sku || base.SKU || '',
        Barcode: row.barcode || base.Barcode || '',
        Description: row.description || base.Description || '',
        HL: Number(row.hl) || 0,
        Qty: Number(row.qty) || 0,
        Stock: Number(row.stock) || 0,
        Sold: Number(row.sold) || 0,
        Color: row.color || base.Color || '',
        Cluster: row.cluster || base.Cluster || '',
        AttColor: row.att_color || base.AttColor || '',
        Location: row.location || base.Location || '',
        Comment: row.comment || base.Comment || '',
        CatCode: row.cat_code || base.CatCode || '',
        ModelCode: row.model_code || base.ModelCode || '',
        Category: row.category || base.Category || '',
        SubCat: row.sub_cat || base.SubCat || '',
        NetCost: Number(row.net_cost) || 0,
        DiscRate: Number(row.disc_rate) || 0,
        FinalCost: Number(row.final_cost) || 0,
        RefPrice: Number(row.ref_price) || 0,
        ListPrice: Number(row.list_price) || 0,
        SalePrice: Number(row.sale_price) || 0,
        PostID: row.post_id || base.PostID || '',
        PostStatus: row.post_status || base.PostStatus || '',
        StockStatus: row.stock_status || base.StockStatus || '',
        nCategory: row.n_category || base.nCategory || '',
        nSubCategory: row.n_sub_category || base.nSubCategory || '',
        ProductTag: row.product_tag || base.ProductTag || '',
        ProductStyle: row.product_style || base.ProductStyle || '',
        PostTitle: row.post_title || base.PostTitle || '',
        PostSlug: row.post_slug || base.PostSlug || '',
        PostContent: row.post_content || base.PostContent || '',
        PostShortDesc: row.post_short_desc || base.PostShortDesc || '',
        ProductCat: row.product_cat || base.ProductCat || '',
        FocusKW: row.focus_kw || base.FocusKW || '',
        MetaTitle: row.meta_title || base.MetaTitle || '',
        MetaDesc: row.meta_desc || base.MetaDesc || '',
        ProductPage: row.product_page || base.ProductPage || '',
        Images: row.images || base.Images || '',
        Image: row.image || base.Image || '',
        TapPrtName: row.tap_prt_name || base.TapPrtName || '',
        PNDesc: row.pn_desc || base.PNDesc || '',
        PNLen: Number(row.pn_len) || 0,
        Per: Number(row.per) || 0,
        _id: row.id,
        isGeneralProduct: false
    };
};

export const coreService = {

    // 1. Upload Full Core (Admin Only)
    // Warning: This could be heavy. Using upsert based on 'code'.
    uploadCoreToSupabase: async (items: InventoryItem[], onProgress?: (percent: number) => void) => {
        const supabase = getSupabase();
        const BATCH_SIZE = 100;
        const total = items.length;
        let processed = 0;

        // Clean Data
        const cleanRows = items.map(mapItemToDbRow);

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = cleanRows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from(TABLE_NAME)
                .upsert(batch, { onConflict: 'code' }); // Upsert via Unique Code

            if (error) {
                console.error("Batch Upload Error", error);
                throw error;
            }

            processed += batch.length;
            if (onProgress) onProgress(Math.round((processed / total) * 100));
        }
        return true;
    },

    // 2. Fetch All (App Init) - Optimized with parallel loading
    fetchCoreFromSupabase: async (onProgress?: (loaded: number, total: number) => void): Promise<InventoryItem[]> => {
        const supabase = getSupabase();
        const BATCH_SIZE = 1000;

        // Step 1: Get total count (fast query)
        const { count, error: countError } = await supabase
            .from(TABLE_NAME)
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        const totalCount = count || 0;
        if (totalCount === 0) return [];

        // Step 2: Calculate number of batches
        const numBatches = Math.ceil(totalCount / BATCH_SIZE);

        // Step 3: Create parallel fetch promises
        const batchPromises = Array.from({ length: numBatches }, (_, i) => {
            const from = i * BATCH_SIZE;
            const to = from + BATCH_SIZE - 1;

            return supabase
                .from(TABLE_NAME)
                .select('*')
                .order('id', { ascending: true })
                .range(from, to)
                .then(({ data, error }) => {
                    if (error) throw error;

                    // Report progress
                    if (onProgress) {
                        const loaded = Math.min((i + 1) * BATCH_SIZE, totalCount);
                        onProgress(loaded, totalCount);
                    }

                    return data || [];
                });
        });

        // Step 4: Fetch all batches in parallel
        const batches = await Promise.all(batchPromises);

        // Step 5: Flatten and map to InventoryItem
        const allRows = batches.flat();
        return allRows.map(mapDbRowToItem);
    },

    // 3. Add Single Item (Add Product Page)
    addItemToSupabase: async (item: InventoryItem) => {
        const supabase = getSupabase();
        const row = mapItemToDbRow(item);

        // Remove ID to let DB auto-gen
        // @ts-ignore
        delete row.id;

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .insert([row])
            .select()
            .single();

        if (error) throw error;
        return mapDbRowToItem(data);
    },

    // Update existing item in Supabase
    updateItemInSupabase: async (item: InventoryItem): Promise<InventoryItem> => {
        const supabase = getSupabase();
        const row = mapItemToDbRow(item);

        console.log('🔧 updateItemInSupabase called with Code:', item.Code);
        console.log('🔧 Mapped row data:', {
            code: row.code,
            sub_cat: row.sub_cat,
            sku: row.sku,
            category: row.category
        });

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .update(row)
            .eq('code', item.Code) // Match by Code field
            .select()
            .single();

        if (error) {
            console.error('❌ Supabase update error:', error);
            throw error;
        }

        if (!data) {
            console.warn('⚠️ No data returned from update - item may not exist');
            throw new Error(`Item with code ${item.Code} not found in Supabase`);
        }

        console.log('✅ Supabase update successful, returned data:', {
            code: data.code,
            sub_cat: data.sub_cat,
            sku: data.sku
        });

        return mapDbRowToItem(data);
    },

    // Clear all data from Supabase
    clearAllData: async (): Promise<void> => {
        const supabase = getSupabase();
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .neq('id', 0); // Delete all rows (neq with impossible condition)

        if (error) throw error;
    },

    // 4. Export CSV (Structured Order)
    exportToCsv: (items: InventoryItem[]): string => {
        // Define explicit column order strictly matching User's Definition (A to AT)
        const columns = [
            "Code", "SU", "SKU", "Barcode", "Description", // A-E
            "HL", "Qty", "Stock", "Sold", "Color",         // F-J
            "Cluster", "AttColor", "Location", "Comment", "CatCode", // K-O
            "ModelCode", "Category", "SubCat",             // P-R
            "NetCost", "DiscRate", "FinalCost", "RefPrice", "ListPrice", "SalePrice", // S-X
            "PostID", "PostStatus", "StockStatus",         // Y-AA
            "nCategory", "nSubCategory", "ProductTag", "ProductStyle", // AB-AE
            "PostTitle", "PostSlug", "PostContent", "PostShortDesc", // AF-AI
            "ProductCat", "FocusKW", "MetaTitle", "MetaDesc", // AJ-AM
            "ProductPage", "Images", "Image",              // AN-AP
            "TapPrtName", "PNDesc", "PNLen", "Per"         // AQ-AT
        ];

        return Papa.unparse(items, {
            columns: columns,
            quotes: true, // Quote strings to be safe
        });
    },

    // 5. Add New Product with Google Sheet Sync
    addNewProductWithSync: async (item: InventoryItem, googleScriptUrl: string): Promise<InventoryItem> => {
        // Step 1: Add to Supabase first
        const savedItem = await coreService.addItemToSupabase(item);

        // Step 2: Sync to Google Sheet
        if (googleScriptUrl) {
            try {
                // Prepare product data for Google Apps Script
                // Map to exact column structure (A-AT)
                const productData: Record<string, any> = {
                    Code: savedItem.Code,
                    SU: savedItem.SU,
                    SKU: savedItem.SKU,
                    Barcode: savedItem.Barcode,
                    Description: savedItem.Description,
                    HL: savedItem.HL,
                    Qty: savedItem.Qty || 0,
                    Stock: savedItem.Stock || 0,
                    Sold: savedItem.Sold || 0,
                    Color: savedItem.Color || '',
                    Cluster: savedItem.ClusterColor || savedItem.Cluster || '',  // Use ClusterColor field
                    AttColor: savedItem.AttColor || savedItem.Color || '',
                    Location: savedItem.Location || '',
                    Comment: savedItem.Comment || '',
                    CatCode: savedItem.CatCode,
                    ModelCode: savedItem.ModelCode,
                    Category: savedItem.Category,
                    SubCat: savedItem.SubCat,
                    NetCost: savedItem.NetCost || 0,
                    DiscRate: savedItem.DiscRate || 0,
                    FinalCost: savedItem.FinalCost || 0,
                    RefPrice: savedItem.RefPrice || 0,
                    ListPrice: savedItem.ListPrice,
                    // Don't include SalePrice if it's 0
                    ...(savedItem.SalePrice && savedItem.SalePrice > 0 ? { SalePrice: savedItem.SalePrice } : {}),
                    PostID: savedItem.PostID || '',
                    PostStatus: savedItem.PostStatus || '',
                    StockStatus: savedItem.StockStatus || '',  // Don't auto-fill
                    nCategory: savedItem.nCategory || '',
                    nSubCategory: savedItem.nSubCategory || '',
                    ProductTag: savedItem.ProductTag || '',
                    ProductStyle: savedItem.ProductStyle || '',
                    PostTitle: savedItem.PostTitle || '',
                    PostSlug: savedItem.PostSlug || '',
                    PostContent: savedItem.PostContent || '',
                    PostShortDesc: savedItem.PostShortDesc || '',
                    ProductCat: savedItem.ProductCat || '',
                    FocusKW: savedItem.FocusKW || '',
                    MetaTitle: savedItem.MetaTitle || '',
                    MetaDesc: savedItem.MetaDesc || '',
                    ProductPage: savedItem.ProductPage || '',
                    Images: savedItem.Images || '',
                    Image: savedItem.Image || '',
                    TapPrtName: savedItem.TapPrtName || '',
                    PNDesc: savedItem.PNDesc || '',
                    PNLen: savedItem.PNLen || 0,
                    Per: savedItem.Per || 1
                };

                await fetch(googleScriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'add_product',
                        product: productData
                    })
                });
            } catch (e) {
                console.error("Failed to sync to Google Sheet", e);
                // Don't throw - product is already in Supabase
            }
        }

        return savedItem;
    },

    // 6. Update Product with Google Sheet Sync
    updateProductWithSync: async (item: InventoryItem, googleScriptUrl: string): Promise<InventoryItem> => {
        console.log('📤 updateProductWithSync called for:', item.Code);
        console.log('📍 Google Script URL:', googleScriptUrl);

        // Step 1: Update in Supabase first
        const updatedItem = await coreService.updateItemInSupabase(item);
        console.log('✅ Supabase updated successfully');

        // Step 2: Sync to Google Sheet
        if (googleScriptUrl) {
            try {
                // Prepare product data for Google Apps Script
                const productData: Record<string, any> = {
                    Code: updatedItem.Code,
                    SU: updatedItem.SU,
                    SKU: updatedItem.SKU,
                    Barcode: updatedItem.Barcode,
                    Description: updatedItem.Description,
                    HL: updatedItem.HL,
                    Qty: updatedItem.Qty || 0,
                    Stock: updatedItem.Stock || 0,
                    Sold: updatedItem.Sold || 0,
                    Color: updatedItem.Color || '',
                    Cluster: updatedItem.ClusterColor || updatedItem.Cluster || '',
                    AttColor: updatedItem.AttColor || updatedItem.Color || '',
                    Location: updatedItem.Location || '',
                    Comment: updatedItem.Comment || '',
                    CatCode: updatedItem.CatCode,
                    ModelCode: updatedItem.ModelCode || updatedItem.Model,
                    Category: updatedItem.Category,
                    SubCat: updatedItem.SubCat,
                    NetCost: updatedItem.NetCost || 0,
                    DiscRate: updatedItem.DiscRate || 0,
                    FinalCost: updatedItem.FinalCost || 0,
                    RefPrice: updatedItem.RefPrice || 0,
                    ListPrice: updatedItem.ListPrice,
                    ...(updatedItem.SalePrice && updatedItem.SalePrice > 0 ? { SalePrice: updatedItem.SalePrice } : {}),
                    PostID: updatedItem.PostID || '',
                    PostStatus: updatedItem.PostStatus || '',
                    StockStatus: updatedItem.StockStatus || '',
                    nCategory: updatedItem.nCategory || '',
                    nSubCategory: updatedItem.nSubCategory || '',
                    ProductTag: updatedItem.ProductTag || '',
                    ProductStyle: updatedItem.ProductStyle || '',
                    PostTitle: updatedItem.PostTitle || '',
                    PostSlug: updatedItem.PostSlug || '',
                    PostContent: updatedItem.PostContent || '',
                    PostShortDesc: updatedItem.PostShortDesc || '',
                    ProductCat: updatedItem.ProductCat || '',
                    FocusKW: updatedItem.FocusKW || '',
                    MetaTitle: updatedItem.MetaTitle || '',
                    MetaDesc: updatedItem.MetaDesc || '',
                    ProductPage: updatedItem.ProductPage || '',
                    Images: updatedItem.Images || '',
                    Image: updatedItem.Image || '',
                    TapPrtName: updatedItem.TapPrtName || '',
                    PNDesc: updatedItem.PNDesc || '',
                    PNLen: updatedItem.PNLen || 0,
                    Per: updatedItem.Per || 1
                };

                const payload = {
                    type: 'update_product',
                    product: productData
                };

                console.log('📨 Sending to Google Sheet:', payload);

                await fetch(googleScriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                console.log('✅ Product synced to Google Sheet:', updatedItem.Code);
            } catch (e) {
                console.error("❌ Failed to sync update to Google Sheet", e);
                // Don't throw - product is already updated in Supabase
            }
        } else {
            console.warn('⚠️ No Google Script URL configured - skipping Google Sheet sync');
        }

        return updatedItem;
    },


    // Alias for updateItemInSupabase (for consistency)
    updateCoreItem: async (code: string, item: InventoryItem): Promise<InventoryItem> => {
        return await coreService.updateItemInSupabase(item);
    },

    // Append order tag to product Comment (used during sync)
    appendCommentTag: async (productCode: string, orderTag: string): Promise<void> => {
        const supabase = getSupabase();

        try {
            // 1. Fetch current product
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('comment')
                .eq('code', productCode)
                .single();

            if (error) {
                console.error(`Error fetching product ${productCode}:`, error);
                return;
            }

            if (!data) {
                console.warn(`Product ${productCode} not found in Supabase`);
                return;
            }

            let currentComment = String(data.comment || '').trim();

            // 2. Check if tag already exists
            if (currentComment.includes(orderTag)) {
                console.log(`Tag ${orderTag} already exists in ${productCode}`);
                return;
            }

            // 3. Append tag (same logic as Google Apps Script)
            let newComment = '';
            if (currentComment) {
                // Limit to 3 tags (keep last 2 + new one)
                const semicolonCount = (currentComment.match(/;/g) || []).length;
                if (semicolonCount >= 2) {
                    const firstSemicolonIndex = currentComment.indexOf(';');
                    currentComment = currentComment.substring(firstSemicolonIndex + 1);
                }
                newComment = currentComment + ';' + orderTag;
            } else {
                newComment = orderTag;
            }

            // 4. Update Supabase
            const { error: updateError } = await supabase
                .from(TABLE_NAME)
                .update({ comment: newComment, updated_at: new Date().toISOString() })
                .eq('code', productCode);

            if (updateError) {
                console.error(`Error updating comment for ${productCode}:`, updateError);
            } else {
                console.log(`✅ Updated comment for ${productCode}: ${newComment}`);
            }
        } catch (error) {
            console.error(`Exception in appendCommentTag for ${productCode}:`, error);
        }
    },

    // Get all product codes for BOM selection
    getAllProductCodes: (): string[] => {
        // This will be populated from the in-memory cache
        // For now, return empty array - will be populated when data is loaded
        const cachedData = (window as any).__CORE_DATA_CACHE__;
        if (cachedData && Array.isArray(cachedData)) {
            return cachedData
                .map((item: InventoryItem) => item.Code)
                .filter((code: string) => code && code.trim() !== '')
                .sort();
        }
        return [];
    },

    // Fuzzy search for SKUs based on SubCategory/Category keyword, optionally filtered by height range
    searchSkusByKeyword: async (keyword: string, minHeight?: number, maxHeight?: number): Promise<{ sku: string, code: string, hl: string }[]> => {
        const supabase = getSupabase();

        // Prepare keyword variants for loose matching (Singular/Plural)
        const variants = new Set<string>();
        const k = keyword.trim();
        variants.add(k);

        // Handle plural/singular "Hosta" <-> "Hostas"
        if (k.toLowerCase().endsWith('s')) variants.add(k.slice(0, -1));
        else variants.add(k + 's');

        // Handle condensed "Bird of Paradise" <-> "BirdofParadise"
        const clean = k.replace(/\s+/g, '');
        if (clean !== k) variants.add(clean);

        const tryMatch = async (col: string) => {
            // Construct OR clause for all variants
            const orStr = Array.from(variants).map(v => `${col}.ilike.%${v}%`).join(',');

            let query = supabase
                .from(TABLE_NAME)
                .select('*')
                .or(orStr);

            const { data, error } = await query.limit(100);
            if (error) return [];

            let filtered = data || [];

            if (minHeight !== undefined && maxHeight !== undefined) {
                filtered = filtered.filter(item => {
                    // diverse column names possible: "Height", "Size" (often "180cm"), "dimensions"
                    // User specified 'HL' is the column for height.
                    let hStr = item.HL || item.hl || item.Height || item.height || item.Size || item.size;

                    if (!hStr) return false;

                    let hNum = parseFloat(String(hStr).replace(/[^0-9.]/g, ''));
                    if (isNaN(hNum)) return false;

                    return hNum >= minHeight && hNum <= maxHeight;
                });
            }

            // Map to metadata objects
            return filtered.map(item => ({
                sku: item.sku,
                code: item.code || '',
                hl: item.HL || item.hl || item.Height || item.height || ''
            }));
        };

        const mergeResults = (listA: any[], listB: any[]) => {
            const map = new Map();
            [...listA, ...listB].forEach(item => {
                if (item.sku && !map.has(item.sku)) map.set(item.sku, item);
            });
            return Array.from(map.values());
        };

        // 1. Try SubCategory
        const subData = await tryMatch('sub_cat');

        // 2. Try Category (if SubCategory yields strictly nothing? Or combine? Usually combine is better or fallback)
        // User asked for "search rules" flow. Previous code was Fallback.
        // Let's keep Fallback to avoid noise if precise subcat match exists.
        if (subData.length > 0) {
            return subData;
        }

        const catData = await tryMatch('category');
        return catData;
    },

    // Get exact product details by searching SKU or Code
    getProductByCodeOrSku: async (identifier: string): Promise<{ sku: string, code: string, hl: string, pndesc: string } | null> => {
        const supabase = getSupabase();

        // Try exact match on 'sku' or 'code'
        // Using 'ilike' for robustness against case differences
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .or(`sku.ilike.${identifier},code.ilike.${identifier}`)
            .limit(1);

        if (error || !data || data.length === 0) return null;

        const item = data[0];
        return {
            sku: item.sku,
            code: item.code || '',
            hl: item.HL || item.hl || item.Height || item.height || '',
            pndesc: item.pn_desc || item.PNDesc || ''
        };
    }
};
