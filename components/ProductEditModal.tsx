import React, { useState, useEffect } from 'react';
import { InventoryItem, WordPressConfig } from '../types';
import { X, RefreshCw, Clock, ExternalLink, Info, Globe, Database, ArrowRight, ArrowLeft } from 'lucide-react';
import { fetchWpProductDetails, WpProductDetails } from '../services/wpService';
import { coreService } from '../services/coreService';
import { synonymService } from '../services/synonymService';
import { useToast } from '../hooks/useToast';

interface ProductEditModalProps {
    item: InventoryItem;
    wpConfig: WordPressConfig;
    onClose: () => void;
}

const ComparisonTooltip = ({ wpValue, localValue, label, alignLeft }: { wpValue: any, localValue: any, label: string, alignLeft?: boolean }) => {
    const [show, setShow] = useState(false);

    // Helper to strip HTML and normalize for display
    const stripHtml = (text: any): string => {
        if (!text) return '';
        return String(text).replace(/<[^>]*>/g, '');
    };

    // Get normalized versions for comparison
    const normalizedWp = normalizeText(wpValue);
    const normalizedLocal = normalizeText(localValue);
    const isMatch = normalizedWp === normalizedLocal;

    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!show && buttonRef.current) {
            setButtonRect(buttonRef.current.getBoundingClientRect());
        }
        setShow(!show);
    };

    return (
        <div className="relative inline-block">
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className={`w-4 h-4 rounded-full ${show ? 'bg-gemini-600' : 'bg-dark-border'} hover:bg-gray-600 flex items-center justify-center transition-colors`}
            >
                <Info className="w-3 h-3 text-gray-400" />
            </button>
            {show && buttonRect && (
                <>
                    {/* Backdrop to close on click */}
                    <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => setShow(false)}
                    />
                    {/* Tooltip content - Fixed positioning */}
                    <div
                        className="fixed z-[9999] w-[500px] bg-dark-bg border-2 border-gemini-500 rounded-lg shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            left: alignLeft ? buttonRect.left : 'auto',
                            right: alignLeft ? 'auto' : `${window.innerWidth - buttonRect.right}px`,
                            top: `${buttonRect.bottom + 8}px`,
                            maxHeight: `${window.innerHeight - buttonRect.bottom - 20}px`,
                            overflowY: 'auto'
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-bold text-gemini-400">{label}</div>
                            <div className={`text-xs font-bold ${isMatch ? 'text-green-500' : 'text-red-500'}`}>
                                {isMatch ? '✓ Match (after normalization)' : '✕ Different'}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* WordPress Value */}
                            <div>
                                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                                    <span>WordPress (Raw):</span>
                                    <span className="text-gray-600">{String(wpValue || '').length} chars</span>
                                </div>
                                <div className="bg-blue-900/20 border border-blue-500/30 rounded p-2 text-xs text-white break-words max-h-40 overflow-y-auto custom-scrollbar">
                                    {wpValue || <span className="text-gray-600 italic">No data</span>}
                                </div>
                            </div>

                            {/* Supabase Value */}
                            <div>
                                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                                    <span>Supabase (Raw):</span>
                                    <span className="text-gray-600">{String(localValue || '').length} chars</span>
                                </div>
                                <div className="bg-purple-900/20 border border-purple-500/30 rounded p-2 text-xs text-white break-words max-h-40 overflow-y-auto custom-scrollbar">
                                    {localValue || <span className="text-gray-600 italic">No data</span>}
                                </div>
                            </div>

                            {/* Normalized Comparison */}
                            {!isMatch && (
                                <div className="border-t border-dark-border pt-3">
                                    <div className="text-[10px] text-yellow-500 mb-2 font-bold">Normalized Comparison (HTML stripped, whitespace removed):</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-[9px] text-gray-500 mb-1">WP Normalized:</div>
                                            <div className="bg-blue-900/10 border border-blue-500/20 rounded p-1 text-[10px] text-white break-all max-h-20 overflow-y-auto custom-scrollbar">
                                                {normalizedWp || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-gray-500 mb-1">DB Normalized:</div>
                                            <div className="bg-purple-900/10 border border-purple-500/20 rounded p-1 text-[10px] text-white break-all max-h-20 overflow-y-auto custom-scrollbar">
                                                {normalizedLocal || '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-3 text-[9px] text-gray-600 italic">
                            Click outside to close
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};


const SyncIndicator = ({
    isMatch,
    isEmpty,
    wpValue,
    localValue,
    label,
    alignLeft,
    fieldKey,
    isSelected,
    onToggleSelect
}: {
    isMatch: boolean | null,
    isEmpty?: boolean,
    wpValue?: any,
    localValue?: any,
    label?: string,
    alignLeft?: boolean,
    fieldKey?: string,
    isSelected?: boolean,
    onToggleSelect?: (fieldKey: string) => void
}) => {
    if (isEmpty) return <div className="w-3 h-3" />;

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (fieldKey && onToggleSelect) {
            onToggleSelect(fieldKey);
        }
    };

    if (isMatch === null) return (
        <div className="flex items-center gap-1.5">
            {fieldKey && (
                <button
                    onClick={handleCheckboxClick}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${isSelected
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-600 hover:border-gray-400'
                        }`}
                />
            )}
            <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />
            {label && wpValue !== undefined && localValue !== undefined && (
                <ComparisonTooltip wpValue={wpValue} localValue={localValue} label={label} alignLeft={alignLeft} />
            )}
        </div>
    );

    return (
        <div className="flex items-center gap-1.5">
            {fieldKey && (
                <button
                    onClick={handleCheckboxClick}
                    className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${isSelected
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-600 hover:border-gray-400'
                        }`}
                >
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </button>
            )}
            <div className={`w-3 h-3 font-bold ${isMatch ? 'text-green-500' : 'text-red-500'}`}>
                {isMatch ? '✓' : '✕'}
            </div>
            {label && wpValue !== undefined && localValue !== undefined && (
                <ComparisonTooltip wpValue={wpValue} localValue={localValue} label={label} alignLeft={alignLeft} />
            )}
        </div>
    );
};

// Normalized comparison - ignores case, punctuation, HTML tags, HTML entities, all whitespace
const normalizeText = (text: any): string => {
    if (!text) return '';

    let normalized = String(text);

    // Step 1: Decode HTML entities
    // Create a temporary DOM element to decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = normalized;
    normalized = textarea.value;

    // Step 2: Remove HTML tags
    normalized = normalized.replace(/<[^>]*>/g, '');

    // Step 3: Remove all whitespace (spaces, newlines, tabs, etc.)
    normalized = normalized.replace(/\s+/g, '');

    // Step 4: Convert to lowercase
    normalized = normalized.toLowerCase();

    // Step 5: Remove all non-word characters (punctuation, etc.)
    normalized = normalized.replace(/[^\w]/g, '');

    return normalized.trim();
};

const parseImages = (imagesStr: string) => {
    if (!imagesStr) return [];
    const sections = imagesStr.split('!').map(s => s.trim()).filter(Boolean);
    const images: { url: string; alt: string }[] = [];

    let currentUrl = '';
    let currentAlt = '';

    for (const section of sections) {
        if (section.startsWith('http')) {
            if (currentUrl) images.push({ url: currentUrl, alt: currentAlt });
            currentUrl = section;
            currentAlt = '';
        } else if (section.startsWith('alt :')) {
            currentAlt = section.replace('alt :', '').trim();
        }
    }

    if (currentUrl) images.push({ url: currentUrl, alt: currentAlt });
    return images;
};

const parseCategoryTree = (catStr: string) => {
    if (!catStr) return [];
    const branches = catStr.split('|').map(b => b.trim());
    const tree: { parent: string; child?: string }[] = [];

    branches.forEach(branch => {
        if (branch.includes('>')) {
            const [parent, child] = branch.split('>').map(s => s.trim());
            tree.push({ parent, child });
        } else {
            tree.push({ parent: branch });
        }
    });

    return tree;
};

export const ProductEditModal: React.FC<ProductEditModalProps> = ({ item, wpConfig, onClose }) => {
    const toast = useToast();
    const [wpData, setWpData] = useState<WpProductDetails | null>(null);
    const [supabaseData, setSupabaseData] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadTime, setLoadTime] = useState<number>(0);
    const [showAltForImage, setShowAltForImage] = useState<number | null>(null);
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
    const [syncing, setSyncing] = useState(false);

    const toggleFieldSelection = (fieldKey: string) => {
        setSelectedFields(prev => {
            const next = new Set(prev);
            if (next.has(fieldKey)) {
                next.delete(fieldKey);
            } else {
                next.add(fieldKey);
            }
            return next;
        });
    };

    const handleSyncAToSupabase = async () => {
        if (selectedFields.size === 0) {
            alert('Please select at least one field to sync.');
            return;
        }
        if (!wpData) {
            toast.error('No WordPress data available to sync.');
            return;
        }

        setSyncing(true);
        try {
            // Prepare update data from WordPress to Supabase
            const updateData: Partial<InventoryItem> = {};
            const fieldMapping: Record<string, keyof InventoryItem> = {
                'postTitle': 'PostTitle',
                'shortDescription': 'PostShortDesc',
                'postSlug': 'PostSlug',
                'focusKW': 'FocusKW',
                'metaTitle': 'MetaTitle',
                'metaDesc': 'MetaDesc',
                'postContent': 'PostContent',
                'postStatus': 'PostStatus',
                'stockStatus': 'StockStatus',
                'productTag': 'ProductTag',
                'productStyle': 'ProductStyle',
                'productURL': 'ProductPage',
                'mainImage': 'Image',
                'regularPrice': 'ListPrice',
                'salePrice': 'SalePrice',
                'productImages': 'Images'  // Maps to Images field in Supabase
            };

            selectedFields.forEach(fieldKey => {
                const supabaseField = fieldMapping[fieldKey];
                if (supabaseField) {
                    switch (fieldKey) {
                        case 'postTitle':
                            updateData[supabaseField] = wpData.title;
                            break;
                        case 'shortDescription':
                            updateData[supabaseField] = wpData.short_description;
                            break;
                        case 'postSlug':
                            updateData[supabaseField] = wpData.slug;
                            break;
                        case 'focusKW':
                            updateData[supabaseField] = wpData.yoast_focus_kw || '';
                            break;
                        case 'metaTitle':
                            updateData[supabaseField] = wpData.yoast_meta_title || '';
                            break;
                        case 'metaDesc':
                            updateData[supabaseField] = wpData.yoast_meta_desc || '';
                            break;
                        case 'postContent':
                            updateData[supabaseField] = wpData.description;
                            break;
                        case 'postStatus':
                            updateData[supabaseField] = wpData.status;
                            break;
                        case 'stockStatus':
                            updateData[supabaseField] = wpData.stock_status;
                            break;
                        case 'productTag':
                            updateData[supabaseField] = wpData.tags?.map((t: any) => t.name).join(', ') || '';
                            break;
                        case 'productStyle':
                            updateData[supabaseField] = wpData.product_style || '';
                            break;
                        case 'productURL':
                            updateData[supabaseField] = wpData.permalink;
                            break;
                        case 'mainImage':
                            updateData[supabaseField] = wpData.images?.[0]?.src || '';
                            break;
                        case 'regularPrice':
                            updateData[supabaseField] = wpData.regular_price || '';
                            break;
                        case 'salePrice':
                            // Treat 0 or empty as no sale price
                            const salePrice = wpData.sale_price || '';
                            updateData[supabaseField] = (salePrice && Number(salePrice) > 0) ? salePrice : '';
                            break;
                        case 'productImages':
                            // Convert WordPress images array to Supabase format
                            // Format: ! URL ! alt : ALT_TEXT ! URL ! alt : ALT_TEXT
                            if (wpData.images && wpData.images.length > 0) {
                                const imagesParts: string[] = [];
                                wpData.images.forEach((img: any) => {
                                    imagesParts.push(img.src);
                                    if (img.alt) {
                                        imagesParts.push(`alt : ${img.alt}`);
                                    }
                                });
                                updateData.Images = imagesParts.join(' ! ');
                            } else {
                                updateData.Images = '';
                            }
                            break;
                    }
                }
            });

            // Update Supabase
            const updatedItem = { ...localItem, ...updateData };
            await coreService.updateCoreItem(item.Code, updatedItem);

            console.log('✅ Synced from WordPress to Supabase:', updateData);

            // Refresh data
            await refreshData();

            toast.success(`Successfully synced ${selectedFields.size} field${selectedFields.size !== 1 ? 's' : ''} from WordPress to Supabase.`);
            setSelectedFields(new Set());
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Sync failed. Please check the console for details.');
        } finally {
            setSyncing(false);
        }
    };

    const handleSyncBToWordPress = async () => {
        if (selectedFields.size === 0) {
            alert('Please select at least one field to sync.');
            return;
        }
        if (!item.PostID) {
            toast.error('No WordPress Post ID available for this product.');
            return;
        }

        // Check if only productImages is selected (not supported for Sync B)
        if (selectedFields.size === 1 && selectedFields.has('productImages')) {
            toast.warning('Image sync from Supabase to WordPress is not supported. Please use Sync A (WordPress → Supabase) for images.');
            setSyncing(false);
            return;
        }

        setSyncing(true);
        try {
            // Prepare update data from Supabase to WordPress
            const updateFields: Record<string, any> = {};

            selectedFields.forEach(fieldKey => {
                switch (fieldKey) {
                    case 'postTitle':
                        updateFields.postTitle = localItem.PostTitle;
                        break;
                    case 'shortDescription':
                        updateFields.shortDescription = localItem.PostShortDesc;
                        break;
                    case 'postSlug':
                        updateFields.postSlug = localItem.PostSlug;
                        break;
                    case 'focusKW':
                        updateFields.focusKW = localItem.FocusKW;
                        break;
                    case 'metaTitle':
                        updateFields.metaTitle = localItem.MetaTitle;
                        break;
                    case 'metaDesc':
                        updateFields.metaDesc = localItem.MetaDesc;
                        break;
                    case 'postContent':
                        updateFields.postContent = localItem.PostContent;
                        break;
                    case 'postStatus':
                        updateFields.postStatus = localItem.PostStatus;
                        break;
                    case 'stockStatus':
                        updateFields.stockStatus = localItem.StockStatus;
                        break;
                    case 'productTag':
                        updateFields.productTag = localItem.ProductTag;
                        break;
                    case 'productStyle':
                        updateFields.productStyle = localItem.ProductStyle;
                        break;
                    case 'regularPrice':
                        updateFields.regularPrice = localItem.ListPrice || '';
                        break;
                    case 'salePrice':
                        // Treat 0 or empty as no sale price
                        const salePrice = localItem.SalePrice || '';
                        updateFields.salePrice = (salePrice && Number(salePrice) > 0) ? salePrice : '';
                        break;
                    case 'productImages':
                        // Skip: Image sync from Supabase to WordPress is not supported
                        // WordPress requires images to be in the media library with media IDs
                        // Use Sync A (WordPress → Supabase) for image synchronization
                        break;
                }
            });

            // Update WordPress
            const { updateWpProductFields } = await import('../services/wpService');
            const success = await updateWpProductFields(item.PostID.toString(), updateFields, wpConfig);

            if (!success) {
                throw new Error('WordPress update failed');
            }

            console.log('✅ Synced from Supabase to WordPress:', updateFields);

            // Refresh data
            await refreshData();

            toast.success(`Successfully synced ${selectedFields.size} field${selectedFields.size !== 1 ? 's' : ''} from Supabase to WordPress.`);
            setSelectedFields(new Set());
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Sync failed. Please check the console for details.');
        } finally {
            setSyncing(false);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        const startTime = Date.now();

        try {
            // Fetch from Supabase using Code
            const supabaseItems = await coreService.fetchCoreFromSupabase();
            const foundItem = supabaseItems.find(i => i.Code === item.Code);
            setSupabaseData(foundItem || item);

            // Fetch from WordPress if PostID exists
            if (item.PostID) {
                const data = await fetchWpProductDetails(item.PostID.toString(), wpConfig);
                setWpData(data);
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setLoading(false);
            setLoadTime(Date.now() - startTime);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const startTime = Date.now();

            try {
                // Fetch from Supabase using Code
                const supabaseItems = await coreService.fetchCoreFromSupabase();
                const foundItem = supabaseItems.find(i => i.Code === item.Code);
                setSupabaseData(foundItem || item);

                // Fetch from WordPress if PostID exists
                if (item.PostID) {
                    const data = await fetchWpProductDetails(item.PostID.toString(), wpConfig);
                    setWpData(data);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                setSupabaseData(item);
            } finally {
                setLoading(false);
                setLoadTime(Date.now() - startTime);
            }
        };

        fetchData();
    }, [item.PostID, item.Code, wpConfig]);

    const hasPostID = !!item.PostID;
    const isEmpty = !hasPostID;

    // Use supabaseData for all comparisons (fallback to item if not loaded yet)
    const localItem = supabaseData || item;

    // Fuzzy comparison - WordPress vs Supabase
    const compareField = (wpValue: any, localValue: any) => {
        if (!hasPostID) return null;
        if (!wpData) return null;
        return normalizeText(wpValue) === normalizeText(localValue);
    };

    // Advanced category comparison using CatCode
    const compareCategoryField = (wpValue: string, localValue: string) => {
        if (!hasPostID) return null;
        if (!wpData) return null;
        if (!wpValue && !localValue) return true;
        if (!wpValue || !localValue) return false;

        // Helper function to extract category-subcategory pairs and get CatCodes
        const extractCatCodes = (value: string): Set<string> => {
            const catCodes = new Set<string>();

            // Split by | to get individual category entries
            const entries = value.split('|').map(s => s.trim()).filter(Boolean);

            for (const entry of entries) {
                // Try different separators: >, -, etc.
                const separators = ['>', '-', '–', '—'];
                let category = '';
                let subCategory = '';

                for (const sep of separators) {
                    if (entry.includes(sep)) {
                        const parts = entry.split(sep).map(s => s.trim());
                        if (parts.length >= 2) {
                            // Try both orders: "Category > SubCategory" and "SubCategory > Category"
                            // Compare with known categories to determine which is which
                            const categories = synonymService.getCategories();

                            const part1 = parts[0];
                            const part2 = parts[1];

                            // Check which part is the category
                            const part1IsCategory = categories.some((cat: string) =>
                                cat.toLowerCase() === part1.toLowerCase()
                            );
                            const part2IsCategory = categories.some((cat: string) =>
                                cat.toLowerCase() === part2.toLowerCase()
                            );

                            if (part1IsCategory) {
                                category = part1;
                                subCategory = part2;
                            } else if (part2IsCategory) {
                                category = part2;
                                subCategory = part1;
                            } else {
                                // Default: assume first is category
                                category = part1;
                                subCategory = part2;
                            }

                            break;
                        }
                    }
                }

                // If no separator found, treat as category only
                if (!category && !subCategory) {
                    category = entry;
                }

                // Get CatCode for this combination
                if (category && subCategory) {
                    const catCode = synonymService.findCatCode(category, subCategory);
                    if (catCode) {
                        catCodes.add(catCode);
                    }
                }
            }

            return catCodes;
        };

        // Remove duplicate categories from localValue
        // e.g., "Artificial Flowers|Artificial Flowers > Rose" -> "Artificial Flowers > Rose"
        const cleanLocalValue = (value: string): string => {
            const entries = value.split('|').map(s => s.trim()).filter(Boolean);
            const uniqueEntries: string[] = [];

            for (const entry of entries) {
                // Check if this entry is a substring of any other entry
                const isSubstring = entries.some(other =>
                    other !== entry && other.includes(entry) && other.includes('>')
                );

                if (!isSubstring) {
                    uniqueEntries.push(entry);
                }
            }

            return uniqueEntries.join('|');
        };

        const cleanedLocalValue = cleanLocalValue(localValue);

        // Extract CatCodes from both values
        const wpCatCodes = extractCatCodes(wpValue);
        const localCatCodes = extractCatCodes(cleanedLocalValue);

        // Compare the sets of CatCodes
        if (wpCatCodes.size !== localCatCodes.size) {
            return false;
        }

        // Check if all CatCodes match
        for (const code of wpCatCodes) {
            if (!localCatCodes.has(code)) {
                return false;
            }
        }

        return true;
    };

    // Normalize WordPress categories to match Supabase format
    const normalizeWpCategories = () => {
        if (!wpData?.categories || wpData.categories.length === 0) return '';
        if (wpData.categories.length === 1) {
            return wpData.categories[0].name;
        }
        // If multiple categories, treat second one as subcategory of first
        return `${wpData.categories[0].name} > ${wpData.categories[1].name}`;
    };

    const wpCategoriesNormalized = normalizeWpCategories();

    const images = parseImages(localItem.Images || '');
    // Use WordPress categories if available, otherwise use Supabase
    const categoryTree = parseCategoryTree(wpCategoriesNormalized || localItem.ProductCat || '');

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-7xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-dark-bg to-dark-surface border-b border-dark-border">
                    <div className="flex items-center justify-between gap-6">
                        {/* LEFT: Title and Description */}
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-bold text-white truncate">{item.Code} - WordPress Sync</h2>
                            <p className="text-sm text-gray-400 mt-1 truncate">{item.Description}</p>
                            {!loading && loadTime > 0 && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                    <Clock className="w-3 h-3" />
                                    <span>Loaded in {loadTime}ms</span>
                                </div>
                            )}
                        </div>

                        {/* CENTER: Sync Control Panel */}
                        <div className="flex items-center gap-3 bg-dark-bg/50 rounded-xl px-4 py-3 border border-dark-border flex-shrink-0">
                            {/* WordPress Icon */}
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-10 h-10 bg-blue-600/20 border-2 border-blue-500 rounded-full flex items-center justify-center">
                                    <Globe className="w-5 h-5 text-blue-400" />
                                </div>
                                <span className="text-[10px] font-bold text-blue-400">WP</span>
                            </div>

                            {/* Sync Controls */}
                            <div className="flex flex-col gap-1.5">
                                {/* SyncA: WP → Supabase */}
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={handleSyncAToSupabase}
                                        disabled={selectedFields.size === 0 || syncing}
                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-1.5 disabled:cursor-not-allowed"
                                        title="Sync selected fields from WordPress to Supabase"
                                    >
                                        {syncing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <ArrowRight className="w-2.5 h-2.5" />}
                                        Sync A
                                    </button>
                                    <ArrowRight className="w-4 h-4 text-gray-600" />
                                </div>

                                {/* SyncB: Supabase → WP */}
                                <div className="flex items-center gap-1.5">
                                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                                    <button
                                        onClick={handleSyncBToWordPress}
                                        disabled={selectedFields.size === 0 || syncing}
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-1.5 disabled:cursor-not-allowed"
                                        title="Sync selected fields from Supabase to WordPress"
                                    >
                                        {syncing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <ArrowLeft className="w-2.5 h-2.5" />}
                                        Sync B
                                    </button>
                                </div>
                            </div>

                            {/* Supabase Icon */}
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-10 h-10 bg-purple-600/20 border-2 border-purple-500 rounded-full flex items-center justify-center">
                                    <Database className="w-5 h-5 text-purple-400" />
                                </div>
                                <span className="text-[10px] font-bold text-purple-400">DB</span>
                            </div>

                            {/* Selection Counter */}
                            <div className="text-[10px] text-gray-400 ml-2 text-center">
                                <div className="font-bold text-white">{selectedFields.size}</div>
                                <div>selected</div>
                            </div>
                        </div>

                        {/* RIGHT: Close Button */}
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Price Fields Row */}
                <div className="px-6 py-4 bg-dark-bg/30 border-b border-dark-border">
                    <div className="flex items-center gap-6">
                        {/* Regular Price */}
                        <div className="flex items-center gap-3 flex-1">
                            <SyncIndicator
                                isMatch={compareField(wpData?.regular_price, localItem.ListPrice)}
                                isEmpty={isEmpty}
                                wpValue={wpData?.regular_price}
                                localValue={localItem.ListPrice}
                                label="Regular Price"
                                fieldKey="regularPrice"
                                isSelected={selectedFields.has('regularPrice')}
                                onToggleSelect={toggleFieldSelection}
                                alignLeft
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-bold">Price:</span>
                                <span className="text-lg font-bold text-white">${wpData?.regular_price || localItem.ListPrice || '-'}</span>
                            </div>
                        </div>

                        {/* Sale Price */}
                        <div className="flex items-center gap-3 flex-1">
                            <SyncIndicator
                                isMatch={compareField(
                                    (wpData?.sale_price && Number(wpData.sale_price) > 0) ? wpData.sale_price : '',
                                    (localItem.SalePrice && Number(localItem.SalePrice) > 0) ? localItem.SalePrice : ''
                                )}
                                isEmpty={isEmpty}
                                wpValue={(wpData?.sale_price && Number(wpData.sale_price) > 0) ? wpData.sale_price : 'No sale'}
                                localValue={(localItem.SalePrice && Number(localItem.SalePrice) > 0) ? localItem.SalePrice : 'No sale'}
                                label="Sale Price"
                                fieldKey="salePrice"
                                isSelected={selectedFields.has('salePrice')}
                                onToggleSelect={toggleFieldSelection}
                                alignLeft
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-bold">Sale Price:</span>
                                {(wpData?.sale_price && Number(wpData.sale_price) > 0) || (localItem.SalePrice && Number(localItem.SalePrice) > 0) ? (
                                    <span className="text-lg font-bold text-green-400">${wpData?.sale_price || localItem.SalePrice}</span>
                                ) : (
                                    <span className="text-sm text-gray-600 italic">No sale</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="w-8 h-8 animate-spin text-gemini-400" />
                        </div>
                    ) : (
                        <div className="space-y-6">

                            {/* Main Layout: 33% | 67% */}
                            <div className="flex gap-6">

                                {/* LEFT COLUMN - 33% */}
                                <div className="w-1/3 space-y-4">
                                    {/* Main Image */}
                                    <div className="relative">
                                        <SyncIndicator
                                            isMatch={compareField(wpData?.images?.[0]?.src, localItem.Image)}
                                            isEmpty={isEmpty}
                                            wpValue={wpData?.images?.[0]?.src}
                                            localValue={localItem.Image}
                                            label="Main Image URL"
                                            alignLeft
                                            fieldKey="mainImage"
                                            isSelected={selectedFields.has('mainImage')}
                                            onToggleSelect={toggleFieldSelection}
                                        />
                                        <div className="w-full aspect-square bg-black rounded-xl border border-dark-border overflow-hidden flex items-center justify-center mt-2">
                                            {wpData?.images?.[0]?.src || item.Image ? (
                                                <img
                                                    src={wpData?.images?.[0]?.src || localItem.Image}
                                                    alt="Product"
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <span className="text-gray-600 text-sm">No Image</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Post ID */}
                                    <div className="bg-dark-bg/50 rounded-lg px-3 py-2 border border-dark-border flex items-center gap-2">
                                        <SyncIndicator isMatch={true} isEmpty={isEmpty} alignLeft />
                                        <div className="text-xs text-gray-400">ID:</div>
                                        <div className="font-mono text-white text-sm">{item.PostID || '-'}</div>
                                    </div>

                                    {/* Post Status */}
                                    <div className="bg-dark-bg/50 rounded-lg px-3 py-2 border border-dark-border flex items-center gap-2">
                                        <SyncIndicator
                                            isMatch={compareField(wpData?.status, localItem.PostStatus)}
                                            isEmpty={isEmpty}
                                            wpValue={wpData?.status}
                                            localValue={localItem.PostStatus}
                                            label="Post Status"
                                            alignLeft
                                            fieldKey="postStatus"
                                            isSelected={selectedFields.has('postStatus')}
                                            onToggleSelect={toggleFieldSelection}
                                        />
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${wpData?.status === 'publish' ? 'bg-green-900/20 text-green-400' :
                                            wpData?.status === 'draft' ? 'bg-yellow-900/20 text-yellow-400' :
                                                'bg-gray-800 text-gray-500'
                                            }`}>
                                            {wpData?.status || '-'}
                                        </div>
                                    </div>

                                    {/* Stock Status */}
                                    <div className="bg-dark-bg/50 rounded-lg px-3 py-2 border border-dark-border flex items-center gap-2">
                                        <SyncIndicator
                                            isMatch={compareField(wpData?.stock_status, localItem.StockStatus)}
                                            isEmpty={isEmpty}
                                            wpValue={wpData?.stock_status}
                                            localValue={localItem.StockStatus}
                                            label="Stock Status"
                                            alignLeft
                                            fieldKey="stockStatus"
                                            isSelected={selectedFields.has('stockStatus')}
                                            onToggleSelect={toggleFieldSelection}
                                        />
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${wpData?.stock_status === 'instock' ? 'bg-green-900/20 text-green-400' : wpData?.stock_status ? 'bg-red-900/20 text-red-400' : 'bg-gray-800 text-gray-500'}`}>
                                            {wpData?.stock_status || '-'}
                                        </div>
                                    </div>

                                    {/* Category - SubCategory */}
                                    <div className="bg-dark-bg/50 rounded-lg px-3 py-2 border border-dark-border flex items-center gap-2">
                                        <SyncIndicator
                                            isMatch={compareCategoryField(
                                                wpCategoriesNormalized,
                                                `${localItem.nCategory} - ${localItem.nSubCategory}`
                                            )}
                                            isEmpty={isEmpty}
                                            wpValue={wpCategoriesNormalized}
                                            localValue={`${localItem.nCategory} - ${localItem.nSubCategory}`}
                                            label="Categories"
                                            alignLeft
                                            fieldKey="categories"
                                            isSelected={selectedFields.has('categories')}
                                            onToggleSelect={toggleFieldSelection}
                                        />
                                        <div className="text-white text-sm">{wpCategoriesNormalized || '-'}</div>
                                    </div>

                                    {/* Product Tag */}
                                    <div className="bg-dark-bg/50 rounded-lg px-3 py-2 border border-dark-border flex items-center gap-2">
                                        <SyncIndicator
                                            isMatch={compareField(wpData?.tags?.map((t: any) => t.name).join(', '), localItem.ProductTag)}
                                            isEmpty={isEmpty}
                                            wpValue={wpData?.tags?.map((t: any) => t.name).join(', ')}
                                            localValue={localItem.ProductTag}
                                            label="Product Tags"
                                            alignLeft
                                            fieldKey="productTag"
                                            isSelected={selectedFields.has('productTag')}
                                            onToggleSelect={toggleFieldSelection}
                                        />
                                        <div className="text-xs text-gray-400">Tag:</div>
                                        <div className="text-white text-sm flex-1 truncate">{wpData?.tags?.map(t => t.name).join(', ') || localItem.ProductTag || '-'}</div>
                                    </div>

                                    {/* Product Style */}
                                    <div className="bg-dark-bg/50 rounded-lg px-3 py-2 border border-dark-border flex items-center gap-2">
                                        <SyncIndicator
                                            isMatch={compareField(wpData?.product_style, localItem.ProductStyle)}
                                            isEmpty={isEmpty}
                                            wpValue={wpData?.product_style}
                                            localValue={localItem.ProductStyle}
                                            label="Product Style"
                                            alignLeft
                                            fieldKey="productStyle"
                                            isSelected={selectedFields.has('productStyle')}
                                            onToggleSelect={toggleFieldSelection}
                                        />
                                        <div className="text-xs text-gray-400">Style:</div>
                                        <div className="text-white text-sm flex-1 truncate">{wpData?.product_style || localItem.ProductStyle || '-'}</div>
                                    </div>

                                    {/* Product Page URL */}
                                    <div className="bg-dark-bg/50 rounded-lg p-3 border border-dark-border relative">
                                        <SyncIndicator
                                            isMatch={compareField(wpData?.permalink, localItem.ProductPage)}
                                            isEmpty={isEmpty}
                                            wpValue={wpData?.permalink}
                                            localValue={localItem.ProductPage}
                                            label="Product URL"
                                            alignLeft
                                            fieldKey="productURL"
                                            isSelected={selectedFields.has('productURL')}
                                            onToggleSelect={toggleFieldSelection}
                                        />
                                        <div className="text-xs text-gray-400 mb-1 mt-2">URL</div>
                                        {(wpData?.permalink || localItem.ProductPage) ? (
                                            <a
                                                href={wpData?.permalink || localItem.ProductPage}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 break-all"
                                            >
                                                {wpData?.permalink || localItem.ProductPage}
                                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                            </a>
                                        ) : (
                                            <div className="text-gray-500 text-xs">-</div>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT COLUMN - 67% */}
                                <div className="flex-1 space-y-4">

                                    {/* Row 1: Post Title, Short Desc, Slug | Focus KW, Meta Title, Meta Desc */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Left Side */}
                                        <div className="space-y-4">
                                            {/* Post Title */}
                                            <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                                <div className="absolute top-2 right-2">
                                                    <SyncIndicator
                                                        isMatch={compareField(wpData?.title, localItem.PostTitle)}
                                                        isEmpty={isEmpty}
                                                        wpValue={wpData?.title}
                                                        localValue={localItem.PostTitle}
                                                        label="Post Title"
                                                        fieldKey="postTitle"
                                                        isSelected={selectedFields.has('postTitle')}
                                                        onToggleSelect={toggleFieldSelection}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mb-2">Post Title</div>
                                                <div className="text-lg font-bold text-white leading-tight">{wpData?.title || localItem.PostTitle || '-'}</div>
                                            </div>

                                            {/* Short Description */}
                                            <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                                <div className="absolute top-2 right-2">
                                                    <SyncIndicator
                                                        isMatch={compareField(wpData?.short_description, localItem.PostShortDesc)}
                                                        isEmpty={isEmpty}
                                                        wpValue={wpData?.short_description}
                                                        localValue={localItem.PostShortDesc}
                                                        label="Short Description"
                                                        fieldKey="shortDescription"
                                                        isSelected={selectedFields.has('shortDescription')}
                                                        onToggleSelect={toggleFieldSelection}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mb-2">Short Description</div>
                                                <div className="text-sm text-gray-300 leading-relaxed">{wpData?.short_description || localItem.PostShortDesc || '-'}</div>
                                            </div>

                                            {/* Post Slug */}
                                            <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                                <div className="absolute top-2 right-2">
                                                    <SyncIndicator
                                                        isMatch={compareField(wpData?.slug, localItem.PostSlug)}
                                                        isEmpty={isEmpty}
                                                        wpValue={wpData?.slug}
                                                        localValue={localItem.PostSlug}
                                                        label="Post Slug"
                                                        fieldKey="postSlug"
                                                        isSelected={selectedFields.has('postSlug')}
                                                        onToggleSelect={toggleFieldSelection}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mb-2">Post Slug</div>
                                                <div className="text-sm text-white font-mono">{wpData?.slug || localItem.PostSlug || '-'}</div>
                                            </div>
                                        </div>

                                        {/* Right Side */}
                                        <div className="space-y-4">
                                            {/* Focus Keyword */}
                                            <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                                <div className="absolute top-2 right-2">
                                                    <SyncIndicator
                                                        isMatch={compareField(wpData?.yoast_focus_kw, localItem.FocusKW)}
                                                        isEmpty={isEmpty}
                                                        wpValue={wpData?.yoast_focus_kw}
                                                        localValue={localItem.FocusKW}
                                                        label="Focus Keyword (Yoast)"
                                                        fieldKey="focusKW"
                                                        isSelected={selectedFields.has('focusKW')}
                                                        onToggleSelect={toggleFieldSelection}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mb-2">Focus Keyword</div>
                                                <div className="text-sm text-white">{wpData?.yoast_focus_kw || localItem.FocusKW || '-'}</div>
                                            </div>

                                            {/* Meta Title */}
                                            <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                                <div className="absolute top-2 right-2">
                                                    <SyncIndicator
                                                        isMatch={compareField(wpData?.yoast_meta_title, localItem.MetaTitle)}
                                                        isEmpty={isEmpty}
                                                        wpValue={wpData?.yoast_meta_title}
                                                        localValue={localItem.MetaTitle}
                                                        label="Meta Title (Yoast)"
                                                        fieldKey="metaTitle"
                                                        isSelected={selectedFields.has('metaTitle')}
                                                        onToggleSelect={toggleFieldSelection}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mb-2">Meta Title</div>
                                                <div className="text-sm text-white">{wpData?.yoast_meta_title || localItem.MetaTitle || '-'}</div>
                                            </div>

                                            {/* Meta Description */}
                                            <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                                <div className="absolute top-2 right-2">
                                                    <SyncIndicator
                                                        isMatch={compareField(wpData?.yoast_meta_desc, localItem.MetaDesc)}
                                                        isEmpty={isEmpty}
                                                        wpValue={wpData?.yoast_meta_desc}
                                                        localValue={localItem.MetaDesc}
                                                        label="Meta Description (Yoast)"
                                                        fieldKey="metaDesc"
                                                        isSelected={selectedFields.has('metaDesc')}
                                                        onToggleSelect={toggleFieldSelection}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mb-2">Meta Description</div>
                                                <div className="text-xs text-gray-300 leading-relaxed">{wpData?.yoast_meta_desc || localItem.MetaDesc || '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Post Content - Full Width */}
                                    <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                        <div className="absolute top-2 right-2">
                                            <SyncIndicator
                                                isMatch={compareField(wpData?.description, localItem.PostContent)}
                                                isEmpty={isEmpty}
                                                wpValue={wpData?.description}
                                                localValue={localItem.PostContent}
                                                label="Post Content"
                                                fieldKey="postContent"
                                                isSelected={selectedFields.has('postContent')}
                                                onToggleSelect={toggleFieldSelection}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-400 mb-2">Post Content</div>
                                        <div
                                            className="text-sm text-gray-300 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar"
                                            dangerouslySetInnerHTML={{ __html: wpData?.description || localItem.PostContent || '-' }}
                                        />
                                    </div>

                                    {/* Bottom Row: Category Tree | Images */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Product Category Tree */}
                                        <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                            <div className="absolute top-2 right-2">
                                                <SyncIndicator
                                                    isMatch={compareCategoryField(
                                                        wpCategoriesNormalized || '',
                                                        localItem.ProductCat || ''
                                                    )}
                                                    isEmpty={isEmpty}
                                                    wpValue={wpCategoriesNormalized}
                                                    localValue={localItem.ProductCat}
                                                    label="Product Categories Tree"
                                                    fieldKey="productCategoryTree"
                                                    isSelected={selectedFields.has('productCategoryTree')}
                                                    onToggleSelect={toggleFieldSelection}
                                                />
                                            </div>
                                            <div className="text-xs text-gray-400 mb-3">Product Categories</div>
                                            <div className="text-sm text-gray-300 space-y-1">
                                                {categoryTree.length > 0 ? (
                                                    categoryTree.map((branch, idx) => (
                                                        <div key={idx}>
                                                            <div className="text-white">- {branch.parent}</div>
                                                            {branch.child && (
                                                                <div className="ml-6 text-gray-400">– {branch.child}</div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-gray-600">-</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Product Images */}
                                        <div className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border relative">
                                            <div className="absolute top-2 right-2">
                                                <SyncIndicator
                                                    isMatch={(wpData?.images?.length || 0) === images.length}
                                                    isEmpty={isEmpty}
                                                    wpValue={`${wpData?.images?.length || 0} images`}
                                                    localValue={`${images.length} images`}
                                                    label="Product Images"
                                                    fieldKey="productImages"
                                                    isSelected={selectedFields.has('productImages')}
                                                    onToggleSelect={toggleFieldSelection}
                                                />
                                            </div>
                                            <div className="text-xs text-gray-400 mb-3">Product Images ({wpData?.images?.length || 0})</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {wpData?.images && wpData.images.length > 0 ? (
                                                    wpData.images.map((img, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="aspect-square bg-black rounded border border-dark-border overflow-hidden group relative cursor-pointer"
                                                            onClick={() => img.alt && setShowAltForImage(showAltForImage === idx ? null : idx)}
                                                        >
                                                            <img
                                                                src={img.src}
                                                                alt={img.alt || `Image ${idx + 1}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            {img.alt && (
                                                                <>
                                                                    <div className="absolute top-1 right-1 bg-blue-600 rounded-full p-1">
                                                                        <Info className="w-3 h-3 text-white" />
                                                                    </div>
                                                                    {showAltForImage === idx && (
                                                                        <div
                                                                            className="absolute inset-0 bg-black/90 flex items-center justify-center p-2 z-10"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setShowAltForImage(null);
                                                                            }}
                                                                        >
                                                                            <span className="text-white text-[10px] text-center leading-tight">{img.alt}</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-3 text-center text-gray-600 text-sm py-4">No images</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>


            </div>
        </div>
    );
};
