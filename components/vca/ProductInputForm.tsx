import React, { useState, useEffect, useRef } from 'react';
import { ProductSpecs, ContainerSpecs, ModelIdentity, SceneConfig } from '../../types/vca';
import { WordPressConfig } from '../../types';
import { Trash2, Image as ImageIcon, ExternalLink, Save, FolderOpen, Search, Loader, ZoomIn, X, Check, XCircle, ChevronDown, ChevronUp, RefreshCw, ShieldCheck } from 'lucide-react'; // Using Lucide icons for UI
import { coreService } from '../../services/coreService';
import { scanProductImages } from '../../services/wpService';
import { getSetting } from '../../services/db';
import { idb, FileIndexEntry } from '../../utils/idb';
import Papa from 'papaparse';

// Helper: Verify permission
const verifyPermission = async (handle: any) => {
    if (!handle) return false;
    const options = { mode: 'read' };
    if ((await handle.queryPermission(options)) === 'granted') return true;
    if ((await handle.requestPermission(options)) === 'granted') return true;
    return false;
};

// Helper type for our local image manager
type ImageType = 'Product' | 'Detail' | 'Model' | 'Reference' | 'Container';
interface UploadedImage {
    id: string;
    file: File | null;
    url: string; // Blob URL or remote URL
    type: ImageType;
    displayName?: string; // e.g. "Code PNdesc"
}

interface ProductInputFormProps {
    onProductChange: (product: ProductSpecs) => void;
    onContainerChange: (container: ContainerSpecs) => void;
    onModelChange: (model: ModelIdentity) => void;
    onSceneChange: (scene: SceneConfig) => void;
    onConfirm: () => void;
    onSkipToScene?: () => void;  // NEW: Skip to Scene Selection
}

// Reuse or adapt SmartNumberInput for better UX (no leading zeros, high contrast)
const VcaNumberInput = ({ label, value, onChange, placeholder }: { label: string, value: number, onChange: (v: number) => void, placeholder?: string }) => {
    const [strVal, setStrVal] = useState(String(value || ''));

    useEffect(() => {
        // Sync with props if they change externally (and mostly for initial load)
        setStrVal(String(value || ''));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setStrVal(v);
        const num = parseFloat(v);
        if (!isNaN(num)) {
            onChange(num);
        } else if (v === '') {
            onChange(0);
        }
    };

    const handleBlur = () => {
        // Clean up formatting on blur
        const num = parseFloat(strVal);
        if (!isNaN(num) && num !== 0) {
            setStrVal(String(num));
        } else if (num === 0 || strVal === '') {
            setStrVal(''); // Keep empty if 0 for cleaner look in some cases, or '0'
            if (num === 0) setStrVal('0');
        }
    };

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
            <input
                type="number"
                value={strVal}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                className="w-full border-2 border-gray-300 rounded-lg p-3 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
            />
        </div>
    );
};

