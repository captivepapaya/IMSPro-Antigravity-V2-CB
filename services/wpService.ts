

import { WordPressConfig } from '../types';

// Helper function to build API base URL with proxy support
const getApiBaseUrl = (config: WordPressConfig): string => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDev) {
        return '/wp-api';
    }
    return config.url.replace(/\/$/, '') + '/wp-json';
};

const getAuthHeader = (config: WordPressConfig): Record<string, string> => {
    if (!config.username || !config.appPassword) {
        console.log('⚠️ Missing WordPress credentials:', {
            hasUsername: !!config.username,
            hasPassword: !!config.appPassword
        });
        return {};
    }
    const encoded = btoa(`${config.username}:${config.appPassword}`);
    console.log('🔐 Auth header generated for user:', config.username);
    return {
        'Authorization': `Basic ${encoded}`
    };
};

export const fetchWpImage = async (sku: string, config: WordPressConfig): Promise<string | null> => {
    if (!config.url || !sku) return null;
    const baseUrl = getApiBaseUrl(config);
    const endpoint = `${baseUrl}/wp/v2/media`;

    try {
        const searchUrl = new URL(endpoint, window.location.origin);
        searchUrl.searchParams.append('search', sku);
        searchUrl.searchParams.append('_fields', 'id,source_url,slug');
        searchUrl.searchParams.append('per_page', '50');

        const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader(config) }
        });

        if (!response.ok) return null;
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            const cleanSku = sku.toLowerCase().trim();

            const exactMatch = data.find(m => {
                const s = (m.source_url || '').toLowerCase();
                return s.includes(cleanSku) && (s.endsWith(`/${cleanSku}.jpg`) || s.endsWith(`/${cleanSku}.webp`) || s.endsWith(`/${cleanSku}.png`));
            });
            if (exactMatch) return exactMatch.source_url;

            const looseMatch = data.find(m => {
                const s = (m.source_url || '').toLowerCase();
                return s.includes(cleanSku);
            });
            if (looseMatch) return looseMatch.source_url;

            return data[0].source_url;
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch image:", error);
        return null;
    }
};

export interface WpProductDetails {
    id: number;
    status: string;
    title: string;
    slug: string;
    short_description: string;
    description: string;
    categories: { id: number; name: string; slug: string }[];
    tags: { id: number; name: string }[];
    images: { id: number; src: string; alt: string; name: string }[];
    meta_data: any[];
    permalink: string;
    stock_status: string;
    // Price fields
    regular_price?: string;
    sale_price?: string;
    // Yoast SEO fields
    yoast_focus_kw?: string;
    yoast_meta_title?: string;
    yoast_meta_desc?: string;
    // Custom fields
    product_style?: string;
}

export const fetchWpProductDetails = async (id: string, config: WordPressConfig): Promise<WpProductDetails | null> => {
    if (!config.url || !id) return null;
    const baseUrl = getApiBaseUrl(config);
    const endpoint = `${baseUrl}/wc/v3/products/${id}`;

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader(config) }
        });

        if (!response.ok) {
            console.warn(`WordPress API ${endpoint} returned ${response.status}`);
            return null;
        }

        const data = await response.json();

        // Extract Yoast and custom fields from meta_data
        const getMeta = (key: string) => {
            const meta = data.meta_data?.find((m: any) => m.key === key);
            return meta?.value || '';
        };

        const result = {
            id: data.id,
            status: data.status,
            title: data.name || '',
            slug: data.slug || '',
            short_description: data.short_description || '',
            description: data.description || '',
            categories: data.categories || [],
            tags: data.tags || [],
            images: data.images || [],
            meta_data: data.meta_data || [],
            permalink: data.permalink || '',
            stock_status: data.stock_status || '',
            // Prices
            regular_price: data.regular_price || '',
            sale_price: data.sale_price || '',
            // Yoast SEO
            yoast_focus_kw: getMeta('_yoast_wpseo_focuskw') || getMeta('yoast_wpseo_focuskw'),
            yoast_meta_title: getMeta('_yoast_wpseo_title') || getMeta('yoast_wpseo_title'),
            yoast_meta_desc: getMeta('_yoast_wpseo_metadesc') || getMeta('yoast_wpseo_metadesc'),
            // Custom
            product_style: getMeta('product_style') || getMeta('_product_style')
        };

        console.log('WordPress Product Data:', {
            id: result.id,
            title: result.title,
            categories: result.categories.map((c: any) => c.name),
            tags: result.tags.map((t: any) => t.name),
            images_count: result.images.length,
            yoast_focus_kw: result.yoast_focus_kw,
            yoast_meta_title: result.yoast_meta_title,
            product_style: result.product_style,
            all_meta_keys: data.meta_data?.map((m: any) => m.key) || []
        });

        return result;
    } catch (error) {
        console.error("Failed to fetch product details:", error);
        return null;
    }
};

