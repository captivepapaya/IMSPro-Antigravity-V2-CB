
// ... (imports remain the same)
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Sidebar, SIDEBAR_CONFIG } from './components/Sidebar';
import { AppView, CsvFile, WordPressConfig, OrderHeader, OrderState, AppMode, PrinterConfig, OrderItem, CartItem, InventoryItem, LoginConfig } from './types';
import * as db from './services/db';
import { synonymService } from './services/synonymService';
import { generalConfigService } from './services/generalConfigService';
import { fetchWpImage, scanProductImages, searchMediaLibrary } from './services/wpService';
import { getSupabase } from './services/supabaseClient';
import { processRawData } from './services/dataProcessor';
import { GENERAL_PRODUCT_NAMES, GENERAL_PRODUCT_MAPPING, setGeneralProductIconCache } from './utils/assetLoader';
import { testReceiptPrint, testLabelPrint, testWaybillPrint, requestPrinterScan, encodeCode128B } from './services/printService';
import Papa from 'papaparse';
import { FolderOpen, AlertTriangle, Cloud, Check, RefreshCcw, Database, Settings, Save, Camera, FlaskConical, Activity, FileText, Globe, Trash2, Plus, Lock, Unlock, Image, PlayCircle, StopCircle, Printer, Search, Edit3, List, Eye, X, Shield, Menu, Power, Factory, Truck, Import, Star, Upload, Download, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { AdminAuthModal } from './components/AdminAuthModal';
import { coreService } from './services/coreService';
import { geminiService } from './services/geminiService';
import { getMelbourneIdPrefix, getMelbourneISODate } from './services/dateService';
import { ToastProvider, useToast } from './hooks/useToast';
import { idb } from './utils/idb';
import { Sparkles as SparklesIcon } from 'lucide-react'; // Rename to avoid conflict if Sparkles used elsewhere or just use existing.
// Wait, Sparkles is NOT imported in Line 15.
// Line 15 has 'Star'.
// I will just add Sparkles to Line 15 or use Star.
// Let's add Sparkles to import list.

// ... (Lazy components)
const CsvUploader = React.lazy(() => import('./components/CsvUploader').then(module => ({ default: module.CsvUploader })));
const InventorySearch = React.lazy(() => import('./components/InventorySearch').then(module => ({ default: module.InventorySearch })));
const ProductScanner = React.lazy(() => import('./components/ProductScanner').then(module => ({ default: module.ProductScanner })));

const OrdersManager = React.lazy(() => import('./components/OrdersManager').then(module => ({ default: module.OrdersManager })));


const BarcodeManager = React.lazy(() => import('./components/BarcodeManager').then(module => ({ default: module.BarcodeManager })));

const AddProduct = React.lazy(() => import('./components/AddProduct').then(module => ({ default: module.AddProduct })));
const AddProductQueue = React.lazy(() => import('./components/AddProductQueue').then(module => ({ default: module.AddProductQueue })));
const ManufactureHub = React.lazy(() => import('./components/ManufactureHub').then(module => ({ default: module.ManufactureHub })));




interface RemoteResource { id: string; url: string; alias: string; }

// ... (Constants & Helper Components remain the same)
const DEFAULT_WP_CONFIG: WordPressConfig = {
    url: 'https://lifelikeplants.au/',
    username: 'mitcham@lifelikeplants.com.au',
    appPassword: '0eM2 H4vl zFTz 0mWj rfVc 9uli'
};

const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
    receiptPrinter: '',
    labelPrinter: '',
    waybillPrinter: ''
};

const SYNONYMS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhMTGKmRNDYmSEMZZ5Do6Wye_2385CzCWV4G5KU3oMkL_cnm5M1plUdshwf5BAENALFrfiW8gQs1V/pub?gid=1835417495&single=true&output=csv';
const GENERAL_CONFIG_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3NaYNHTQcbfWB-vlIDYO60xpgXu4S8dLj_wI2sZ9JC9NDI0kLNECVjRvlh3zfacEwLCKlP3ZL6ARF/pub?gid=2051833809&single=true&output=csv';

const DEFAULT_LOGIN_CONFIG: LoginConfig = {
    isEnabled: true,
    password: 'imsgimini'
};


const LoadingFallback = () => (
    <div className="flex items-center justify-center h-full text-gray-500 gap-2">
        <RefreshCcw className="w-6 h-6 animate-spin" />
        <span>Loading Module...</span>
    </div>
);