// Inner Component for Asset Browser Section to reduce duplication
// Inner Component for Asset Browser Section
const AssetBrowserSection = React.memo(({
    title,
    storageKey,
    onFileSelect,
    onPreview
}: {
    title: string,
    storageKey: string,
    onFileSelect: (file: File, meta?: any) => void,
    onPreview: (file: File, meta?: any) => void,
}) => {
    const [handle, setHandle] = useState<any>(null);
    const [items, setItems] = useState<{ id: string, file: File, meta: any, label: string }[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [pathLabel, setPathLabel] = useState('Not Selected');

    // Local Timeout Ref for Click Handling
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const load = async () => {
            const h = await idb.get(storageKey);
            if (h) {
                setHandle(h);
                setPathLabel(h.name);
            }
        };
        load();
    }, [storageKey]);

    const handleSetFolder = async () => {
        if (!('showDirectoryPicker' in window)) {
            alert('Your browser does not support Directory Picker.');
            return;
        }
        try {
            const h = await (window as any).showDirectoryPicker({ mode: 'read', startIn: 'desktop' });
            setHandle(h);
            setPathLabel(h.name);
            await idb.set(storageKey, h);
            setIsOpen(true);
            scanFiles(h);
        } catch (e) { console.warn('Cancelled', e); }
    };

    const scanFiles = async (dirHandle: any) => {
        if (!dirHandle) return;
        const perms = await verifyPermission(dirHandle);
        if (!perms) {
            alert('Permission denied.');
            return;
        }

        const fileMap = new Map<string, File>();
        const containerRows: any[] = [];
        const sceneRows: Map<string, string> = new Map();

        const scanDir = async (handle: any) => {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    if (entry.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
                        // If duplications occur (same filename in diff folders), last one wins.
                        fileMap.set(entry.name, await entry.getFile());
                    } else if (entry.name.toLowerCase() === 'clists.csv' && title.includes('Container')) {
                        const text = await (await entry.getFile()).text();
                        text.split(/\r?\n/).forEach((line: string) => {
                            const cols = line.split(',').map((s: string) => s.trim());
                            if (cols.length >= 6 && cols[0]) {
                                containerRows.push({
                                    name: cols[0],
                                    sizeLabel: cols[1], // Empty, Large, Small
                                    color: cols[2],
                                    diameter: cols[3],
                                    height: cols[4],
                                    filename: cols[5]
                                });
                            }
                        });
                    } else if (entry.name.toLowerCase().endsWith('.csv') && title.includes('Reference')) {
                        // Simple Reference CSV Logic
                        const text = await (await entry.getFile()).text();
                        text.split(/\r?\n/).forEach((line: string) => {
                            const cols = line.split(',').map((s: string) => s.trim());
                            if (cols.length >= 3 && cols[1]) {
                                sceneRows.set(cols[1], cols[2]); // Filename -> Desc
                            }
                        });
                    }
                } else if (entry.kind === 'directory') {
                    // Recursive Scan
                    await scanDir(entry);
                }
            }
        };

        await scanDir(dirHandle);

        const finalItems: { id: string, file: File, meta: any, label: string }[] = [];

        // 1. Container Logic: Drive by CSV
        if (title.includes('Container') && containerRows.length > 0) {
            containerRows.forEach(row => {
                const f = fileMap.get(row.filename);
                if (f) {
                    const meta = { ...row, library: 'Container' };
                    finalItems.push({
                        id: crypto.randomUUID(),
                        file: f,
                        meta: meta,
                        label: row.name
                    });
                }
            });
        }
        else {
            // 2. Default Logic (Models, Reference, or Containers without CSV)
            const libraryType = title.includes('Model') ? 'Model' : title.includes('Reference') ? 'Reference' : 'Other';
            fileMap.forEach((f, name) => {
                let meta: any = { library: libraryType };
                let label = f.name;

                if (title.includes('Reference') && sceneRows.has(name)) {
                    meta.description = sceneRows.get(name);
                }

                finalItems.push({
                    id: crypto.randomUUID(),
                    file: f,
                    meta: meta,
                    label: label
                });
            });
        }

        setItems(finalItems);
    };

    const handleToggle = () => {
        if (!isOpen && handle) scanFiles(handle);
        setIsOpen(!isOpen);
    };

    return (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="font-bold text-gray-700 text-sm">{title}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[200px]" title={pathLabel}>{pathLabel}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSetFolder} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold px-2 py-1 rounded">Set Folder</button>
                    <button onClick={handleToggle} disabled={!handle} className="p-1.5 bg-gray-300 text-gray-800 hover:bg-gray-400 rounded disabled:opacity-50 shadow-sm transition-colors">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="mt-3 grid grid-cols-10 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {items.map((item, i) => (
                        <div key={i} className="relative aspect-square bg-white border rounded cursor-pointer group hover:ring-2 hover:ring-blue-400"
                            title={item.label}
                            onClick={() => {
                                if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                                clickTimeoutRef.current = setTimeout(() => {
                                    onPreview(item.file, item.meta);
                                    clickTimeoutRef.current = null;
                                }, 250);
                            }}
                            onDoubleClick={() => {
                                if (clickTimeoutRef.current) {
                                    clearTimeout(clickTimeoutRef.current);
                                    clickTimeoutRef.current = null;
                                }
                                onFileSelect(item.file, item.meta);
                            }}
                        >
                            <img src={URL.createObjectURL(item.file)} className="w-full h-full object-cover" />
                            {/* Overlay for Container Meta */}
                            {title.includes('Container') && item.meta.height && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] gap-0.5 transition-opacity p-1 text-center">
                                    <span className="font-bold">{item.meta.sizeLabel || 'Std'}</span>
                                    <span>H: {item.meta.height}cm</span>
                                    <span>D: {item.meta.diameter}cm</span>
                                    <span className="text-gray-300 scale-75">{item.meta.color}</span>
                                </div>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && <div className="col-span-5 text-gray-400 text-xs text-center py-4">No items found</div>}
                </div>
            )}
        </div>
    );
}, (prev, next) => prev.title === next.title && prev.storageKey === next.storageKey);