// NEW: Update WordPress product fields
export const updateWpProductFields = async (
    productId: string,
    fields: Record<string, any>,
    config: WordPressConfig
): Promise<boolean> => {
    if (!config.url || !productId) return false;
    const baseUrl = getApiBaseUrl(config);
    const endpoint = `${baseUrl}/wc/v3/products/${productId}`;

    try {
        const updateData: any = {};
        const metaData: any[] = [];

        // Map field keys to WordPress API fields
        if (fields.postTitle !== undefined) updateData.name = fields.postTitle;
        if (fields.postSlug !== undefined) updateData.slug = fields.postSlug;
        if (fields.shortDescription !== undefined) updateData.short_description = fields.shortDescription;
        if (fields.postContent !== undefined) updateData.description = fields.postContent;
        if (fields.postStatus !== undefined) updateData.status = fields.postStatus;
        if (fields.stockStatus !== undefined) updateData.stock_status = fields.stockStatus;

        // Price fields
        if (fields.regularPrice !== undefined) updateData.regular_price = fields.regularPrice;
        if (fields.salePrice !== undefined) {
            // If sale price is 0 or empty, set to empty string to remove it
            updateData.sale_price = (fields.salePrice && parseFloat(fields.salePrice) > 0) ? fields.salePrice : '';
        }

        // Yoast SEO fields (as meta_data)
        if (fields.focusKW !== undefined) {
            metaData.push({ key: '_yoast_wpseo_focuskw', value: fields.focusKW });
        }
        if (fields.metaTitle !== undefined) {
            metaData.push({ key: '_yoast_wpseo_title', value: fields.metaTitle });
        }
        if (fields.metaDesc !== undefined) {
            metaData.push({ key: '_yoast_wpseo_metadesc', value: fields.metaDesc });
        }

        // Custom fields
        if (fields.productStyle !== undefined) {
            metaData.push({ key: '_product_style', value: fields.productStyle });
        }
        if (fields.productTag !== undefined) {
            metaData.push({ key: '_product_tag', value: fields.productTag });
        }

        if (metaData.length > 0) {
            updateData.meta_data = metaData;
        }

        console.log('Updating WordPress product:', productId, updateData);

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader(config)
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('WordPress update failed:', response.status, errorText);
            return false;
        }

        const result = await response.json();
        console.log('WordPress product updated successfully:', result.id);
        return true;
    } catch (error) {
        console.error('Error updating WordPress product:', error);
        return false;
    }
};

export interface ScannedImage {
    url: string;
    wp_id: number;
    variant: 'main' | 'variant';
    sort_order: number;
    width?: number;
    height?: number;
}

export const scanProductImages = async (sku: string, config: WordPressConfig, strategy: 'strict' | 'loose' = 'strict'): Promise<ScannedImage[]> => {
    if (!config.url || !sku) return [];

    const baseUrl = getApiBaseUrl(config);
    const endpoint = `${baseUrl}/wp/v2/media`;

    try {
        const fetchSearch = async (term: string) => {
            const u = new URL(endpoint, window.location.origin);
            u.searchParams.append('search', term);
            u.searchParams.append('_fields', 'id,source_url,slug');
            u.searchParams.append('per_page', '50');
            console.log(`🔍 Fetching: ${term}`);
            const r = await fetch(u.toString(), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader(config) }
            });
            return r.ok ? await r.json() : [];
        };

        // Parallel Fetch Strategy: Main SKU, Hyphen base (for variants), Space base (for tokenized variants)
        const [r1, r2, r3] = await Promise.all([
            fetchSearch(sku),
            fetchSearch(sku + '-'),
            fetchSearch(sku + ' ')
        ]);

        const rawData = [
            ...(Array.isArray(r1) ? r1 : []),
            ...(Array.isArray(r2) ? r2 : []),
            ...(Array.isArray(r3) ? r3 : [])
        ];

        // Deduplicate by ID
        const dataMap = new Map();
        rawData.forEach((item: any) => dataMap.set(item.id, item));
        const data = Array.from(dataMap.values());

        console.log(`📦 WP API Combined: ${data.length} unique items for "${sku}"`);

        if (data.length === 0) return [];

        // Normalize SKU for comparison (remove separators to match loose filenames)
        const normalizedInputSku = sku.toLowerCase().replace(/[^a-z0-9]/g, '');
        const results: ScannedImage[] = [];

        for (const media of data) {
            const url = media.source_url;
            const lowerUrl = url.toLowerCase();
            const filename = lowerUrl.split('/').pop() || '';

            // Skip generated thumbnails
            if (/-\d+x\d+\.(jpg|jpeg|png|webp)$/.test(filename)) continue;

            const baseName = filename.replace(/\.(jpg|jpeg|png|webp)$/, '').replace(/-scaled$/, '');
            const normalizedBase = baseName.replace(/[^a-z0-9]/g, '');

            // Must match SKU rules
            if (strategy === 'loose') {
                if (!normalizedBase.includes(normalizedInputSku)) continue;
            } else {
                if (!normalizedBase.startsWith(normalizedInputSku)) continue;
            }

            let variant: 'main' | 'variant' = 'variant';
            let order = 99;

            const residue = normalizedBase.substring(normalizedInputSku.length);

            if (residue === '') {
                variant = 'main';
                order = 0;
            } else {
                // Try to parse sort order from residue (e.g. sku1, sku-1 -> residue '1')
                if (/^\d+$/.test(residue)) {
                    order = parseInt(residue, 10);
                } else {
                    // Try to match original filename separator logic for better safety
                    // e.g. sku-copy -> residue 'copy' -> order 10
                    const match = baseName.match(/[-_](\d+)$/);
                    if (match) order = parseInt(match[1], 10);
                    else order = 10;
                }
            }

            results.push({
                url: url,
                wp_id: media.id,
                variant: variant,
                sort_order: order,
                width: media.media_details?.width,
                height: media.media_details?.height
            });
        }

        const uniqueMap = new Map<number, ScannedImage>();
        results.forEach(img => {
            if (!uniqueMap.has(img.sort_order)) {
                uniqueMap.set(img.sort_order, img);
            } else if (img.url.endsWith('.webp')) {
                uniqueMap.set(img.sort_order, img);
            }
        });

        return Array.from(uniqueMap.values()).sort((a, b) => a.sort_order - b.sort_order);
    } catch (e) {
        console.error("Scan error", e);
        return [];
    }
};