// ... (PrinterSelector, BarcodeVisual, LabelPreviewModal remain same)
const PrinterSelector = ({
    label,
    value,
    onChange,
    options,
    onTest,
    onDemo
}: {
    label: string,
    value: string,
    onChange: (val: string) => void,
    options: string[],
    onTest: () => void,
    onDemo?: () => void
}) => {
    const [isManual, setIsManual] = useState(options.length === 0);
    useEffect(() => {
        if (options.length > 0 && !value) setIsManual(false);
    }, [options.length]);

    return (
        <div className="flex items-center gap-4">
            <div className="flex-1">
                <div className="flex justify-between mb-1 items-center">
                    <label className="block text-xs text-gray-500 font-bold">{label}</label>
                    <button
                        onClick={() => setIsManual(!isManual)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                        title={isManual ? "Switch to List" : "Switch to Manual Input"}
                    >
                        {isManual ? <><List className="w-3 h-3" /> Select List</> : <><Edit3 className="w-3 h-3" /> Manual Input</>}
                    </button>
                </div>

                {!isManual && options.length > 0 ? (
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-gemini-500 outline-none"
                    >
                        <option value="">-- Select Printer --</option>
                        {options.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                ) : (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="e.g. HPRT D35, Printer, or leave empty"
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-gemini-500 outline-none placeholder-gray-600"
                    />
                )}
            </div>
            <div className="flex flex-col gap-1 mt-5">
                <button onClick={onTest} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold text-gray-300 transition-colors w-16">Test</button>
                {onDemo && (
                    <button onClick={onDemo} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-xs font-bold text-white transition-colors w-16 flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3" /> Demo
                    </button>
                )}
            </div>
        </div>
    );
};

// --- Barcode Visual Generator (UNCHANGED) ---
const BarcodeVisual = ({ value }: { value: string }) => {
    const bars = React.useMemo(() => {
        // Use the shared service encoder
        return encodeCode128B(value);
    }, [value]);

    return (
        <div className="h-full w-full flex justify-center items-stretch px-[10px]">
            {bars.map((bar, i) => (
                <div key={i} style={{ backgroundColor: bar.type === 'bar' ? 'black' : 'transparent', flexGrow: bar.width }} />
            ))}
        </div>
    );
};

// --- LabelPreviewModal (UNCHANGED) ---
const LabelPreviewModal = ({ onClose }: { onClose: () => void }) => {
    // 40x30mm Layout @ 10x Scale = 400x300px
    const data = {
        PNDesc: "Wandering Jew Bush",
        HL: "50",
        Code: "30.536.12",
        Color: "Variegated",
        Price: "25.00",
        SKU: "A78330536"
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-8 shadow-2xl relative flex flex-col items-center max-w-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>

                <h3 className="text-white font-bold mb-2 text-xl">40x30mm Label Preview</h3>
                <p className="text-gray-400 text-sm mb-6">Real Code 128 (Set B) Render. 1mm ≈ 10px.</p>

                {/* The Label Container - 400px x 300px (10x scale) */}
                <div className="w-[400px] h-[300px] bg-white relative flex flex-col text-black font-sans overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">

                    {/* Row 1: PNDesc ONLY (Full Width) - Top - CENTERED & 2mm Padding */}
                    <div className="h-[50px] flex items-center justify-center px-[20px] w-full border-b border-gray-100">
                        <span className="text-[32px] font-normal leading-none truncate w-full text-center">{data.PNDesc}</span>
                    </div>

                    {/* Row 2: Code/Color | Price - 2mm Padding Side */}
                    <div className="h-[90px] flex px-[20px]">
                        {/* Left: Code & Color */}
                        <div className="w-1/2 flex flex-col justify-center overflow-hidden">
                            <div className="text-[34px] font-normal leading-none mb-1 truncate origin-left" title={data.SKU} style={{ transform: 'scale(0.85)' }}>
                                {data.SKU}
                            </div>
                            <div className="text-[30px] font-normal leading-none text-gray-600 truncate" title={data.Color}>{data.Color}</div>
                        </div>

                        {/* Right: Price */}
                        <div className="w-1/2 flex items-center justify-end">
                            <span className="text-[35px] font-bold mt-2 mr-1">$</span>
                            <span className="text-[60px] font-bold leading-none tracking-tighter">{data.Price}</span>
                        </div>
                    </div>

                    {/* Row 3: Barcode Visual (REAL CODE 128) - 20px Padding (2mm each side) */}
                    <div className="flex-1 flex flex-col items-center justify-start pt-2 pb-1">
                        <div className="h-[100px] w-full px-[20px]">
                            <BarcodeVisual value={data.SKU} />
                        </div>
                    </div>

                    {/* Row 4: Code (Left) and HL (Right) - Bottom Alignment - 25px Left / 25px Right */}
                    <div className="h-[40px] flex justify-between items-end pl-[25px] pr-[25px] pb-[10px] mt-auto">
                        <div className="text-[28px] font-normal tracking-widest leading-none">{data.Code}</div>
                        <div className="text-[28px] font-normal leading-none">{data.HL}</div>
                    </div>

                    {/* Dimensions Markers (Overlay - Guides only) */}
                    <div className="absolute top-0 -right-8 h-full flex flex-col justify-between text-[10px] text-gray-500 py-1 font-mono pointer-events-none">
                        <span>0</span><span>30mm</span>
                    </div>
                    <div className="absolute -bottom-6 left-0 w-full flex justify-between text-[10px] text-gray-500 px-1 font-mono pointer-events-none">
                        <span>0</span><span>40mm</span>
                    </div>
                </div>

                <div className="mt-8 flex gap-4">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">Close</button>
                </div>
            </div>
        </div>
    );
};

// ... (App Component)
const App: React.FC = () => {
    const { success, error, info } = useToast();
    // ... (State hooks same as before)
    const [currentView, setCurrentView] = useState<AppView>(AppView.DATA_SOURCES);
    const [files, setFiles] = useState<CsvFile[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const [appMode, setAppMode] = useState<AppMode>(() => {
        const cached = localStorage.getItem('pos_app_mode');
        return (cached === 'Normal' || cached === 'Test') ? cached : 'Normal';
    });

    const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
        const cached = localStorage.getItem('pos_printer_config');
        return cached ? JSON.parse(cached) : DEFAULT_PRINTER_CONFIG;
    });

    const [enableLocalPrint, setEnableLocalPrint] = useState<boolean>(() => {
        const cached = localStorage.getItem('pos_enable_local_print');
        return cached !== 'false';
    });

    const [wpConfig, setWpConfig] = useState<WordPressConfig>(() => {
        const cached = localStorage.getItem('pos_wp_config');
        return cached ? JSON.parse(cached) : DEFAULT_WP_CONFIG;
    });

    const [brandLogo, setBrandLogo] = useState<string>('');
    const [logoSearchTerm, setLogoSearchTerm] = useState('');
    const [logoSearchResults, setLogoSearchResults] = useState<{ id: number, url: string, title: string }[]>([]);
    const [isSearchingLogo, setIsSearchingLogo] = useState(false);
    const [isBrandLogoSaved, setIsBrandLogoSaved] = useState(false);

    const [fileSlots, setFileSlots] = useState<db.FileSlot[]>([]);
    const [remoteResources, setRemoteResources] = useState<RemoteResource[]>([]);
    const [newResUrl, setNewResUrl] = useState('');
    const [newResAlias, setNewResAlias] = useState('');
    const [isRemoteLoading, setIsRemoteLoading] = useState(false);
    const [coreConfig, setCoreConfig] = useState<db.CoreConfig | null>(null);
    const [newCoreUrl, setNewCoreUrl] = useState('');

    const [generalConfig, setGeneralConfig] = useState<db.CoreConfig | null>(null);
    const [newGeneralUrl, setNewGeneralUrl] = useState('');

    const [subCatConfig, setSubCatConfig] = useState<db.CoreConfig | null>(null);
    const [newSubCatUrl, setNewSubCatUrl] = useState('');

    const handleUpdateGeneralLink = async () => { if (!newGeneralUrl) return; const config: db.CoreConfig = { url: newGeneralUrl, updatedAt: new Date().toISOString(), name: 'GENERAL' }; await db.saveGeneralConfig(config); setGeneralConfig(config); await generalConfigService.loadConfig(newGeneralUrl); setNewGeneralUrl(''); alert("General Config Updated."); };
    const handleUpdateSubCatLink = async () => { if (!newSubCatUrl) return; const config: db.CoreConfig = { url: newSubCatUrl, updatedAt: new Date().toISOString(), name: 'SUBCAT' }; await db.saveSubCatConfig(config); setSubCatConfig(config); await synonymService.loadCatCodeRules(newSubCatUrl); setNewSubCatUrl(''); alert("Sub Category Rules Updated."); };

    const [googleScriptUrl, setGoogleScriptUrl] = useState('');
    const [isGasSaved, setIsGasSaved] = useState(false);

    // --- NEW: Core Sync ---
    const [isUploadAuthOpen, setIsUploadAuthOpen] = useState(false);
    const [isUploadingCore, setIsUploadingCore] = useState(false);

    const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [isCameraLocked, setIsCameraLocked] = useState(false);
    const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
    const cameraPreviewRef = useRef<HTMLVideoElement>(null);

    const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
    const [isPrinterChecking, setIsPrinterChecking] = useState(false);
    const [isSavingPrinter, setIsSavingPrinter] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [dbStatus, setDbStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [orderStats, setOrderStats] = useState<{ count: number, first: string, last: string } | null>(null);

    const [syncStartDate, setSyncStartDate] = useState(getMelbourneISODate());
    const [syncEndDate, setSyncEndDate] = useState(getMelbourneISODate());

    const [syncOrders, setSyncOrders] = useState<OrderHeader[]>([]);

    // AI Key State
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [googleProjectId, setGoogleProjectId] = useState('');

    useEffect(() => {
        idb.get('google_api_key').then(key => {
            if (key) {
                setGoogleApiKey(key);
                console.log("🔑 API Key Loaded from IDB");
            }
        });
        idb.get('google_project_id').then(pid => {
            if (pid) setGoogleProjectId(pid);
        });
    }, []);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, currentOrder: '' });
    const fallbackFileInputRef = useRef<HTMLInputElement>(null);
    const [activeSlot, setActiveSlot] = useState<number | null>(null);
    const [isGeneralReady, setIsGeneralReady] = useState(false);

    const [isIndexing, setIsIndexing] = useState(false);
    const [indexProgress, setIndexProgress] = useState({ current: 0, total: 0, matches: 0 });
    const [indexLogs, setIndexLogs] = useState<string[]>([]);
    const stopIndexRef = useRef(false);

    const [barcodeQueue, setBarcodeQueue] = useState<InventoryItem[]>([]);
    const [wpQueue, setWpQueue] = useState<InventoryItem[]>([]);
    const [showLabelDemo, setShowLabelDemo] = useState(false);

    const [visibleViews, setVisibleViews] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('app_menu_visibility');
        return saved ? JSON.parse(saved) : {};
    });
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

    const [currentOrder, setCurrentOrder] = useState<OrderState>({
        uuid: crypto.randomUUID(),
        orderId: 'INIT',
        items: [],
        sysPercent: 0,
        sysAmount: 0,
        finalPriceOverride: null,
        customerId: 'DEFAULT',
        paymentMethod: 'Card'
    });

    // --- NEW: VCA Integration ---
    const [vcaInitialProduct, setVcaInitialProduct] = useState<InventoryItem | null>(null);

    const handleOpenVCA = (product: InventoryItem) => {
        setVcaInitialProduct(product);
        setCurrentView(AppView.VCA_AGENT);
        success(`Opened VCA for ${product.Code}`);
    };

    // --- NEW: Login Control ---
    const [loginConfig, setLoginConfig] = useState<LoginConfig>(() => {
        const cached = localStorage.getItem('pos_login_config');
        return cached ? JSON.parse(cached) : DEFAULT_LOGIN_CONFIG;
    });
    const [isAppLocked, setIsAppLocked] = useState(loginConfig.isEnabled);
    const [startupPasswordInput, setStartupPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isVerifyingLockAction, setIsVerifyingLockAction] = useState<'enable' | 'disable' | 'change' | null>(null);
    const [verificationPassword, setVerificationPassword] = useState('');


    // Function to refresh camera list
    const refreshCameraDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setCameraDevices(videoDevices);
            return videoDevices;
        } catch (e) {
            console.warn("Camera enumeration failed", e);
            return [];
        }
    };

    useEffect(() => {
        // ... (Init logic same as before)
        const initApp = async () => {
            try {
                try { await synonymService.loadSynonyms(SYNONYMS_SHEET_URL); } catch (e) { }

                const savedGeneral = await db.getGeneralConfig();
                const genUrl = savedGeneral ? savedGeneral.url : GENERAL_CONFIG_URL;
                if (savedGeneral) setGeneralConfig(savedGeneral);
                await generalConfigService.loadConfig(genUrl);

                const savedSubCat = await db.getSubCatConfig();
                if (savedSubCat) setSubCatConfig(savedSubCat);
                if (savedSubCat) {
                    try { await synonymService.loadCatCodeRules(savedSubCat.url); } catch (e) { console.error("CatCode Custom Load Failed", e); }
                } else {
                    try { await synonymService.loadCatCodeRules(); } catch (e) { console.error("CatCode Default Load Failed", e); }
                }

                setIsGeneralReady(true);

                // ... (rest of init logic remains the same)
                let resources: RemoteResource[] = (await db.getSetting('remote_resources')) || [];

                // --- NEW: Try Supabase First ---
                let loadedFromSupabase = false;
                try {
                    console.log('📥 Fetching data from Supabase...');
                    const sbItems = await coreService.fetchCoreFromSupabase((loaded, total) => {
                        const percent = Math.round((loaded / total) * 100);
                        console.log(`📊 Loading progress: ${loaded}/${total} (${percent}%)`);
                    });
                    console.log(`✅ Loaded ${sbItems.length} items from Supabase`);

                    if (sbItems.length > 0) {
                        // Show sample SKUs for debugging
                        console.log('Sample SKUs from Supabase:', sbItems.slice(0, 5).map(item => item.SKU));
                        console.log('Last 5 SKUs from Supabase:', sbItems.slice(-5).map(item => item.SKU));

                        const sbFile: CsvFile = {
                            id: 'CORE_SUPABASE',
                            name: 'Core Database',
                            size: 0,
                            rowCount: sbItems.length,
                            headers: Object.keys(sbItems[0]),
                            data: sbItems,
                            preview: sbItems.slice(0, 5)
                        };
                        setFiles([sbFile]); // Replace all files with Supabase data only
                        loadedFromSupabase = true;

                        // Set global cache for BOM code selection
                        (window as any).__CORE_DATA_CACHE__ = sbItems;
                        console.log('✅ Core data cached for BOM selection');
                    }
                } catch (e) {
                    console.warn("Supabase load failed, falling back to CSV", e);
                }

                const savedCore = await db.getCoreConfig();
                if (savedCore) {
                    setCoreConfig(savedCore);
                    // Only load CSV if Supabase failed or empty
                    if (!loadedFromSupabase) {
                        resources = [{ id: 'CORE_MAIN', url: savedCore.url, alias: 'CORE' }, ...resources];
                    }
                }
                setRemoteResources(resources);

                // ... (rest of function body - omitted for brevity, no changes needed)
                // --- ASYNC SETTINGS FETCH (FALLBACK ONLY) ---
                const dbWpConfig = await db.getSetting('wp_config');
                if (dbWpConfig) setWpConfig(prev => ({ ...prev, ...dbWpConfig }));

                const dbPrinterConfig = await db.getSetting('printer_config');
                if (dbPrinterConfig) setPrinterConfig(prev => ({ ...prev, ...dbPrinterConfig }));

                const savedPrinters = await db.getSetting('available_printers');
                if (savedPrinters) {
                    let parsedPrinters = savedPrinters;
                    if (typeof savedPrinters === 'string') try { parsedPrinters = JSON.parse(savedPrinters); } catch (e) { }
                    if (Array.isArray(parsedPrinters)) setAvailablePrinters(parsedPrinters);
                }

                const savedLogo = await db.getSetting('brand_logo');
                if (savedLogo) setBrandLogo(savedLogo);

                // Load General Products images AFTER getting the latest config from DB
                const finalWpConfig = dbWpConfig ? { ...wpConfig, ...dbWpConfig } : wpConfig;
                if (finalWpConfig.url && finalWpConfig.username && finalWpConfig.appPassword) {
                    console.log('🎨 Loading General Products images with config:', {
                        url: finalWpConfig.url,
                        username: finalWpConfig.username,
                        hasPassword: !!finalWpConfig.appPassword
                    });
                    const promises = GENERAL_PRODUCT_NAMES.map(async (name) => {
                        const mapping = GENERAL_PRODUCT_MAPPING[name];
                        if (mapping && mapping.SKU) {
                            try {
                                const url = await fetchWpImage(mapping.SKU, finalWpConfig);
                                if (url) {
                                    setGeneralProductIconCache(name, url);
                                    console.log(`✅ Loaded icon for ${name}: ${url}`);
                                } else {
                                    console.warn(`⚠️ No image found for ${name} (SKU: ${mapping.SKU})`);
                                }
                            } catch (e) {
                                console.error(`❌ Failed to load icon for ${name}:`, e);
                            }
                        }
                    });
                    await Promise.allSettled(promises);
                    console.log('🎨 General Products image loading complete');
                }

                const savedGasUrl = await db.getSetting('google_script_url');
                if (savedGasUrl) setGoogleScriptUrl(savedGasUrl);

                // --- CAMERA PERSISTENCE FIX (CRITICAL) ---
                const devices = await refreshCameraDevices();
                const savedCameraPref = await db.getSetting('pos_camera_preference');
                const localLock = localStorage.getItem('pos_camera_locked') === 'true';
                const localSavedId = localStorage.getItem('pos_camera_deviceId');

                let idToRestore = '';
                if (localLock && localSavedId) {
                    idToRestore = localSavedId;
                } else if (localLock && savedCameraPref && savedCameraPref.deviceId) {
                    idToRestore = savedCameraPref.deviceId;
                }

                if (idToRestore) {
                    setSelectedCameraId(idToRestore);
                    setIsCameraLocked(true);
                    localStorage.setItem('pos_camera_locked', 'true');
                    localStorage.setItem('pos_camera_deviceId', idToRestore);
                } else if (devices.length > 0 && !selectedCameraId) {
                    setSelectedCameraId(devices[0].deviceId);
                }

                const handles = await db.getAllFileHandles();
                setFileSlots(handles);

                const newFiles: CsvFile[] = [];
                console.log("🔍 Check: loadedFromSupabase =", loadedFromSupabase, ", resources.length =", resources.length);

                // CRITICAL FIX: Only process CSV files if Supabase didn't load
                if (!loadedFromSupabase) {
                    // Load remote CSVs
                    if (resources.length > 0) {
                        try {
                            const remotePromises = resources.map(res => fetchAndParseUrl(res));
                            const results = await Promise.allSettled(remotePromises);
                            results.forEach((res, index) => {
                                if (res.status === 'fulfilled') newFiles.push(res.value);
                            });
                        } catch (e) { console.error("Remote load error", e); }
                    }

                    const storedFiles = await db.getAllFilesFromDB();
                    const finalFiles = [...newFiles];
                    storedFiles.forEach(stored => {
                        if (!finalFiles.some(f => f.name === stored.name)) finalFiles.push(stored);
                    });

                    if (finalFiles.length > 0) setFiles(finalFiles);
                }

                const genId = async () => {
                    const datePrefix = getMelbourneIdPrefix();

                    // Check if date changed since last run (Reset Logic)
                    const lastDate = localStorage.getItem('pos_seq_date');
                    if (lastDate !== datePrefix) {
                        localStorage.setItem('pos_seq', '0');
                        // We don't update date here to today until we save? 
                        // User said: "Update pos_seq_date to today... Only when user clicks Finish".
                        // But if we don't update here, it will reset to 0 every refresh?
                        // User said: "If date != today ... force local cache to 0".
                        // If I don't update lastDate, every F5 will see "lastDate != datePrefix" (undefined != today) -> reset to 0.
                        // This seems correct for the "Reset" part. 
                        // But if I refresh page 10 times, it will keep reseting to 0?
                        // If I have orders in Cloud, max(Cloud, 0) works.
                        // If I have NO orders in Cloud, max(0, 0) + 1 = 1.
                        // Seems OK.
                    }

                    const cloudSeq = await db.getLastSequenceNumber(datePrefix);
                    const localSeq = parseInt(localStorage.getItem('pos_seq') || '0');

                    // PRIORITIZE CLOUD: Fixes "Ghost ID" issues where local cache drifted high.
                    // If cloud is reachable and has data, trust it. Fallback to local only if cloud is 0/offline.
                    const currentMax = cloudSeq > 0 ? cloudSeq : localSeq;

                    const nextSeq = currentMax + 1;
                    // REMOVED: localStorage.setItem('pos_seq', nextSeq.toString());

                    const seqStr = String(nextSeq).padStart(3, '0');
                    const nextId = `${datePrefix}-${seqStr}`;
                    setCurrentOrder(prev => ({ ...prev, orderId: nextId }));
                };
                await genId();

            } catch (err) {
                console.error("Initialization error", err);
            } finally {
                setIsLoaded(true);
            }
        };
        initApp();
    }, []);

    // Refresh order ID every minute to sync with other terminals
    useEffect(() => {
        const refreshOrderId = async () => {
            try {
                const datePrefix = getMelbourneIdPrefix();
                const cloudSeq = await db.getLastSequenceNumber(datePrefix);
                const localSeq = parseInt(localStorage.getItem('pos_seq') || '0');
                const currentMax = cloudSeq > 0 ? cloudSeq : localSeq;
                const nextSeq = currentMax + 1;
                const seqStr = String(nextSeq).padStart(3, '0');
                const nextId = `${datePrefix}-${seqStr}`;

                // Only update if the ID has changed
                setCurrentOrder(prev => {
                    if (prev.orderId !== nextId) {
                        console.log(`🔄 Order ID refreshed: ${prev.orderId} → ${nextId}`);
                        return { ...prev, orderId: nextId };
                    }
                    return prev;
                });
            } catch (err) {
                console.error("Order ID refresh error", err);
            }
        };

        // Refresh immediately on mount, then every 60 seconds
        const interval = setInterval(refreshOrderId, 60000); // 60 seconds

        return () => clearInterval(interval);
    }, []);


    // ... (rest of App component code)
    const handleUpdateInventoryItem = async (updatedItem: InventoryItem) => {
        try {
            console.log('🔄 Updating product:', updatedItem.Code, updatedItem);

            // 1. Update Supabase and sync to Google Sheet
            await coreService.updateProductWithSync(updatedItem, googleScriptUrl);

            // 2. Reload from Supabase to ensure consistency
            console.log('🔄 Reloading data from Supabase...');
            const freshData = await coreService.fetchCoreFromSupabase();

            // 3. Update Local State with fresh data
            const newFiles = [...files];
            let masterFileIndex = files.findIndex(f =>
                f.id.includes('CORE') ||
                f.name.toLowerCase().includes('core') ||
                f.name.toLowerCase().includes('lt')
            );

            if (masterFileIndex === -1) {
                masterFileIndex = files.findIndex(f => f.data && f.data.length > 0);
            }

            if (masterFileIndex !== -1) {
                // Debug: Check if the updated item is in the fresh data
                const updatedInFreshData = freshData.find(item => item.Code === updatedItem.Code);
                console.log('🔍 Updated item in fresh data:', {
                    Code: updatedInFreshData?.Code,
                    SubCat: updatedInFreshData?.SubCat,
                    SKU: updatedInFreshData?.SKU
                });

                newFiles[masterFileIndex] = {
                    ...newFiles[masterFileIndex],
                    data: freshData
                };
                setFiles(newFiles);
                console.log('✅ Local state refreshed with', freshData.length, 'items');
                console.log('📦 New files array reference:', newFiles !== files);
                console.log('📦 New data array reference:', freshData !== files[masterFileIndex].data);
            }

            success(`Updated ${updatedItem.Code} in Supabase & Google Sheet!`);
        } catch (e: any) {
            console.error("Update failed", e);
            error(`Failed to update: ${e.message}`);
        }
    };

    const handleAddNewProduct = async (newItem: InventoryItem) => {
        try {
            // 1. Save to Supabase and sync to Google Sheet
            const savedItem = await coreService.addNewProductWithSync(newItem, googleScriptUrl);

            // 2. Add to Product Queue
            const nextSeq = await db.getNextQueueSequence();
            await db.addToProductQueue({
                sequence_number: nextSeq,
                code: savedItem.Code,
                sku: savedItem.SKU,
                description: savedItem.Description
            });

            // 3. Update Local State (Optimistic UI)
            const supaFileIndex = files.findIndex(f => f.id === 'CORE_SUPABASE');
            if (supaFileIndex !== -1) {
                const newFiles = [...files];
                const masterFile = { ...newFiles[supaFileIndex] };
                masterFile.data = [...masterFile.data, { ...savedItem, _id: Math.random() }];
                newFiles[supaFileIndex] = masterFile;
                setFiles(newFiles);
            }

            // Success message is handled in AddProduct component
        } catch (e: any) {
            console.error(e);
            throw e; // Re-throw to let AddProduct handle the error alert
        }
    };

    const handleAddToBarcodeQueue = (items: InventoryItem[]) => {
        if (items.length === 0) {
            info("No items selected.");
            return;
        }
        setBarcodeQueue(prev => [...prev, ...items.map(item => ({ ...item, printQty: 0 }))]);
    };

    const handleLoadOrder = async (items: OrderItem[]) => {
        const inventory = processRawData(files);
        const cartItems: CartItem[] = items.map(i => {
            const fullItem = inventory.find(inv => inv.Code === i.CODE);
            return {
                Code: i.CODE,
                SKU: i.SKU,
                Description: fullItem ? fullItem.Description : i.CODE,
                ListPrice: i.PRICE,
                SalePrice: 0,
                NetCost: fullItem?.NetCost || 0,
                DiscRate: fullItem?.DiscRate || 0,
                FinalCost: fullItem?.FinalCost || 0,
                Stock: fullItem?.Stock || 0,
                Sold: 0,
                HL: fullItem?.HL || 0,
                Category: fullItem?.Category || 'Unknown',
                SubCat: fullItem?.SubCat || '',
                StockStatus: fullItem?.StockStatus || '',
                SU: fullItem?.SU || '',
                Barcode: fullItem?.Barcode || '',
                RefPrice: fullItem?.RefPrice || 0, // NEW
                Location: fullItem?.Location || '', // NEW 
                Comment: fullItem?.Comment || '', // NEW
                Qty: fullItem?.Qty || 0, // Total Qty from Inventory
                ModelCode: fullItem?.ModelCode || '',
                Cluster: fullItem?.Cluster || '',
                AttColor: fullItem?.AttColor || '',
                CatCode: fullItem?.CatCode || '',
                _id: Math.random(),
                cartId: Math.random().toString(36),
                quantity: i.QTY,
                discountType: null,
                discountValue: 0,
                isGeneralProduct: !!i.GNINDEX,
                gnIndexLetter: i.GNINDEX || undefined
            };
        });
        const datePrefix = getMelbourneIdPrefix();
        const cloudSeq = await db.getLastSequenceNumber(datePrefix);
        const localSeq = parseInt(localStorage.getItem('pos_seq') || '0');
        const nextSeq = Math.max(cloudSeq, localSeq) + 1;
        localStorage.setItem('pos_seq', nextSeq.toString());
        const nextId = `${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
        setCurrentOrder({ uuid: crypto.randomUUID(), orderId: nextId, items: cartItems, sysPercent: 0, sysAmount: 0, finalPriceOverride: null, customerId: 'DEFAULT', paymentMethod: 'Card' });
        setCurrentView(AppView.PRODUCT_DETAILS);
    };

    // ... (Other handlers)
    const handleCheckDbConnection = async () => { setDbStatus('checking'); const isConnected = await db.checkSupabaseConnection(); setDbStatus(isConnected ? 'success' : 'error'); setTimeout(() => { if (isConnected) setDbStatus('idle'); }, 5000); };
    const handleUpdateCoreLink = async () => { if (!newCoreUrl) return; const config: db.CoreConfig = { url: newCoreUrl, updatedAt: new Date().toISOString(), name: 'CORE' }; await db.saveCoreConfig(config); setCoreConfig(config); setNewCoreUrl(''); alert("Core Link Updated. Please Refresh to load new data."); };
    const loadOrderStats = async () => { const stats = await db.getOrderStats(); setOrderStats(stats); };
    const handleCheckSync = async () => {
        const orders = await db.getOrdersByRange(syncStartDate, syncEndDate);
        setSyncOrders(orders);

        // Provide feedback when no orders found (not when all synced)
        if (orders.length === 0) {
            info('ℹ️ No orders found in the selected date range.');
        }
    };
    const handleExecuteSync = async () => {
        setIsSyncing(true);
        const unsynced = syncOrders.filter(o => !o.IS_SYNCED);
        const total = unsynced.length;

        setSyncProgress({ current: 0, total, currentOrder: '' });

        // Batch size for parallel processing
        const BATCH_SIZE = 5;
        let completed = 0;

        try {
            // Process in batches for better performance
            for (let i = 0; i < unsynced.length; i += BATCH_SIZE) {
                const batch = unsynced.slice(i, i + BATCH_SIZE);

                // Process batch in parallel
                await Promise.allSettled(
                    batch.map(async (order) => {
                        try {
                            setSyncProgress(prev => ({ ...prev, currentOrder: order.INDEX }));

                            const items = await db.getOrderItems(order.INDEX);
                            if (items.length === 0) return;

                            const gasHeader = {
                                INDEX: order.INDEX,
                                TIME: order.TIME,
                                ID: order.ID,
                                REFTOTAL: order.REFTOTAL,
                                ALLDISC: order.ALLDISC,
                                NEEDTOPAY: order.NEEDTOPAY,
                                PAIDBY: order.PAIDBY,
                                "%DISC": order.PERCENT_DISC,
                                "$DISC": order.DOLLAR_DISC,
                                FINALSET: order.FINALSET,
                                UUID: order.UUID,
                                OTN: order.OTN,
                                OSTATUS: order.OSTATUS
                            };

                            // Sync to Google Sheet
                            await fetch(googleScriptUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    type: 'sync_order',
                                    header: gasHeader,
                                    items: items
                                })
                            });

                            // NEW: Sync Comment back to Supabase
                            // This ensures Supabase Core table stays in sync with Google Sheet
                            if (order.OTN !== 'Test') {
                                const suffix = order.OSTATUS === 'Completed' ? 'S' : 'R';
                                const orderTag = `${order.INDEX}${suffix}`;

                                console.log(`📝 Syncing comment tags to Supabase for order ${order.INDEX}`);

                                // Update Comment for each item in the order
                                const EXCLUDED_CODES = new Set([
                                    'GNBOUQUET', 'GNBRANCH', 'GNFLOWER', 'GNSPRAY', 'GNLEAVES', 'GNSCULT',
                                    'GNBUSH', 'GNGARLAND', 'GNHANGING', 'GNGRASS', 'GNMAT', 'GNMOSS',
                                    'GNHPOT', 'GNPOT', 'GNARMT', 'GNBASKET', 'GNFRUIT', 'GNOTHER',
                                    'GNGIFT', 'GNFOAM', 'GNFREIGHT', 'GNTREE'
                                ]);

                                for (const item of items) {
                                    const itemCode = String(item.CODE).trim().toUpperCase();

                                    // Skip excluded codes (same logic as Google Apps Script)
                                    if (!EXCLUDED_CODES.has(itemCode)) {
                                        try {
                                            await coreService.appendCommentTag(itemCode, orderTag);
                                        } catch (commentError) {
                                            console.error(`Failed to update comment for ${itemCode}:`, commentError);
                                            // Continue with other items even if one fails
                                        }
                                    }
                                }
                            }

                            await db.updateOrderSyncStatus(order.INDEX, true);

                            completed++;
                            setSyncProgress(prev => ({ ...prev, current: completed }));
                        } catch (e) {
                            console.error("Sync Failed for " + order.INDEX, e);
                        }
                    })
                );
            }

            // Refresh sync status
            await handleCheckSync();

            // Show completion message
            success(`✅ Sync completed! ${completed}/${total} order(s) synced to Google Sheets.`);
        } catch (err) {
            console.error('Sync process error:', err);
            error('❌ Sync process encountered errors. Check console for details.');
        } finally {
            setIsSyncing(false);
            setSyncProgress({ current: 0, total: 0, currentOrder: '' });
        }
    };

    const saveCameraSelection = async (deviceId: string) => {
        setSelectedCameraId(deviceId);
        if (isCameraLocked) {
            localStorage.setItem('pos_camera_deviceId', deviceId);
            await db.saveSetting('pos_camera_preference', { deviceId, mode: 'manual_save' });
        }
    };

    const toggleCameraLock = async () => {
        const newState = !isCameraLocked;
        setIsCameraLocked(newState);
        localStorage.setItem('pos_camera_locked', String(newState));
        if (newState && selectedCameraId) {
            localStorage.setItem('pos_camera_deviceId', selectedCameraId);
            await db.saveSetting('pos_camera_preference', { deviceId: selectedCameraId, mode: 'manual_save' });
        }
    };

    const toggleCameraPreview = async () => { if (cameraPreviewStream) { cameraPreviewStream.getTracks().forEach(t => t.stop()); setCameraPreviewStream(null); } else { try { const constraints: MediaStreamConstraints = { video: { width: { ideal: 1280 } } }; if (selectedCameraId) (constraints.video as MediaTrackConstraints).deviceId = { exact: selectedCameraId }; const stream = await navigator.mediaDevices.getUserMedia(constraints); setCameraPreviewStream(stream); } catch (e) { alert("Failed to start preview: " + (e as Error).message); } } };
    useEffect(() => { if (cameraPreviewStream && cameraPreviewRef.current) cameraPreviewRef.current.srcObject = cameraPreviewStream; }, [cameraPreviewStream]);
    useEffect(() => { return () => { if (cameraPreviewStream) cameraPreviewStream.getTracks().forEach(t => t.stop()); } }, []);
    const parseFile = (file: File): Promise<CsvFile> => {
        return new Promise((resolve, reject) => {
            const isCore = file.name.toLowerCase().includes('lt') || file.name.toUpperCase().includes('CORE');
            Papa.parse(file, {
                header: !isCore,
                skipEmptyLines: true,
                complete: (results) => {
                    // CRITICAL FIX: When header:false, first row is the header row - skip it!
                    const actualData = isCore ? results.data.slice(1) : results.data;
                    resolve({
                        id: Math.random().toString(36).substr(2, 9),
                        name: file.name,
                        size: file.size,
                        rowCount: actualData.length,
                        headers: results.meta.fields || [],
                        data: actualData,
                        preview: actualData.slice(0, 5)
                    });
                },
                error: (err: any) => reject(err)
            });
        });
    };

    const fetchAndParseUrl = async (resource: RemoteResource): Promise<CsvFile> => {
        let urlToUse = resource.url;
        if (urlToUse.includes('docs.google.com/spreadsheets') && !urlToUse.includes('output=csv')) {
            const match = urlToUse.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) urlToUse = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        }
        const response = await fetch(urlToUse);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const text = await response.text();
        return new Promise((resolve, reject) => {
            const isCore = resource.alias === 'CORE';
            Papa.parse(text, {
                header: !isCore,
                skipEmptyLines: true,
                complete: (results) => {
                    // CRITICAL FIX: When header:false, first row is the header row - skip it!
                    const actualData = isCore ? results.data.slice(1) : results.data;
                    resolve({
                        id: `remote_${resource.id}`,
                        name: resource.alias + '.csv',
                        size: text.length,
                        rowCount: actualData.length,
                        headers: results.meta.fields || [],
                        data: actualData,
                        preview: actualData.slice(0, 5)
                    });
                },
                error: (err: any) => reject(err)
            });
        });
    };
    const handleFallbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { if (activeSlot === null || !e.target.files || e.target.files.length === 0) return; const file = e.target.files[0]; await db.saveFileHandle(activeSlot, null, file.name); const newSlots = await db.getAllFileHandles(); setFileSlots(newSlots); const parsedFile = await parseFile(file); setFiles(prev => { const filtered = prev.filter(f => f.name !== file.name); return [...filtered, parsedFile]; }); setActiveSlot(null); if (fallbackFileInputRef.current) fallbackFileInputRef.current.value = ''; };
    const handleAddResource = async () => { if (!newResUrl.trim()) return; setIsRemoteLoading(true); try { const newRes: RemoteResource = { id: Math.random().toString(36).substr(2, 9), url: newResUrl.trim(), alias: newResAlias.trim() }; const parsedFile = await fetchAndParseUrl(newRes); const updatedList = [...remoteResources, newRes]; await db.saveSetting('remote_resources', updatedList); setRemoteResources(updatedList); setFiles(prev => { const filtered = prev.filter(f => f.name !== parsedFile.name); return [...filtered, parsedFile]; }); setNewResUrl(''); setNewResAlias(''); alert(`Successfully loaded & saved as default: ${parsedFile.name}`); } catch (e: any) { alert(`Failed to load URL: ${e.message}`); } finally { setIsRemoteLoading(false); } };
    const reloadAllRemote = async () => { setIsRemoteLoading(true); const newRemoteFiles: CsvFile[] = []; await Promise.all(remoteResources.map(async (res) => { try { newRemoteFiles.push(await fetchAndParseUrl(res)); } catch (e) { } })); if (newRemoteFiles.length > 0) { setFiles(prev => { const localOnly = prev.filter(f => !f.id.startsWith('remote_')); return [...localOnly, ...newRemoteFiles]; }); } setIsRemoteLoading(false); alert(`Reload Complete.`); };
    const saveGasConfig = async () => { await db.saveSetting('google_script_url', googleScriptUrl); setIsGasSaved(true); setTimeout(() => setIsGasSaved(false), 2000); };
    const saveWpConfig = async () => {
        await db.saveSetting('wp_config', wpConfig);

        // Reload General Products images with new credentials
        if (wpConfig.url && wpConfig.username && wpConfig.appPassword) {
            const promises = GENERAL_PRODUCT_NAMES.map(async (name) => {
                const mapping = GENERAL_PRODUCT_MAPPING[name];
                if (mapping && mapping.SKU) {
                    const url = await fetchWpImage(mapping.SKU, wpConfig);
                    if (url) setGeneralProductIconCache(name, url);
                }
            });
            await Promise.allSettled(promises);
        }

        alert('WordPress Configuration Saved. General Products images reloaded.');
    };
    const savePrinterConfig = async () => { setIsSavingPrinter('saving'); try { await db.saveSetting('printer_config', printerConfig); localStorage.setItem('pos_enable_local_print', String(enableLocalPrint)); setIsSavingPrinter('saved'); setTimeout(() => setIsSavingPrinter('idle'), 2000); } catch (e) { alert('Save Failed: ' + e); setIsSavingPrinter('idle'); } };
    const toggleLocalPrint = () => { setEnableLocalPrint(prev => !prev); };
    const handleScanPrinters = async () => { if (isPrinterChecking) return; setIsPrinterChecking(true); setAvailablePrinters([]); try { await db.saveSetting('available_printers', null); const sent = await requestPrinterScan(); if (!sent) { setIsPrinterChecking(false); return; } let attempts = 0; const maxAttempts = 15; const pollInterval = setInterval(async () => { attempts++; const printers = await db.getSetting('available_printers'); if (printers && Array.isArray(printers) && printers.length > 0) { clearInterval(pollInterval); setAvailablePrinters(printers); setIsPrinterChecking(false); alert(`✅ Found ${printers.length} local printers!`); } else if (attempts >= maxAttempts) { clearInterval(pollInterval); setIsPrinterChecking(false); alert("⚠️ No response from Printer Agent.\n\nPlease check:\n1. Server is running\n2. Database connection is green"); } }, 1000); } catch (e) { console.error("Scan error", e); setIsPrinterChecking(false); } };
    const handleTestReceipt = async () => { if (!printerConfig.receiptPrinter) return alert("Select a Receipt Printer first"); const success = await testReceiptPrint(printerConfig); if (success) alert(`Sent Receipt Test to: ${printerConfig.receiptPrinter}`); };
    const handleTestLabel = async () => { if (!printerConfig.labelPrinter) return alert("Select a Label Printer first"); const success = await testLabelPrint(printerConfig); if (success) alert(`Sent Label Test to: ${printerConfig.labelPrinter}`); };
    const handleTestWaybill = async () => { if (!printerConfig.waybillPrinter) return alert("Select a Waybill Printer first"); const success = await testWaybillPrint(printerConfig); if (success) alert(`Sent Waybill Test to: ${printerConfig.waybillPrinter}`); };
    const runImageIndexer = async () => { if (files.length === 0) { alert("Please load CORE data first."); return; } const inventory = processRawData(files); const skus = Array.from(new Set(inventory.filter(i => i.SKU).map(i => i.SKU))); if (skus.length === 0) { alert("No SKUs found in data."); return; } setIsIndexing(true); stopIndexRef.current = false; setIndexLogs([]); setIndexProgress({ current: 0, total: skus.length, matches: 0 }); const supabase = getSupabase(); for (let i = 0; i < skus.length; i++) { if (stopIndexRef.current) break; const sku = skus[i]; setIndexProgress(p => ({ ...p, current: i + 1 })); try { await new Promise(r => setTimeout(r, 100)); const foundImages = await scanProductImages(sku, wpConfig); if (foundImages.length > 0) { const records = foundImages.map(img => ({ sku: sku, image_url: img.url, wp_id: img.wp_id, variant_type: img.variant, sort_order: img.sort_order })); const { error } = await supabase.from('product_images').upsert(records, { onConflict: 'sku,sort_order' }); if (!error) { setIndexProgress(p => ({ ...p, matches: p.matches + 1 })); setIndexLogs(prev => [`✅ ${sku}: Found ${foundImages.length} img`, ...prev.slice(0, 10)]); } else { setIndexLogs(prev => [`❌ ${sku}: DB Error`, ...prev.slice(0, 10)]); } } } catch (e) { console.error(e); } } setIsIndexing(false); alert("Indexing Completed!"); };

    const handleUnlockAdmin = () => {
        if (passwordInput === 'imsgimini') {
            setIsAdminUnlocked(true);
            setShowPasswordPrompt(false);
            setPasswordInput('');
        } else {
            alert("Incorrect Password");
        }
    };

    const toggleViewVisibility = (viewId: string) => {
        setVisibleViews(prev => {
            const currentVisible = prev[viewId] !== false; // Default true if undefined
            const next = { ...prev, [viewId]: !currentVisible };
            localStorage.setItem('app_menu_visibility', JSON.stringify(next));
            return next;
        });
    };

    const handleSetAppMode = async (mode: AppMode) => {
        setAppMode(mode);
        localStorage.setItem('pos_app_mode', mode); // Local Instant
        try {
            await db.saveSetting('app_mode', mode); // Cloud Async
        } catch (e) { console.error("Cloud Save Mode Fail", e); }
    };

    const handleSearchMedia = async () => {
        if (!logoSearchTerm) return;
        setIsSearchingLogo(true);
        const results = await searchMediaLibrary(logoSearchTerm, wpConfig);
        setLogoSearchResults(results);
        setIsSearchingLogo(false);
    };

    const handleSelectLogo = (url: string) => {
        setBrandLogo(url);
        setLogoSearchResults([]);
        setLogoSearchTerm('');
    };

    const handleSaveBrandLogo = async () => {
        await db.saveSetting('brand_logo', brandLogo);
        setIsBrandLogoSaved(true);
        setTimeout(() => setIsBrandLogoSaved(false), 2000);
    };

    const handleAddToWpQueue = async (items: InventoryItem[]) => {
        console.log('🔵 handleAddToWpQueue called with items:', items);

        if (items.length === 0) {
            info("No items selected.");
            return;
        }

        try {
            let addedCount = 0;
            let skippedCount = 0;
            const nextSeq = await db.getNextReviewQueueSequence();
            console.log('🔵 Next sequence number:', nextSeq);

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                console.log(`🔵 Processing item ${i + 1}/${items.length}:`, { Code: item.Code, SKU: item.SKU, Description: item.Description });

                // Check if SKU already exists in queue
                const exists = await db.isSkuInReviewQueue(item.SKU);
                console.log(`🔵 SKU ${item.SKU} exists in queue:`, exists);

                if (exists) {
                    skippedCount++;
                    console.log(`⏭️ Skipped ${item.SKU} - already in Product Review Queue`);
                } else {
                    // Add to queue
                    console.log(`🔵 Attempting to add to queue:`, {
                        sequence_number: nextSeq + addedCount,
                        code: item.Code,
                        sku: item.SKU,
                        description: item.Description
                    });

                    const successAdd = await db.addToProductReviewQueue({
                        sequence_number: nextSeq + addedCount,
                        code: item.Code,
                        sku: item.SKU,
                        description: item.Description
                    });

                    console.log(`🔵 Add result for ${item.SKU}:`, successAdd);

                    if (successAdd) {
                        addedCount++;
                    }
                }
            }

            console.log(`🔵 Final counts - Added: ${addedCount}, Skipped: ${skippedCount}`);

            // Show result message
            if (addedCount > 0 && skippedCount > 0) {
                success(`✅ Added ${addedCount} item(s) to Product Review Queue. ${skippedCount} item(s) already in queue.`);
            } else if (addedCount > 0) {
                success(`✅ Added ${addedCount} item(s) to Product Review Queue`);
            } else {
                info(`ℹ️ All ${skippedCount} item(s) are already in Product Review Queue`);
            }
        } catch (e: any) {
            console.error('❌ Error in handleAddToWpQueue:', e);
            error(`Failed to add items to Product Review Queue: ${e.message}`);
        }
    };

    // --- NEW: Login Control Handlers ---
    const handleVerifyStartup = () => {
        if (startupPasswordInput === loginConfig.password) {
            setIsAppLocked(false);
            setStartupPasswordInput('');
            setLoginError('');
        } else {
            setLoginError('Incorrect password. Please try again or refresh the page.');
        }
    };

    const handleConfirmLoginSecurityAction = () => {
        if (verificationPassword === loginConfig.password) {
            if (isVerifyingLockAction === 'enable') {
                const newConfig = { ...loginConfig, isEnabled: true };
                setLoginConfig(newConfig);
                localStorage.setItem('pos_login_config', JSON.stringify(newConfig));
            } else if (isVerifyingLockAction === 'disable') {
                const newConfig = { ...loginConfig, isEnabled: false };
                setLoginConfig(newConfig);
                localStorage.setItem('pos_login_config', JSON.stringify(newConfig));
            }
            setIsVerifyingLockAction(null);
            setVerificationPassword('');
        } else {
            alert("Incorrect verification password.");
        }
    };

    const handleChangeStartupPassword = (newPass: string) => {
        if (!newPass) return;
        const newConfig = { ...loginConfig, password: newPass };
        setLoginConfig(newConfig);
        localStorage.setItem('pos_login_config', JSON.stringify(newConfig));
        alert("Startup password updated successfully!");
    };


    // --- NEW: Core Sync Handlers ---
    const handlePushCoreToCloud = async () => {
        const masterFile = files.find(f => f.name.toLowerCase().includes('lt') || f.id.includes('CORE'));
        if (!masterFile) { alert("No Core File loaded to push!"); return; }

        setIsUploadingCore(true);
        try {
            const inventory = processRawData([masterFile]);
            await coreService.uploadCoreToSupabase(inventory, (percent) => {
                console.log(`Uploading: ${percent}%`);
            });
            alert("✅ Successfully Pushed Core to Cloud!");
        } catch (e: any) {
            console.error(e);
            alert("❌ Upload Failed: " + e.message);
        } finally {
            setIsUploadingCore(false);
        }
    };

    const handleExportCloudCore = async () => {
        try {
            const items = await coreService.fetchCoreFromSupabase();
            if (items.length === 0) { alert("Cloud Database is Empty."); return; }

            const csv = coreService.exportToCsv(items);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'Inventory_Core_Export.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e: any) {
            alert("❌ Export Failed: " + e.message);
        }
    };

    // --- NEW: Add Item to Cart from AI Terminal (State Lifting) ---
    const handleAddToCartFromAI = (item: InventoryItem, qty: number) => {
        // Logic copied from ProductScanner's addToCart but simplified
        setCurrentOrder(prev => {
            const idx = prev.items.findIndex(i => i.Code === item.Code && !i.isGeneralProduct);
            if (idx >= 0) {
                const copy = [...prev.items];
                copy[idx].quantity += qty;
                return { ...prev, items: copy };
            }
            const newItem: CartItem = {
                ...item,
                quantity: qty,
                cartId: Math.random().toString(36),
                discountType: null,
                discountValue: 0,
                imageUrl: null
            };
            return { ...prev, items: [newItem, ...prev.items] };
        });
        // Optionally notify user
        alert(`Added ${item.Code} to Cart`);
    };

    return (
        <div className="flex h-screen bg-dark-bg overflow-hidden font-sans selection:bg-gemini-500/30 selection:text-gemini-200">

            {/* LABEL PREVIEW MODAL */}
            <AdminAuthModal
                isOpen={isUploadAuthOpen}
                onClose={() => setIsUploadAuthOpen(false)}
                onSuccess={handlePushCoreToCloud}
                title="Authorize Cloud Push"
            />
            {showLabelDemo && <LabelPreviewModal onClose={() => setShowLabelDemo(false)} />}

            <Sidebar currentView={currentView} onChangeView={setCurrentView} fileCount={files.length} visibleViews={visibleViews} logoUrl={brandLogo} />
            <main className="flex-1 overflow-hidden">
                <div className="h-full w-full">
                    <Suspense fallback={<LoadingFallback />}>

                        {currentView === AppView.DATA_SOURCES && (
                            <div className="max-w-5xl mx-auto space-y-8 p-8 overflow-y-auto h-full custom-scrollbar">
                                {/* ... (Existing Data Sources Content) ... */}
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold text-white">Data Management</h2>
                                </div>

                                {/* 1. CORE CONFIG */}
                                <div className="glass-panel p-6 rounded-xl border border-dark-border">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Database className="w-5 h-5 text-blue-400" /> Core Inventory Config</h3>
                                            <p className="text-xs text-gray-500 mt-1">Main CSV source for product data.</p>
                                        </div>
                                    </div>
                                    <div className="bg-black/40 rounded-lg p-3 border border-dark-border flex flex-col gap-2">
                                        <div className="text-sm font-mono text-gray-300 break-all">{coreConfig?.url || 'Not Configured'}</div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="New Core CSV URL"
                                                value={newCoreUrl}
                                                onChange={e => setNewCoreUrl(e.target.value)}
                                                className="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
                                            />
                                            <button onClick={handleUpdateCoreLink} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold">Update</button>
                                        </div>

                                        {/* Buttons moved from Settings */}
                                        <div className="flex gap-3 pt-2 mt-2 border-t border-dark-border/50">
                                            <button
                                                onClick={() => setIsUploadAuthOpen(true)}
                                                disabled={isUploadingCore}
                                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isUploadingCore ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                                Push Core
                                            </button>

                                            <button
                                                onClick={handleExportCloudCore}
                                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-bold flex items-center gap-2"
                                            >
                                                <Download className="w-3 h-3" />
                                                Export Cloud
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. GENERAL PRODUCT CONFIG */}
                                <div className="glass-panel p-6 rounded-xl border border-dark-border">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><FlaskConical className="w-5 h-5 text-purple-400" /> General Product Config</h3>
                                            <p className="text-xs text-gray-500 mt-1">Config for General Items (Flowers, Pots, etc.)</p>
                                        </div>
                                    </div>
                                    <div className="bg-black/40 rounded-lg p-3 border border-dark-border flex flex-col gap-2">
                                        <div className="text-sm font-mono text-gray-300 break-all">{generalConfig?.url || GENERAL_CONFIG_URL}</div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="New General CSV URL"
                                                value={newGeneralUrl}
                                                onChange={e => setNewGeneralUrl(e.target.value)}
                                                className="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
                                            />
                                            <button onClick={handleUpdateGeneralLink} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm font-bold">Update</button>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. SUB CATEGORY CONFIG (CATCODE) */}
                                <div className="glass-panel p-6 rounded-xl border border-dark-border">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-green-400" /> Sub Category Rules</h3>
                                            <p className="text-xs text-gray-500 mt-1">Rules for generating 3-digit Category Codes.</p>
                                        </div>
                                    </div>
                                    <div className="bg-black/40 rounded-lg p-3 border border-dark-border flex flex-col gap-2">
                                        <div className="text-sm font-mono text-gray-300 break-all">{subCatConfig?.url || 'Default System Rules'}</div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="New SubCat/CatCode CSV URL"
                                                value={newSubCatUrl}
                                                onChange={e => setNewSubCatUrl(e.target.value)}
                                                className="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
                                            />
                                            <button onClick={handleUpdateSubCatLink} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">Update</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Sync Dashboard */}
                                <div className="glass-panel p-6 rounded-xl border border-dark-border">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Cloud className="w-5 h-5 text-teal-400" /> Sync Dashboard</h3>
                                    </div>
                                    <div className="bg-dark-bg/50 p-4 rounded-xl border border-dark-border space-y-4">
                                        <div className="flex flex-wrap gap-4 items-end">
                                            <div><label className="block text-xs text-gray-500 mb-1">Start Date</label><input type="date" value={syncStartDate} onChange={e => setSyncStartDate(e.target.value)} className="bg-dark-surface border border-dark-border rounded px-3 py-1.5 text-white text-sm" /></div>
                                            <div><label className="block text-xs text-gray-500 mb-1">End Date</label><input type="date" value={syncEndDate} onChange={e => setSyncEndDate(e.target.value)} className="bg-dark-surface border border-dark-border rounded px-3 py-1.5 text-white text-sm" /></div>
                                            <button onClick={handleCheckSync} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium">Check Status</button>
                                            {syncOrders.some(o => !o.IS_SYNCED) && (<button onClick={handleExecuteSync} disabled={isSyncing} className="ml-auto px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium flex items-center gap-2">{isSyncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} Sync Pending ({syncOrders.filter(o => !o.IS_SYNCED).length})</button>)}
                                        </div>
                                        {/* Progress Bar */}
                                        {isSyncing && syncProgress.total > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <div className="flex justify-between text-xs text-gray-400">
                                                    <span>Syncing: {syncProgress.currentOrder}</span>
                                                    <span>{syncProgress.current} / {syncProgress.total}</span>
                                                </div>
                                                <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-600 to-teal-500 transition-all duration-300"
                                                        style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="text-center text-xs text-gray-500">
                                                    {Math.round((syncProgress.current / syncProgress.total) * 100)}% Complete
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Image Indexer */}
                                <div className="glass-panel p-6 rounded-xl border border-dark-border">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Image className="w-5 h-5 text-purple-400" /> Image Index Builder</h3>
                                            <p className="text-xs text-gray-500 mt-1">Scans SKUs against WordPress & builds Supabase index.</p>
                                        </div>
                                        <button
                                            onClick={isIndexing ? () => stopIndexRef.current = true : runImageIndexer}
                                            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${isIndexing ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                                        >
                                            {isIndexing ? <><StopCircle className="w-4 h-4" /> Stop</> : <><PlayCircle className="w-4 h-4" /> Start Indexing</>}
                                        </button>
                                    </div>
                                    <div className="bg-black/40 rounded-lg p-3 border border-dark-border">
                                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                                            <span>Progress: {indexProgress.current} / {indexProgress.total}</span>
                                            <span className="text-green-400">Indexed: {indexProgress.matches} SKUs</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-500 transition-all duration-300"
                                                style={{ width: `${indexProgress.total ? (indexProgress.current / indexProgress.total) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                        <div className="mt-3 h-24 overflow-y-auto font-mono text-[10px] text-gray-500 space-y-1 custom-scrollbar">
                                            {indexLogs.length === 0 ? <div className="italic opacity-50">Waiting to start...</div> : indexLogs.map((l, i) => <div key={i}>{l}</div>)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentView === AppView.INVENTORY && (
                            <div className="h-full p-4">
                                <InventorySearch
                                    files={files}
                                    wpConfig={wpConfig}
                                    onUpdateItem={handleUpdateInventoryItem}
                                    onAddToBarcodeQueue={handleAddToBarcodeQueue}
                                    onAddToWpQueue={handleAddToWpQueue}
                                    onOpenVCA={handleOpenVCA}
                                />
                            </div>
                        )}

                        {/* --- ADD PRODUCT VIEW --- */}
                        {currentView === AppView.ADD_PRODUCT && (
                            <div className="h-full">
                                {/* Pass Files Prop Here */}
                                <AddProduct files={files} onSave={handleAddNewProduct} />
                            </div>
                        )}

                        {/* --- MANUFACTURING HUB --- */}
                        {currentView === AppView.MANUFACTURING && (
                            <div className="h-full">
                                <ManufactureHub
                                    googleScriptUrl={googleScriptUrl}
                                    appMode={appMode}
                                />
                            </div>
                        )}

                        {/* ----------------------------- */}
                        {currentView === AppView.BARCODE_PRINT && (
                            <div className="h-full">
                                <BarcodeManager
                                    queue={barcodeQueue}
                                    setQueue={setBarcodeQueue}
                                    printerConfig={printerConfig}
                                />
                            </div>
                        )}
                        {currentView === AppView.PRODUCT_DETAILS && (
                            <div className="h-full p-2">
                                <ProductScanner
                                    files={files}
                                    wpConfig={wpConfig}
                                    order={currentOrder}
                                    onUpdateOrder={setCurrentOrder}
                                    selectedCameraId={selectedCameraId}
                                    appMode={appMode}
                                    isGeneralReady={isGeneralReady}
                                    printerConfig={printerConfig}
                                    enableLocalPrint={enableLocalPrint}
                                />
                            </div>
                        )}

                        {currentView === AppView.ORDERS && (
                            <div className="h-full">
                                <OrdersManager
                                    files={files}
                                    wpConfig={wpConfig}
                                    printerConfig={printerConfig}
                                    enableLocalPrint={enableLocalPrint}
                                    onLoadOrder={handleLoadOrder}
                                />
                            </div>
                        )}

                        {currentView === AppView.ADD_PRODUCT_QUEUE && (
                            <div className="h-full">
                                <AddProductQueue
                                    files={files}
                                    onAddToBarcodeQueue={handleAddToBarcodeQueue}
                                    onAddToWpQueue={handleAddToWpQueue}
                                    printerConfig={printerConfig}
                                />
                            </div>
                        )}



                        {currentView === AppView.SETTINGS && (
                            <div className="max-w-4xl mx-auto pb-10 p-8 overflow-y-auto h-full custom-scrollbar">
                                <div className="glass-panel p-8 rounded-2xl border border-dark-border">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-2xl font-bold text-white">System Configuration</h2>
                                        {/* GLOBAL SAVE BUTTON REMOVED */}
                                    </div>
                                    <div className="space-y-8 mt-4">
                                        {/* --- BRAND CONFIGURATION --- */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-yellow-400" /> Brand Configuration</h3>
                                            <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 flex flex-col gap-4">
                                                <div className="flex items-start gap-6">
                                                    {/* Preview */}
                                                    <div className="w-24 h-24 bg-black rounded-xl border border-dark-border flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {brandLogo ? <img src={brandLogo} className="w-full h-full object-contain" /> : <div className="text-gray-600 text-xs">No Logo</div>}
                                                    </div>

                                                    <div className="flex-1 space-y-4">
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                                                <input
                                                                    type="text"
                                                                    value={logoSearchTerm}
                                                                    onChange={(e) => setLogoSearchTerm(e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchMedia()}
                                                                    placeholder="Search WP Media Library..."
                                                                    className="w-full bg-dark-surface border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-gemini-500"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={handleSearchMedia}
                                                                disabled={isSearchingLogo || !logoSearchTerm}
                                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                                            >
                                                                {isSearchingLogo ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Search'}
                                                            </button>
                                                            <button
                                                                onClick={handleSaveBrandLogo}
                                                                disabled={isBrandLogoSaved}
                                                                className={`px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${isBrandLogoSaved ? 'bg-green-500' : 'bg-green-600 hover:bg-green-500'}`}
                                                            >
                                                                {isBrandLogoSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                                                {isBrandLogoSaved ? 'Saved!' : 'Save'}
                                                            </button>
                                                        </div>

                                                        {/* Results Grid */}
                                                        {logoSearchResults.length > 0 && (
                                                            <div className="bg-dark-surface border border-dark-border rounded-lg p-2 h-40 overflow-y-auto custom-scrollbar grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                                                {logoSearchResults.map((img) => (
                                                                    <div
                                                                        key={img.id}
                                                                        onClick={() => handleSelectLogo(img.url)}
                                                                        className={`aspect-square bg-black rounded border cursor-pointer overflow-hidden relative group ${brandLogo === img.url ? 'border-green-500 ring-2 ring-green-500/50' : 'border-gray-700 hover:border-gray-500'}`}
                                                                        title={img.title}
                                                                    >
                                                                        <img src={img.url} className="w-full h-full object-cover" />
                                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <Check className="w-5 h-5 text-white" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {logoSearchResults.length === 0 && isSearchingLogo === false && logoSearchTerm && (
                                                            <p className="text-xs text-gray-500 italic">No media found. Try a different term.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>


                                        {/* --- APP MODE --- */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><FlaskConical className="w-5 h-5 text-orange-400" /> System Mode</h3>
                                            <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-white">Current Mode: <span className={appMode === 'Test' ? 'text-orange-400 font-bold' : 'text-green-400 font-bold'}>{appMode === 'Test' ? 'TEST (Under Test)' : 'NORMAL (Production)'}</span></p>
                                                    <p className="text-xs text-gray-500 mt-1">Test orders are marked 'Test' in database and do NOT deduct stock.</p>
                                                </div>
                                                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                                                    <button onClick={() => handleSetAppMode('Normal')} className={`px-4 py-1.5 rounded text-sm font-bold transition-all ${appMode === 'Normal' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Normal</button>
                                                    <button onClick={() => handleSetAppMode('Test')} className={`px-4 py-1.5 rounded text-sm font-bold transition-all ${appMode === 'Test' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Test</button>
                                                </div>
                                            </div>
                                        </div>
                                        {/* ... Database Status Block ... */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-400" /> Database Status</h3>
                                            <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-white">Supabase Connection</p>
                                                    <p className="text-xs text-gray-500 mt-1">Check connectivity to cloud database.</p>
                                                </div>
                                                <button onClick={handleCheckDbConnection} disabled={dbStatus === 'checking'} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${dbStatus === 'success' ? 'bg-green-600 text-white' : dbStatus === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                                                    {dbStatus === 'checking' && <RefreshCcw className="w-4 h-4 animate-spin" />}
                                                    {dbStatus === 'success' && <Check className="w-4 h-4" />}
                                                    {dbStatus === 'error' && <AlertTriangle className="w-4 h-4" />}
                                                    {dbStatus === 'idle' ? 'Test Connection' : dbStatus === 'checking' ? 'Checking...' : dbStatus === 'success' ? 'Connected' : 'Failed'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* --- CLEAR CACHE --- */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400" /> Clear Cache</h3>
                                            <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-white">Clear All Cached Data</p>
                                                        <p className="text-xs text-gray-500 mt-1">Clears IndexedDB, LocalStorage, and SessionStorage. Page will reload.</p>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm('⚠️ This will clear ALL cached data and reload the page. Continue?')) return;
                                                            try {
                                                                // Clear IndexedDB
                                                                const dbs = await indexedDB.databases();
                                                                for (const db of dbs) {
                                                                    if (db.name) indexedDB.deleteDatabase(db.name);
                                                                }
                                                                // Clear LocalStorage & SessionStorage
                                                                localStorage.clear();
                                                                sessionStorage.clear();
                                                                alert('✅ Cache cleared! Page will reload.');
                                                                window.location.reload();
                                                            } catch (e) {
                                                                alert('❌ Failed to clear cache: ' + e);
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Clear Cache
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* --- CLEAR SUPABASE CORE DATA --- */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-orange-400" /> Clear Supabase Core Data</h3>
                                            <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-white">Delete All Core Inventory Data</p>
                                                        <p className="text-xs text-gray-500 mt-1">⚠️ Clears inventory_core table only. Orders are NOT affected.</p>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            const password = prompt('⚠️ Enter password to clear Supabase core data:');
                                                            if (password !== 'imsgimini') {
                                                                alert('❌ Incorrect password!');
                                                                return;
                                                            }
                                                            if (!confirm('⚠️ This will DELETE ALL inventory data from Supabase. Orders will NOT be affected. Continue?')) return;
                                                            try {
                                                                await coreService.clearAllData();
                                                                alert('✅ Supabase core data cleared! Please re-upload your CSV.');
                                                                window.location.reload();
                                                            } catch (e) {
                                                                alert('❌ Failed to clear data: ' + e);
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-all"
                                                    >
                                                        <Database className="w-4 h-4" />
                                                        Clear Core Data
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {/* --- PRINTER CONFIGURATION --- */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Printer className="w-5 h-5 text-yellow-400" /> Printer Configuration</h3>
                                            <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 space-y-4">
                                                <div className="flex justify-between items-center border-b border-dark-border pb-4 mb-4">
                                                    <div>
                                                        <div className="font-bold text-white">Enable Cloud Printing</div>
                                                        <div className="text-xs text-gray-500">Toggle ON to enable print buttons on this device.</div>
                                                    </div>
                                                    <button onClick={toggleLocalPrint} className={`w-12 h-6 rounded-full flex items-center transition-colors ${enableLocalPrint ? 'bg-green-600 justify-end pr-0.5' : 'bg-gray-700 justify-start pl-0.5'}`}><div className="w-5 h-5 bg-white rounded-full shadow-sm"></div></button>
                                                </div>
                                                {enableLocalPrint && (
                                                    <div className="animate-in fade-in space-y-4">
                                                        <div className="bg-blue-900/20 p-3 rounded border border-blue-800 text-xs text-blue-200 flex justify-between items-center">
                                                            <span>Ensure <b>PrinterServer.exe</b> is running on the host machine.</span>
                                                            <button onClick={handleScanPrinters} disabled={isPrinterChecking} className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                                                                {isPrinterChecking ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} {isPrinterChecking ? 'Scanning...' : 'Scan Local Printers'}
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-4 pt-2">
                                                            <PrinterSelector label="Label Printer" value={printerConfig.labelPrinter} onChange={(v) => setPrinterConfig(p => ({ ...p, labelPrinter: v }))} options={availablePrinters} onTest={handleTestLabel} onDemo={() => setShowLabelDemo(true)} />
                                                            <PrinterSelector label="Receipt Printer" value={printerConfig.receiptPrinter} onChange={(v) => setPrinterConfig(p => ({ ...p, receiptPrinter: v }))} options={availablePrinters} onTest={handleTestReceipt} />
                                                            <PrinterSelector label="Document Printer" value={printerConfig.waybillPrinter} onChange={(v) => setPrinterConfig(p => ({ ...p, waybillPrinter: v }))} options={availablePrinters} onTest={handleTestWaybill} />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex justify-end pt-2">
                                                    <button onClick={savePrinterConfig} disabled={isSavingPrinter !== 'idle'} className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${isSavingPrinter === 'saved' ? 'bg-green-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                                                        {isSavingPrinter === 'saving' ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isSavingPrinter === 'idle' ? 'Save Config' : isSavingPrinter === 'saving' ? 'Saving...' : 'Saved!'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ... (Existing Settings: Core Data, General Config, GAS, WP, Camera) ... */}
                                        {/* --- CORE DATA SOURCE --- */}
                                        {/* ... (Existing Settings: GAS, WP, Camera) ... */}
                                        {/* CORE & GENERAL CONFIG MOVED TO DATA SOURCES */}
                                        {/* REMOTE RESOURCES REMOVED */}
                                        <div><h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Cloud className="w-5 h-5 text-green-400" /> Google Apps Script</h3><div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 space-y-4"><div className="flex gap-4"><input type="text" value={googleScriptUrl} onChange={(e) => setGoogleScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." className="flex-1 bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white font-mono" /><button onClick={saveGasConfig} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">{isGasSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} Save</button></div><p className="text-xs text-gray-500">Deployment URL for Order Sync & Inventory Updates.</p></div></div>
                                        <div><h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-400" /> WordPress Integration</h3><div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs text-gray-400 block mb-1">Site URL</label><input type="text" value={wpConfig.url} onChange={e => setWpConfig(p => ({ ...p, url: e.target.value }))} className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white" /></div><div><label className="text-xs text-gray-400 block mb-1">Username</label><input type="text" value={wpConfig.username} onChange={e => setWpConfig(p => ({ ...p, username: e.target.value }))} className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white" /></div><div className="md:col-span-2"><label className="text-xs text-gray-400 block mb-1">App Password</label><input type="password" value={wpConfig.appPassword} onChange={e => setWpConfig(p => ({ ...p, appPassword: e.target.value }))} className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white font-mono" /></div></div><button onClick={saveWpConfig} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">Save WordPress Config</button></div></div>
                                        <div><h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-red-400" /> Camera Configuration</h3><div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 space-y-4"><div className="flex flex-col md:flex-row gap-6"><div className="flex-1 space-y-4"><div className="flex gap-2"><select value={selectedCameraId} onChange={(e) => saveCameraSelection(e.target.value)} disabled={isCameraLocked} className={`flex-1 bg-gray-900 border border-dark-border rounded-lg px-3 py-2 text-white text-sm ${isCameraLocked ? 'opacity-50 cursor-not-allowed' : ''}`}><option value="">-- Default --</option>{cameraDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select><button onClick={toggleCameraLock} className={`px-3 rounded-lg border flex items-center justify-center ${isCameraLocked ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`} title={isCameraLocked ? "Unlock Selection" : "Lock Selection"}>{isCameraLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</button></div><button onClick={toggleCameraPreview} className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-gray-300">{cameraPreviewStream ? 'Stop Preview' : 'Test Camera'}</button><button onClick={refreshCameraDevices} className="text-xs text-gemini-400 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Detect Devices</button></div><div className="w-full md:w-64 h-48 bg-black rounded-lg border border-dark-border flex items-center justify-center overflow-hidden">{cameraPreviewStream ? <video ref={cameraPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" /> : <div className="text-center text-gray-600"><Camera className="w-8 h-8 mx-auto mb-2 opacity-20" /><span className="text-xs">Preview Off</span></div>}</div></div></div></div>

                                        {/* --- STARTUP LOCK CONTROL --- */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                                <Lock className="w-5 h-5 text-gemini-400" /> Startup Lock Control
                                            </h3>
                                            <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-white">Enable Startup Password</p>
                                                        <p className="text-xs text-gray-500 mt-1">If enabled, the app will require a password on every launch/refresh.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsVerifyingLockAction(loginConfig.isEnabled ? 'disable' : 'enable')}
                                                        className={`w-12 h-6 rounded-full flex items-center transition-colors ${loginConfig.isEnabled ? 'bg-gemini-600 justify-end pr-0.5' : 'bg-gray-700 justify-start pl-0.5'}`}
                                                    >
                                                        <div className="w-5 h-5 bg-white rounded-full shadow-sm"></div>
                                                    </button>
                                                </div>

                                                <div className="pt-4 border-t border-white/5">
                                                    <p className="text-sm font-medium text-white mb-3">Change Startup Password</p>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="password"
                                                            placeholder="Enter New Password"
                                                            className="flex-1 bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-gemini-500 outline-none"
                                                            id="new_startup_password"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const val = (document.getElementById('new_startup_password') as HTMLInputElement).value;
                                                                if (val) {
                                                                    const promptPass = prompt("Please enter the CURRENT password to confirm change:");
                                                                    if (promptPass === loginConfig.password) {
                                                                        handleChangeStartupPassword(val);
                                                                        (document.getElementById('new_startup_password') as HTMLInputElement).value = '';
                                                                    } else {
                                                                        alert("Invalid current password. Change aborted.");
                                                                    }
                                                                }
                                                            }}
                                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-bold flex items-center gap-2"
                                                        >
                                                            <Edit3 className="w-4 h-4" /> Update
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* --- MENU VISIBILITY CONTROL --- */}

                                        <div className="mt-8 pt-8 border-t border-dark-border">
                                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                                <Shield className="w-5 h-5 text-red-400" /> Admin Access Control
                                            </h3>

                                            {!isAdminUnlocked ? (
                                                <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 flex flex-col gap-4">
                                                    <p className="text-sm text-gray-400">Unlock this section to show/hide main menu items.</p>
                                                    {!showPasswordPrompt ? (
                                                        <button onClick={() => setShowPasswordPrompt(true)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white font-bold w-fit flex items-center gap-2">
                                                            <Unlock className="w-4 h-4" /> Unlock Configuration
                                                        </button>
                                                    ) : (
                                                        <div className="flex gap-2 items-center">
                                                            <input
                                                                type="password"
                                                                value={passwordInput}
                                                                onChange={(e) => setPasswordInput(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleUnlockAdmin()}
                                                                className="bg-dark-surface border border-dark-border rounded px-3 py-2 text-white outline-none focus:border-red-500"
                                                                placeholder="Enter Password"
                                                                autoFocus
                                                            />
                                                            <button onClick={handleUnlockAdmin} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-bold">
                                                                Verify
                                                            </button>
                                                            <button onClick={() => { setShowPasswordPrompt(false); setPasswordInput(''); }} className="px-4 py-2 text-gray-400 hover:text-white">
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bg-dark-bg/50 rounded-xl border border-dark-border p-6 animate-in fade-in">
                                                    <div className="flex justify-between items-center mb-6">
                                                        <span className="font-bold text-white flex items-center gap-2"><Menu className="w-4 h-4" /> Menu Visibility</span>
                                                        <button onClick={() => setIsAdminUnlocked(false)} className="px-3 py-1 bg-red-900/30 text-red-300 rounded border border-red-800 text-xs font-bold hover:bg-red-900/50">Lock Admin</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                        {SIDEBAR_CONFIG.filter(item => item.id !== AppView.SETTINGS).map(item => (
                                                            <label key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${visibleViews[item.id] !== false ? 'bg-green-900/10 border-green-500/30' : 'bg-dark-surface border-dark-border opacity-60'}`}>
                                                                <div className={`w-10 h-6 rounded-full relative transition-colors ${visibleViews[item.id] !== false ? 'bg-green-500' : 'bg-gray-600'}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={visibleViews[item.id] !== false}
                                                                        onChange={() => toggleViewVisibility(item.id)}
                                                                        className="sr-only"
                                                                    />
                                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${visibleViews[item.id] !== false ? 'left-5' : 'left-1'}`}></div>
                                                                </div>
                                                                <span className="text-sm font-medium text-white">{item.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}


                    </Suspense>
                </div>
                <input type="file" ref={fallbackFileInputRef} className="hidden" accept=".csv" onChange={handleFallbackFileChange} />
            </main>

            {/* --- STARTUP LOCK OVERLAY --- */}
            {isAppLocked && (
                <div className="fixed inset-0 z-[999] bg-[#050b14] flex items-center justify-center p-4">
                    <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-dark-border flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-gemini-500/10 rounded-2xl flex items-center justify-center border border-gemini-500/30">
                            <Lock className="w-8 h-8 text-gemini-500" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">IMS Pro - Secure Access</h2>
                            <p className="text-gray-400 text-sm">Please enter the security password to continue.</p>
                        </div>

                        <div className="w-full space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                <input
                                    type="password"
                                    value={startupPasswordInput}
                                    onChange={(e) => setStartupPasswordInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyStartup()}
                                    placeholder="Enter Password"
                                    className="w-full bg-dark-bg border border-dark-border rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-gemini-500 transition-colors"
                                    autoFocus
                                />
                            </div>

                            {loginError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-400">{loginError}</p>
                                </div>
                            )}

                            <button
                                onClick={handleVerifyStartup}
                                className="w-full py-3 bg-gemini-600 hover:bg-gemini-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-gemini-600/20 active:scale-95"
                            >
                                Unlock System
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="w-full text-gray-500 hover:text-white text-sm transition-colors"
                            >
                                Refresh Page
                            </button>
                        </div>

                        <div className="pt-4 border-t border-white/5 w-full text-center">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest">Authorized Personnel Only</p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VERIFICATION MODAL FOR SETTINGS --- */}
            {isVerifyingLockAction && (
                <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4 text-orange-400">
                            <Shield className="w-6 h-6" />
                            <h3 className="font-bold">Security Verification</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">Changing the startup lock setting requires the current password.</p>

                        <div className="space-y-4">
                            <input
                                type="password"
                                value={verificationPassword}
                                onChange={(e) => setVerificationPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmLoginSecurityAction()}
                                placeholder="Current Password"
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button onClick={handleConfirmLoginSecurityAction} className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-sm">Verify Change</button>
                                <button onClick={() => { setIsVerifyingLockAction(null); setVerificationPassword(''); }} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

// Wrap App with ToastProvider for global toast notifications
const AppWithToast = () => (
    <ToastProvider>
        <App />
    </ToastProvider>
);

export default AppWithToast;