export const ProductInputForm: React.FC<ProductInputFormProps> = ({
    onProductChange,
    onContainerChange,
    onModelChange,
    onSceneChange,
    onConfirm,
    onSkipToScene
}) => {
    // Defaults: Pot=16, Container=30, Model=175. Product height is mandatory.
    const [productHeight, setProductHeight] = useState<string>('');
    const [potHeight, setPotHeight] = useState<string>('16');
    const [containerHeight, setContainerHeight] = useState<string>('30');
    const [containerDiameter, setContainerDiameter] = useState<string>('30');
    const [modelHeight, setModelHeight] = useState<string>('175');
    const [toppingStyle, setToppingStyle] = useState<string>('White Pebbles');

    // New states for Model, Container, Scene
    const [modelName, setModelName] = useState('');
    const [containerName, setContainerName] = useState('');
    const [containerDimension, setContainerDimension] = useState(''); // 完整尺寸描述，如 "30×30×40cm"
    const [sceneDescription, setSceneDescription] = useState('');

    // Path Config State (for Smart Product Search)
    const [directoryHandle, setDirectoryHandle] = useState<any>(null); // FileSystemDirectoryHandle
    const [pathLabel, setPathLabel] = useState<string>('Not Selected');

    // Smart Search & Index State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false);
    const [indexCount, setIndexCount] = useState<number>(0);
    const [indexProgress, setIndexProgress] = useState<{ current: number, total: number } | null>(null);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [previewItem, setPreviewItem] = useState<{ file: File, meta: any } | null>(null);

    // Abort Controller for Search
    const abortSearchRef = useRef(false);

    // Timeout ref for handling click vs double-click separation
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Helper: Get Image Resolution
    const getImageRes = (file: File): Promise<{ w: number, h: number }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.width, h: img.height });
            img.onerror = () => resolve({ w: 0, h: 0 });
            img.src = URL.createObjectURL(file);
        });
    };

    // Init Logic: Restore handle for Smart Product Search
    useEffect(() => {
        const restoreHandle = async () => {
            const handle = await idb.get('vca_search_handle');
            if (handle) {
                setDirectoryHandle(handle);
                setPathLabel(handle.name + ' (Saved)');
                // Check if index exists
                const idx = await idb.getFullIndex();
                setIndexCount(idx.length);
            }
        };
        restoreHandle();
    }, []);

    // Change Folder Logic for Smart Product Search
    const handleSetDirectory = async () => {
        if (!('showDirectoryPicker' in window)) {
            alert('Your browser does not support Directory Picker (try Chrome/Edge).');
            return;
        }
        try {
            const handle = await (window as any).showDirectoryPicker({
                mode: 'read',
                startIn: 'desktop'
            });
            setDirectoryHandle(handle);
            setPathLabel(handle.name);
            setIndexCount(0); // Reset index count visually
            await idb.set('vca_search_handle', handle);
        } catch (e) {
            console.warn('Directory pick cancelled');
        }
    };

    // Verify Permission Explicitly
    const handleVerifyAccess = async () => {
        if (!directoryHandle) return;
        try {
            const perm = await directoryHandle.requestPermission({ mode: 'read' });
            if (perm === 'granted') {
                alert('Access Verified! You can now search and view images.');
            } else {
                alert('Access Denied. Please try again.');
            }
        } catch (e) {
            alert('Error verifying access: ' + e);
        }
    };

    // Build Index Logic (CSV Import Mode)
    const handleBuildIndex = async () => {
        // We warn the user that they still need to set the folder for viewing.
        if (!directoryHandle) {
            const proceed = confirm('You haven\'t set a Local Folder yet. You can still build the index from CSV, but you will need to set the folder later to view images. Proceed?');
            if (!proceed) return;
        }

        const csvUrl = prompt("Enter the Google Sheet CSV URL (Published link):", "");
        if (!csvUrl) return;

        setIsIndexing(true);
        setIndexProgress({ current: 0, total: 100 }); // Fake progress for UI feedback

        try {
            const resp = await fetch(csvUrl);
            if (!resp.ok) throw new Error('Failed to fetch CSV');
            const csvText = await resp.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const entries: FileIndexEntry[] = [];
                    // Expected Headers: Path, Name, Width, Height, Size, LastModified, ID

                    results.data.forEach((row: any) => {
                        if (!row.Path || !row.Name) return;

                        // Fix path separators to match local system if needed, though usually standard forward slash is best for IDB
                        // Google Drive paths are usually forward slash. Wrapper logic handles retrieval.

                        entries.push({
                            path: row.Path.trim(),
                            name: row.Name.trim(),
                            tokens: row.Name.trim().toLowerCase().replace(/[\.]/g, '-').split(/[\-_]/),
                            width: parseInt(row.Width) || 0,
                            height: parseInt(row.Height) || 0,
                            size: parseInt(row.Size) || 0,
                            lastModified: row.LastModified ? new Date(row.LastModified).getTime() : Date.now()
                        });
                    });

                    console.log(`Parsed ${entries.length} rows from CSV.`);

                    // Save to IDB
                    await idb.clearIndex();
                    await idb.saveIndexEntries(entries);
                    setIndexCount(entries.length);

                    setIsIndexing(false);
                    setIndexProgress(null);
                    alert(`Index Updated Successfully! ${entries.length} items imported from Cloud.`);
                },
                error: (err: any) => {
                    // Papa parse error
                    console.error(err);
                    alert('CSV Parse Error');
                    setIsIndexing(false);
                    setIndexProgress(null);
                }
            });

        } catch (e) {
            console.error('Indexing failed', e);
            alert('Indexing failed: ' + String(e));
            setIsIndexing(false);
            setIndexProgress(null);
        }
    };

    // Stop Search Logic
    const handleStopSearch = () => {
        if (isSearching) {
            abortSearchRef.current = true;
        }
    };

    // Smart Search Logic (Using WordPress API)
    const [searchCandidates, setSearchCandidates] = useState<{ sku: string, code: string, hl: string, strategy?: 'strict' | 'loose' }[]>([]);
    const [nextCandidateIndex, setNextCandidateIndex] = useState(0);
    const [isSearchingMore, setIsSearchingMore] = useState(false);

    const scanBatch = async (candidates: { sku: string, code: string, hl: string, strategy?: 'strict' | 'loose' }[], config: WordPressConfig) => {
        for (const item of candidates) {
            if (abortSearchRef.current) break;
            try {
                // Pass strategy (default strict) to WP Service
                const images = await scanProductImages(item.sku, config, item.strategy || 'strict');
                const batchResults: any[] = [];
                for (const img of images) {
                    const urlParts = img.url.split('/');
                    const origName = urlParts[urlParts.length - 1];
                    const filename = origName || `${item.sku}-${img.variant}-${img.sort_order}.jpg`;

                    try {
                        const resp = await fetch(img.url);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            const file = new File([blob], filename, { type: blob.type });
                            const f: any = file;
                            f.meta = { sku: item.sku, code: item.code, hl: item.hl };
                            f.width = img.width;
                            f.height = img.height;
                            batchResults.push(f);
                        } else { throw new Error('Fetch failed'); }
                    } catch (err) {
                        const file = new File([""], filename, { type: 'image/jpeg' });
                        const f: any = file;
                        f.meta = { sku: item.sku, code: item.code, hl: item.hl };
                        f.remoteUrl = img.url;
                        f.width = img.width;
                        f.height = img.height;
                        batchResults.push(f);
                    }
                }
                if (batchResults.length > 0) {
                    setSearchResults(prev => [...prev, ...batchResults]);
                }
            } catch (e) { console.warn(`Failed to scan ${item.sku}`, e); }
        }
    };

    const handleLoadMore = async () => {
        if (isSearchingMore || nextCandidateIndex >= searchCandidates.length) return;

        setIsSearchingMore(true);
        const BATCH_SIZE = 20;
        const nextBatch = searchCandidates.slice(nextCandidateIndex, nextCandidateIndex + BATCH_SIZE);
        setNextCandidateIndex(prev => prev + nextBatch.length);

        let wpConfig: WordPressConfig | null = null;
        try {
            const cached = localStorage.getItem('pos_wp_config');
            if (cached) wpConfig = JSON.parse(cached);
            else {
                const dbConfig = await getSetting('wp_config');
                if (dbConfig) wpConfig = dbConfig;
            }
        } catch (e) { }

        if (wpConfig && wpConfig.url) {
            await scanBatch(nextBatch, wpConfig);
        }
        setIsSearchingMore(false);
    };

    const handleResultsScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            handleLoadMore();
        }
    };

    const handleSmartSearch = async () => {
        if (!searchQuery.trim()) {
            alert('Please enter a search term.');
            return;
        }

        setIsSearching(true);
        setSearchResults([]);
        setSearchCandidates([]);
        setNextCandidateIndex(0);
        abortSearchRef.current = false;

        try {
            // 1. Get WP Config (Try LocalStorage first, then DB)
            let wpConfig: WordPressConfig | null = null;
            const cached = localStorage.getItem('pos_wp_config');

            if (cached) {
                try { wpConfig = JSON.parse(cached); } catch (e) { }
            }

            if (!wpConfig || !wpConfig.url) {
                try {
                    const dbConfig = await getSetting('wp_config');
                    if (dbConfig && dbConfig.url) {
                        wpConfig = dbConfig;
                    }
                } catch (e) { console.warn('Failed to fetch WP config from DB', e); }
            }

            if (!wpConfig || !wpConfig.url) {
                alert('WordPress Configuration missing. Please configure in Settings -> WordPress.');
                setIsSearching(false);
                return;
            }

            // 2. Resolve SKU & Details from Core DB
            let targets: { sku: string, code: string, hl: string, strategy?: 'strict' | 'loose' }[] = [];
            const q = searchQuery.trim();
            const isCodeLike = /^[A-Z0-9\-\.]+$/i.test(q) && /\d/.test(q);

            if (isCodeLike) {
                const meta = await coreService.getProductByCodeOrSku(q);
                if (meta) {
                    targets = [{ sku: meta.sku, code: meta.code, hl: meta.hl }];
                } else {
                    targets = [{ sku: q, code: q, hl: '', strategy: 'loose' }];
                }
            } else {
                let minH, maxH;
                if (productHeight) {
                    const h = parseFloat(String(productHeight));
                    if (!isNaN(h) && h > 0) {
                        minH = h * 0.9;
                        maxH = h * 1.1;
                    }
                }
                const items = await coreService.searchSkusByKeyword(q, minH, maxH);
                if (items.length > 0) {
                    targets = items.map(i => ({ sku: i.sku, code: i.code, hl: i.hl }));
                    // Append generic keyword to find images not strictly linked to found SKUs (Loose Mode)
                    targets.push({ sku: q, code: q, hl: '', strategy: 'loose' });
                } else {
                    targets = [{ sku: q, code: q, hl: '', strategy: 'loose' }];
                }
            }

            if (targets.length === 0) {
                targets = [{ sku: q, code: q, hl: '', strategy: 'loose' }];
            }

            console.log(`🎯 Smart Search matched ${targets.length} Items.`);
            setSearchCandidates(targets);

            const BATCH_SIZE = 20;
            const firstBatch = targets.slice(0, BATCH_SIZE);
            setNextCandidateIndex(BATCH_SIZE);

            await scanBatch(firstBatch, wpConfig);

        } catch (e) {
            console.error(e);
            alert('Search failed: ' + (e as any).message);
        } finally {
            setIsSearching(false);
        }
    };

    // Explicit browse button using saved handle
    const handleBrowseSavedDrive = async () => {
        if (!directoryHandle) {
            handleSetDirectory();
            return;
        }

        try {
            const hasPerm = await verifyPermission(directoryHandle);
            if (!hasPerm) {
                await handleVerifyAccess();
                return;
            }

            const fileHandles = await (window as any).showOpenFilePicker({
                multiple: true,
                types: [{ description: 'Images', accept: { 'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.webp'] } }],
                startIn: directoryHandle
            });

            for (const fh of fileHandles) {
                const file = await fh.getFile();
                handleSelectSearchResult(file);
            }
        } catch (e) {
            // Cancelled
        }
    };

    const handleSelectSearchResult = (file: File, type: ImageType = 'Product', meta?: any) => {
        // Auto-fill Product Height from Metadata if available
        const effectiveMeta = meta || {};

        if (type === 'Product' && effectiveMeta?.hl) {
            setProductHeight(String(effectiveMeta.hl));
        }

        const newId = crypto.randomUUID();

        const newImg: UploadedImage = {
            id: newId,
            file: file,
            url: (file as any).remoteUrl || URL.createObjectURL(file), // Using shared file is fine for URL
            type: type,
            // Initial optimistic display name
            displayName: (type === 'Product' && effectiveMeta.code) ? effectiveMeta.code : undefined
        };

        // Async fetch for details if Product
        if (type === 'Product') {
            const identifier = effectiveMeta.sku || effectiveMeta.code || (file.name.includes('.') ? file.name.split('.')[0] : file.name);
            // Don't fetch if just generic filename without SKU format? 
            // Assume if meta exists or filename looks like a code, we try.
            if (identifier) {
                // Determine if identifier is likely a SKU/Code (simple heuristic or just try)
                coreService.getProductByCodeOrSku(identifier).then(info => {
                    if (info && info.code) {
                        setImages(prev => prev.map(img =>
                            img.id === newId
                                ? { ...img, displayName: `${info.code} ${info.pndesc || ''}`.trim() }
                                : img
                        ));
                    }
                }).catch(err => console.warn('Failed to fetch details for image', err));
            }
        }

        if (type === 'Container') {
            setImages(prev => [...prev.filter(i => i.type !== 'Container'), newImg]);
        } else {
            setImages(prev => [...prev, newImg]);
        }
        setPreviewItem(null); // Close zoom
    };

    // Image State
    const [images, setImages] = useState<UploadedImage[]>([]);

    // Function to handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newImages: UploadedImage[] = Array.from(e.target.files).map(file => ({
                id: crypto.randomUUID(),
                file: file,
                url: URL.createObjectURL(file),
                type: 'Product' // Default type
            }));
            setImages(prev => [...prev, ...newImages]);
        }
    };

    const handleDeleteImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const handleTypeChange = (id: string, newType: ImageType) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, type: newType } : img));
    };

    // Parser for Name-Height.ext
    const parseNameHeight = (filename: string) => {
        // "Name-Height.ext"
        const base = filename.substring(0, filename.lastIndexOf('.'));
        const parts = base.split('-');
        if (parts.length >= 2) {
            const h = parts.pop(); // Last part is height
            const n = parts.join('-'); // Rest is name
            return { name: n, height: h || '' };
        }
        return { name: base, height: '' };
    };

    // Specific Parser for Container: Name-xyD-stH
    const parseContainerFilename = (filename: string) => {
        // Remove extension
        const base = filename.substring(0, filename.lastIndexOf('.'));
        const parts = base.split('-');
        if (parts.length >= 3) {
            const hPart = parts[parts.length - 1]; // "stH"
            const dPart = parts[parts.length - 2]; // "xyD"
            if (hPart.toUpperCase().endsWith('H') && dPart.toUpperCase().endsWith('D')) {
                const h = hPart.slice(0, -1);
                const d = dPart.slice(0, -1);
                const name = parts.slice(0, -2).join('-');
                return { name, height: h, diameter: d };
            }
        }
        return { name: base, height: '', diameter: '' };
    };

    const handleUpdate = () => {
        const productImgObj = images.find(img => img.type === 'Product');
        const mainImage = productImgObj?.url || '';
        const detailImages = images.filter(img => img.type === 'Detail').map(img => img.url);
        const modelImage = images.find(img => img.type === 'Model')?.url || '';
        const containerImage = images.find(img => img.type === 'Container')?.url || '';

        const mockProduct: ProductSpecs = {
            id: 'prod_' + Date.now(),
            name: (productImgObj && productImgObj.file) ? (productImgObj.displayName || productImgObj.file.name) : 'Sample Product',
            code: productImgObj?.displayName?.split(' ')[0], // Extract code from "CODE PNDESC"
            type: 'Plant',
            dimensions: {
                height_cm: Number(productHeight) || 0,
                pot_height_cm: Number(potHeight) || 0,
            },
            assets: {
                main_image: mainImage,
                detail_images: detailImages
            }
        };

        const mockContainer: ContainerSpecs = {
            id: 'cont_' + Date.now(),
            name: containerName || 'Sample Container',
            dimensions: {
                height_cm: Number(containerHeight) || 0,
                diameter_cm: Number(containerDiameter) || 0,
                dimension: containerDimension || String(containerDiameter || '30') // Dimension 数值，如 "30" 表示 30×30
            },
            styling: {
                topping: toppingStyle as any,
                color: 'White'
            },
            image_url: containerImage
        };

        const mockModel: ModelIdentity = {
            name: modelName || 'Default Model',
            face_reference_image: modelImage,
            height_cm: Number(modelHeight) || 0
        };

        const mockScene: SceneConfig = {
            id: 'scene_' + Date.now(),
            name: 'Custom Input',
            prompt_template: sceneDescription || '',
            is_custom: true
        };

        onProductChange(mockProduct);
        onContainerChange(mockContainer);
        onModelChange(mockModel);
        onSceneChange(mockScene);
        onConfirm();
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
            {/* Sticky Header */}
            <div className="flex-none bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 z-10 shadow-sm">
                <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">VCA Product Setup</h2>

                {/* Skip to Scene Button */}
                {onSkipToScene && (
                    <button
                        onClick={onSkipToScene}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                        title="Skip to Scene Selection (Step 3)"
                    >
                        <ChevronDown className="w-4 h-4" />
                        Skip to Scene
                    </button>
                )}

                {/* File Actions & Thumbnails Area */}
                <div className="flex items-center gap-3 flex-1 ml-4">
                    {/* Compact Buttons */}
                    <button
                        onClick={handleBrowseSavedDrive}
                        className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-bold flex items-center gap-2 border border-blue-200 transition whitespace-nowrap"
                        title="Browse Saved Folder"
                    >
                        <FolderOpen size={16} /> Saved Folder
                    </button>

                    <label className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-md font-bold flex items-center gap-2 border border-gray-200 cursor-pointer transition whitespace-nowrap">
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <ImageIcon size={16} /> Local Files
                    </label>

                    {/* Vertical Divider */}
                    <div className="w-px h-8 bg-gray-300 mx-2"></div>

                    {/* Thumbnail Slots (Max 5) */}
                    <div className="flex gap-2">
                        {[...Array(5)].map((_, i) => {
                            const img = images[i];
                            return (
                                <div key={i} className="w-10 h-10 border border-gray-200 rounded bg-gray-50 flex items-center justify-center overflow-hidden relative shadow-sm">
                                    {img ? (
                                        <div className="w-full h-full relative group">
                                            <img src={img.url} className="w-full h-full object-cover" title={img.file?.name} />
                                            <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                                                <span className="text-[8px] text-white font-mono">{img.type.substring(0, 1)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-300 text-[10px] select-none">{i + 1}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Overflow Badge */}
                    {images.length > 5 && (
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-xs font-bold text-gray-500 border border-gray-200">
                            +{images.length - 5}
                        </span>
                    )}
                </div>

                <button
                    onClick={handleUpdate}
                    className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition flex items-center gap-2 whitespace-nowrap"
                >
                    <Save className="w-5 h-5" /> Confirm & Generate
                </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-12 gap-6 h-full">

                    {/* LEFT COLUMN: Inputs & Added Images */}
                    <div className="col-span-5 space-y-6">

                        {/* 0. Added Images List (Moved to Top) */}
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            <div className="p-3 font-bold text-gray-600 border-b">Selected Images ({images.length})</div>
                            <div className="divide-y divide-gray-200">
                                {images.map((img) => (
                                    <div key={img.id} className="grid grid-cols-12 gap-2 p-2 items-center bg-white">
                                        <div className="col-span-2 h-12 w-12 bg-gray-200 rounded overflow-hidden">
                                            <img src={img.url} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="col-span-8 flex flex-col justify-center">
                                            <span className="text-xs truncate font-bold text-gray-800" title={img.displayName || img.file?.name}>{img.displayName || img.file?.name}</span>
                                            <div className="flex gap-1 mt-1">
                                                {['Product', 'Detail', 'Model', 'Reference', 'Container'].map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => handleTypeChange(img.id, type as ImageType)}
                                                        className={`px-2 py-0.5 rounded text-[10px] border font-bold ${img.type === type ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <button onClick={() => handleDeleteImage(img.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 1. Product Inputs */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">Product Specifications</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Height (cm)</label>
                                    <input
                                        type="number"
                                        value={productHeight}
                                        onChange={e => setProductHeight(e.target.value)}
                                        className="w-full border rounded p-2 text-sm text-gray-900 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pot Height (cm)</label>
                                    <input
                                        type="number"
                                        value={potHeight}
                                        onChange={e => setPotHeight(e.target.value)}
                                        className="w-full border rounded p-2 text-sm text-gray-900 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Topping Style</label>
                                    <select
                                        value={toppingStyle}
                                        onChange={e => setToppingStyle(e.target.value)}
                                        className="w-full border rounded p-2 text-sm text-gray-900 font-medium"
                                    >
                                        <option value="White Pebbles">White Pebbles</option>
                                        <option value="Black Pebbles">Black Pebbles</option>
                                        <option value="Mixed Pebbles">Mixed Pebbles</option>
                                        <option value="Artificial Moss">Artificial Moss</option>
                                        <option value="Coconut Fiber">Coconut Fiber</option>
                                        <option value="Bark">Bark</option>
                                        <option value="Soil">Soil</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 2. Model Specs - Updates Labels */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex justify-between">
                                <span>Human Model (Subject)</span>
                                <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Auto-fill from Search →</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Human Model Name / 模特昵称</label>
                                    <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} className="w-full border rounded p-2 text-sm text-gray-900 font-medium" placeholder="e.g. Kristina" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Human Model Height (cm)</label>
                                    <input type="number" value={modelHeight} onChange={e => setModelHeight(e.target.value)} className="w-full border rounded p-2 text-sm text-gray-900 font-medium" />
                                </div>
                            </div>
                        </div>

                        {/* 3. Container Specs - Updated Layout & Labels */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">Container Parameter</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                                    <input type="text" value={containerName} onChange={e => setContainerName(e.target.value)} className="w-full border rounded p-2 text-sm text-gray-900 font-medium" placeholder="e.g. WhitePot" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Height (cm)</label>
                                    <input type="number" value={containerHeight} onChange={e => setContainerHeight(e.target.value)} className="w-full border rounded p-2 text-sm text-gray-900 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diameter (cm)</label>
                                    <input type="number" value={containerDiameter} onChange={e => setContainerDiameter(e.target.value)} className="w-full border rounded p-2 text-sm text-gray-900 font-medium" />
                                </div>
                            </div>
                        </div>

                        {/* 4. Scene Specs */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">Scene Description</h3>
                            <textarea
                                value={sceneDescription}
                                onChange={e => setSceneDescription(e.target.value)}
                                rows={3}
                                className="w-full border rounded p-2 text-sm text-gray-900 font-medium"
                                placeholder="Scene description auto-filled from CSV..."
                            />
                        </div>



                    </div>

                    {/* RIGHT COLUMN: Search Modules */}
                    <div className="col-span-7 space-y-6">

                        {/* 1. Smart Product Search */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 space-y-4">
                            <h3 className="font-bold text-blue-900 flex items-center gap-2">
                                <Search className="w-5 h-5" />
                                Smart Product Search
                            </h3>

                            <div className="bg-blue-50 p-2 rounded flex justify-between items-center gap-2">
                                <div className="flex flex-col overflow-hidden w-full">
                                    <span className="text-xs text-blue-800 font-bold truncate" title={pathLabel}>{pathLabel}</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={handleSetDirectory} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 shadow-sm transition">
                                        Set Folder
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSmartSearch()} className="flex-1 border-2 border-blue-200 rounded-lg p-2 text-gray-900 font-medium" placeholder="Search Code, SKU, Keyword..." />
                                {isSearching ?
                                    <button onClick={handleStopSearch} className="px-4 bg-red-500 text-white rounded-lg font-bold"><XCircle className="w-5 h-5" /></button> :
                                    <button onClick={handleSmartSearch} className="px-4 bg-blue-600 text-white rounded-lg font-bold"><Search className="w-5 h-5" /></button>
                                }
                            </div>

                            {isSearching && (
                                <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold pl-1 animate-pulse">
                                    <Loader className="w-3 h-3 animate-spin" /> Searching directory...
                                </div>
                            )}

                            {searchResults.length > 0 && (
                                <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto custom-scrollbar" onScroll={handleResultsScroll}>
                                    {searchResults.map((file: any, i) => (
                                        <div key={i} className="relative aspect-square border rounded cursor-pointer group"
                                            onClick={() => {
                                                if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                                                clickTimeoutRef.current = setTimeout(() => {
                                                    setPreviewItem({ file: file, meta: file.meta });
                                                    clickTimeoutRef.current = null;
                                                }, 250);
                                            }}
                                            onDoubleClick={() => {
                                                if (clickTimeoutRef.current) {
                                                    clearTimeout(clickTimeoutRef.current);
                                                    clickTimeoutRef.current = null;
                                                }
                                                handleSelectSearchResult(file, 'Product', file.meta);
                                            }}
                                            title={file.name}>
                                            <img
                                                src={(file as any).remoteUrl || URL.createObjectURL(file)}
                                                className="w-full h-full object-cover"
                                                onLoad={(e) => {
                                                    const img = e.currentTarget;
                                                    const w = img.naturalWidth;
                                                    const h = img.naturalHeight;
                                                    if (w && h) {
                                                        const label = img.nextElementSibling?.querySelector('.res-label');
                                                        if (label) label.textContent = `${w}x${h}`;
                                                        (file as any).width = w;
                                                        (file as any).height = h;
                                                    }
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center flex-col text-[10px] text-white p-1 text-center transition-opacity duration-200 backdrop-blur-sm">
                                                <span className="font-bold text-yellow-300">{file.meta?.sku}</span>
                                                {file.meta?.code && <span className="text-gray-200">{file.meta.code}</span>}
                                                <span className="text-[9px] text-gray-300 res-label">
                                                    {(file as any).width ? `${(file as any).width}x${(file as any).height}` : ''}
                                                </span>
                                                {file.meta?.hl && <span className="text-green-300 mt-1">{file.meta.hl} cm</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {isSearchingMore && (
                                        <div className="col-span-5 flex justify-center py-2">
                                            <Loader className="w-4 h-4 animate-spin text-blue-600" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <hr className="border-gray-200" />

                        {/* 2. Asset Browsers */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-600 uppercase text-xs tracking-wider">Asset Source Libraries</h3>

                            <AssetBrowserSection
                                title="Human Model Library"
                                storageKey="vca_model_path"
                                onPreview={(f, meta) => setPreviewItem({ file: f, meta: meta })}
                                onFileSelect={(file, meta) => {
                                    const { name, height } = parseNameHeight(file.name);
                                    setModelName(name);
                                    if (height) setModelHeight(height);
                                    handleSelectSearchResult(file, 'Model', meta);
                                }}
                            />

                            <AssetBrowserSection
                                title="Container Library"
                                storageKey="vca_container_path"
                                onPreview={(f, meta) => setPreviewItem({ file: f, meta: meta })}
                                onFileSelect={(file, meta) => {
                                    // Prefer meta from CSV if available
                                    if (meta && meta.name) {
                                        setContainerName(meta.name);
                                        setContainerHeight(meta.height);
                                        setContainerDiameter(meta.diameter);
                                        // Dimension 只存储直径数值（如 30 表示 30×30）
                                        setContainerDimension(String(meta.diameter || meta.dimension || ''));
                                    } else {
                                        const { name, height, diameter } = parseContainerFilename(file.name);
                                        if (name) setContainerName(name);
                                        if (height) setContainerHeight(height);
                                        if (diameter) {
                                            setContainerDiameter(diameter);
                                            setContainerDimension(String(diameter));
                                        }
                                    }
                                    handleSelectSearchResult(file, 'Container', meta);
                                }}
                            />

                            <AssetBrowserSection
                                title="Reference Library"
                                storageKey="vca_reference_path"
                                onPreview={(f, meta) => setPreviewItem({ file: f, meta: meta })}
                                onFileSelect={(file, meta) => {
                                    handleSelectSearchResult(file, 'Reference', meta);
                                }}
                            />
                        </div>

                        {/* File Inputs Moved to Header */}

                    </div>
                </div>
            </div>

            {/* Modals & Portals */}
            {previewItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" onClick={() => setPreviewItem(null)}>
                    <div className="relative bg-white rounded-xl overflow-hidden max-w-4xl w-full max-h-full flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-3 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                {(function () {
                                    const meta = previewItem.meta || {};
                                    // 1. Container
                                    if (meta.library === 'Container' || (meta.diameter && meta.height)) {
                                        return (
                                            <>
                                                <span className="font-bold text-gray-700 truncate block">{meta.name || previewItem.file.name}</span>
                                                <span className="text-xs text-green-600 font-bold block mb-1">
                                                    {meta.sizeLabel ? `${meta.sizeLabel} | ` : ''}
                                                    D: {meta.diameter}cm x H: {meta.height}cm
                                                </span>
                                            </>
                                        );
                                    }
                                    // 2. Product Search
                                    if (meta.sku || meta.code) {
                                        return (
                                            <>
                                                <span className="font-bold text-gray-700 truncate block">{meta.code} / {meta.sku}</span>
                                                <span className="text-xs text-blue-600 font-bold block mb-1">HL: {meta.hl} cm</span>
                                            </>
                                        );
                                    }
                                    // 3. Reference (Strictly Name Only)
                                    if (meta.library === 'Reference') {
                                        return <span className="font-bold text-gray-700 truncate block">{previewItem.file.name}</span>;
                                    }

                                    // 4. Model / Fallback (Parse Name-Height)
                                    const name = previewItem.file.name;
                                    const base = name.substring(0, name.lastIndexOf('.'));
                                    const parts = base.split('-');
                                    const potentialH = parts[parts.length - 1];

                                    if (parts.length >= 2 && !isNaN(Number(potentialH))) {
                                        return (
                                            <>
                                                <span className="font-bold text-gray-700 truncate block">{parts.slice(0, -1).join('-')}</span>
                                                <span className="text-xs text-purple-600 font-bold block mb-1">Height: {potentialH} cm</span>
                                            </>
                                        );
                                    }
                                    return <span className="font-bold text-gray-700 truncate block">{previewItem.file.name}</span>;
                                })()}
                                <span className="text-xs text-gray-400 font-mono">
                                    {(previewItem.file.size / 1024).toFixed(1)} KB
                                </span>
                            </div>
                            <button onClick={() => setPreviewItem(null)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 bg-gray-100 flex items-center justify-center p-4 overflow-hidden relative">
                            <img
                                src={(previewItem.file as any).remoteUrl || ((previewItem.file && (previewItem.file as any) instanceof Blob) ? URL.createObjectURL(previewItem.file) : '')}
                                className="max-w-full max-h-[70vh] object-contain shadow-lg cursor-pointer"
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    const resLabel = document.getElementById('preview-res-label');
                                    if (resLabel) resLabel.innerText = `${img.naturalWidth} x ${img.naturalHeight} px`;
                                }}
                                onDoubleClick={() => {
                                    const type: ImageType = previewItem.meta?.library === 'Container' ? 'Container' :
                                        previewItem.meta?.library === 'Reference' ? 'Reference' :
                                            previewItem.meta?.library === 'Model' ? 'Model' : 'Product';

                                    // Parse Metadata for Container
                                    if (type === 'Container') {
                                        if (previewItem.meta && previewItem.meta.name) {
                                            setContainerName(previewItem.meta.name);
                                            setContainerHeight(previewItem.meta.height);
                                            setContainerDiameter(previewItem.meta.diameter);
                                            setContainerDimension(String(previewItem.meta.diameter || ''));
                                        } else {
                                            const { name, height, diameter } = parseContainerFilename(previewItem.file.name);
                                            if (name) setContainerName(name);
                                            if (height) setContainerHeight(height);
                                            if (diameter) {
                                                setContainerDiameter(diameter);
                                                setContainerDimension(String(diameter));
                                            }
                                        }
                                    } else if (type === 'Model') {
                                        const { name, height } = parseNameHeight(previewItem.file.name);
                                        setModelName(name);
                                        if (height) setModelHeight(height);
                                    }

                                    handleSelectSearchResult(previewItem.file, type, previewItem.meta);
                                    setPreviewItem(null);
                                }}
                                title="Double-click to select"
                            />
                            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-mono backdrop-blur-md" id="preview-res-label">
                                Loading...
                            </div>
                        </div>
                        <div className="p-4 border-t bg-white flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewItem(null)}
                                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const type: ImageType = previewItem.meta?.library === 'Container' ? 'Container' :
                                        previewItem.meta?.library === 'Reference' ? 'Reference' :
                                            previewItem.meta?.library === 'Model' ? 'Model' : 'Product';

                                    // Parse Metadata for Container (Same as DoubleClick)
                                    if (type === 'Container') {
                                        if (previewItem.meta && previewItem.meta.name) {
                                            setContainerName(previewItem.meta.name);
                                            setContainerHeight(previewItem.meta.height);
                                            setContainerDiameter(previewItem.meta.diameter);
                                            setContainerDimension(String(previewItem.meta.diameter || ''));
                                        } else {
                                            const { name, height, diameter } = parseContainerFilename(previewItem.file.name);
                                            if (name) setContainerName(name);
                                            if (height) setContainerHeight(height);
                                            if (diameter) {
                                                setContainerDiameter(diameter);
                                                setContainerDimension(String(diameter));
                                            }
                                        }
                                    } else if (type === 'Model') {
                                        const { name, height } = parseNameHeight(previewItem.file.name);
                                        setModelName(name);
                                        if (height) setModelHeight(height);
                                    }

                                    handleSelectSearchResult(previewItem.file, type, previewItem.meta);
                                    setPreviewItem(null);
                                }}
                                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow"
                            >
                                <Check className="w-4 h-4" /> Select Image
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