export const searchMediaLibrary = async (term: string, config: WordPressConfig): Promise<{ id: number, url: string, title: string }[]> => {
    if (!config.url || !term) return [];
    const baseUrl = getApiBaseUrl(config);

    try {
        const searchUrl = new URL(`${baseUrl}/wp/v2/media`, window.location.origin);
        searchUrl.searchParams.append('search', term);
        searchUrl.searchParams.append('_fields', 'id,source_url,title');
        searchUrl.searchParams.append('per_page', '20'); // Limit results

        const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader(config) }
        });

        if (!response.ok) return [];
        const data = await response.json();

        if (Array.isArray(data)) {
            return data.map((item: any) => ({
                id: item.id,
                url: item.source_url,
                title: item.title?.rendered || 'Untitled'
            }));
        }
        return [];
    } catch (e) {
        console.error("Error searching media library", e);
        return [];
    }
};

export const fetchWpProductStatus = async (id: string, config: WordPressConfig): Promise<string | null> => {
    if (!config.url || !id) {
        console.log('fetchWpProductStatus - Missing config.url or id:', { url: config.url, id });
        return null;
    }

    // Use proxy in development (localhost), direct URL in production
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isDev ? '/wp-api' : config.url.replace(/\/$/, '') + '/wp-json';
    const endpoint = `${baseUrl}/wc/v3/products/${id}`;

    console.log('fetchWpProductStatus - Calling:', endpoint, '(isDev:', isDev, ')');

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader(config) }
        });

        console.log('fetchWpProductStatus - WooCommerce API response:', response.status, response.statusText);

        if (!response.ok) {
            // Fallback to standard posts if not a WC product
            const postEndpoint = `${baseUrl}/wp/v2/posts/${id}?_fields=status`;
            console.log('fetchWpProductStatus - Trying fallback posts API:', postEndpoint);
            const postRes = await fetch(postEndpoint, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader(config) }
            });
            console.log('fetchWpProductStatus - Posts API response:', postRes.status, postRes.statusText);
            if (!postRes.ok) {
                console.log('fetchWpProductStatus - Both APIs failed, returning null');
                return null;
            }
            const postData = await postRes.json();
            console.log('fetchWpProductStatus - Posts data:', postData);
            return postData.status;
        }
        const data = await response.json();
        console.log('fetchWpProductStatus - WooCommerce data:', { id: data.id, status: data.status });
        return data.status;
    } catch (error) {
        console.error("fetchWpProductStatus - Error:", error);
        return null;
    }
};

// Fetch WordPress product by SKU
export const fetchWpProductBySku = async (sku: string, config: WordPressConfig): Promise<{
    id: number;
    status: string;
    name: string;
    permalink: string;
} | null> => {
    if (!config.url || !sku) {
        console.log('🔍 fetchWpProductBySku - Missing config or SKU');
        return null;
    }

    const baseUrl = getApiBaseUrl(config);
    const endpoint = `${baseUrl}/wc/v3/products`;

    try {
        console.log('🔍 fetchWpProductBySku - Searching for SKU:', sku);
        const searchUrl = new URL(endpoint, window.location.origin);
        searchUrl.searchParams.append('sku', sku);
        searchUrl.searchParams.append('_fields', 'id,status,name,permalink');

        const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader(config) }
        });

        if (!response.ok) {
            console.log('🔍 fetchWpProductBySku - API call failed:', response.status);
            return null;
        }

        const data = await response.json();
        console.log('🔍 fetchWpProductBySku - Response:', data);

        if (Array.isArray(data) && data.length > 0) {
            const product = data[0];
            console.log('🔍 fetchWpProductBySku - Found product:', { id: product.id, status: product.status, name: product.name });
            return {
                id: product.id,
                status: product.status,
                name: product.name,
                permalink: product.permalink
            };
        }

        console.log('🔍 fetchWpProductBySku - No product found for SKU:', sku);
        return null;
    } catch (error) {
        console.error("🔍 fetchWpProductBySku - Error:", error);
        return null;
    }
};
