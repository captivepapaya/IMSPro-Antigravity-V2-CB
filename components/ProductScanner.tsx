
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Camera, Video, X, PauseCircle, CheckCircle, Printer, ScanBarcode,
    Search, Image, Edit, Plus, Minus, RefreshCcw, Trash2, ChevronLeft,
    ChevronRight, Box, User, Pause, Check, Hash, Grid, Scan,
    ArrowUp, ArrowDown, ArrowLeft, Loader2, Keyboard, FlipHorizontal, Delete
} from 'lucide-react';
import { AlphanumericKeypad } from './AlphanumericKeypad';
import {
    CsvFile, WordPressConfig, OrderState, AppMode, PrinterConfig,
    InventoryItem, CartItem, OrderHeader, OrderItem, OrderMedia
} from '../types';
import {
    saveOrderMedia, getSetting, saveSetting as saveDbSetting,
    saveOrderToSupabase
} from '../services/db';
import { getMelbourneIdPrefix, getMelbourneTimeString } from '../services/dateService';
import { fetchWpImage } from '../services/wpService';
import { processRawData } from '../services/dataProcessor';
import { generalConfigService } from '../services/generalConfigService';
import { printOrderReceipt } from '../services/printService';
import {
    GENERAL_PRODUCT_NAMES, GENERAL_PRODUCT_MAPPING, getGeneralProductIcon
} from '../utils/assetLoader';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// --- Icons Mapping for Compatibility ---
const Icons = {
    Grid: Grid,
    Scan: Scan,
    Search: Search,
    Refresh: RefreshCcw,
    Image: Image,
    Edit: Edit,
    Minus: Minus,
    Plus: Plus,
    Left: ChevronLeft,
    Right: ChevronRight,
    Box: Box,
    User: User,
    Pause: Pause,
    Check: Check,
    Hash: Hash,
    Trash: Trash2,
    Back: ArrowLeft,
    Loading: Loader2,
    ArrowUp: ArrowUp,
    ArrowDown: ArrowDown
};

// --- Types ---
// Updated to include 'search' as a distinct mode
export type ExtendedScanMode = 'gun' | 'general' | 'search';

export interface ProductScannerProps {
    files: CsvFile[];
    wpConfig: WordPressConfig;
    order: OrderState;
    onUpdateOrder: React.Dispatch<React.SetStateAction<OrderState>>;
    selectedCameraId?: string;
    appMode: AppMode;
    isGeneralReady: boolean;
    printerConfig: PrinterConfig;
    enableLocalPrint: boolean;
}

// --- Helper Components ---

const HideSpinnersStyle = () => (
    <style>{`
    input[type=number]::-webkit-inner-spin-button, 
    input[type=number]::-webkit-outer-spin-button { 
      -webkit-appearance: none; 
      margin: 0; 
    }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
  `}</style>
);

const CartItemThumbnail = ({ sku, code, wpConfig, isGeneral, generalName }: { sku: string, code: string, wpConfig: WordPressConfig, isGeneral?: boolean, generalName?: string }) => {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (isGeneral && generalName) {
            const icon = getGeneralProductIcon(generalName);
            if (icon) {
                setSrc(icon);
                return;
            }
        }

        if (wpConfig.url && sku) {
            fetchWpImage(sku, wpConfig).then(url => {
                if (isMounted && url) setSrc(url);
            });
        }
        return () => { isMounted = false; };
    }, [sku, code, wpConfig, isGeneral, generalName]);

    if (!src) return <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500"><Icons.Box className="w-4 h-4" /></div>;
    return <img src={src} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
};

interface KeypadProps {
    type: string;
    triggerRect: DOMRect;
    onClose: () => void;
    onConfirm: (val: number) => void;
    isPriceInput?: boolean;
    currentValue?: number;
    align?: 'left' | 'center' | 'right';
    isHorizontal?: boolean;
}

// --- REPLACED: Large 3x5 Modal Keypad ---
const NumberKeypad: React.FC<KeypadProps> = ({ type, onClose, onConfirm, isPriceInput = false, currentValue }) => {
    const [val, setVal] = useState<string>('');

    useEffect(() => {
        if (currentValue !== undefined && currentValue !== null) {
            setVal(String(currentValue));
        }
    }, [currentValue]);

    const handlePress = (k: string) => {
        if (k === 'C') { setVal(''); return; }
        if (k === 'back') { setVal(v => v.length > 0 ? v.slice(0, -1) : ''); return; }
        if (k === '.') { if (!val.includes('.')) setVal(v => (v === '' ? '0' : v) + '.'); return; }
        if (k === 'OK') {
            const num = val === '' ? 0 : parseFloat(val);
            if (!isNaN(num)) onConfirm(num);
            onClose();
            return;
        }
        setVal(v => (v === '0' ? k : v + k));
    };

    // 3 Rows x 5 Columns Layout
    // Row 1: 1 2 3 4 5
    // Row 2: 6 7 8 9 0
    // Row 3: . C Back .95 OK
    const keys = [
        ['1', '2', '3', '4', '5'],
        ['6', '7', '8', '9', '0'],
        ['.', 'C', 'back', '.95', 'OK']
    ];

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100" onClick={onClose}>
            {/* Keypad Container - 2/3 Screen Width (max-w-4xl), floating over interface */}
            <div
                className="bg-dark-surface border border-gray-600 shadow-2xl rounded-2xl p-6 w-full max-w-4xl flex flex-col gap-4 relative"
                onClick={e => e.stopPropagation()}
                style={{ height: '60vh' }}
            >
                {/* Header / Value Display */}
                <div className="flex justify-between items-center bg-black/60 p-4 rounded-xl border border-gray-700 h-24">
                    <div className="text-xl text-gray-400 font-bold uppercase tracking-widest pl-2">
                        {type === 'price_override' ? 'Set Price' : type === 'item_disc' ? 'Discount %' : type === 'sys_pct' ? 'System Discount %' : 'Enter Value'}
                    </div>
                    <div className="text-6xl font-mono text-white font-bold tracking-tighter">
                        {val || '0'}{isPriceInput && !val.includes('.') && val !== '' ? '' : ''}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 grid grid-cols-5 gap-3">
                    {keys.flat().map((k) => (
                        <button
                            key={k}
                            onClick={() => {
                                if (k === '.95') { if (!val.includes('.')) setVal(v => (v === '' ? '0' : v) + '.95'); }
                                else handlePress(k);
                            }}
                            className={`rounded-xl text-4xl font-bold transition-all active:scale-95 flex items-center justify-center shadow-lg
                                ${k === 'OK' ? 'bg-green-600 hover:bg-green-500 text-white' :
                                    k === 'back' ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-900' :
                                        k === 'C' ? 'bg-orange-900/40 hover:bg-orange-900/60 text-orange-400 border border-orange-900' :
                                            k === '.95' ? 'bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 border border-blue-900' :
                                                'bg-gray-800 hover:bg-gray-700 text-white border border-gray-600'
                                }`}
                        >
                            {k === 'back' ? '⌫' : k}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Cash Payment Keypad Component
const CashPaymentKeypad = ({
    amountDue,
    onClose,
    onConfirm
}: {
    amountDue: number,
    onClose: () => void,
    onConfirm: (received: number, change: number) => void
}) => {
    const [input, setInput] = useState('');
    const received = parseFloat(input) || 0;
    const change = Math.max(0, received - amountDue);

    const handlePress = (key: string) => {
        if (key === 'C') {
            setInput('');
        } else if (key === '←') {
            setInput(input.slice(0, -1));
        } else if (key === '✓') {
            if (received >= amountDue) {
                onConfirm(received, change);
            }
        } else {
            setInput(input + key);
        }
    };

    const keys = [
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
        ['C', '0', '.'],
        ['←', '✓']
    ];

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-dark-surface border-2 border-gemini-500 rounded-2xl p-6 shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-white mb-2">Cash Payment</h3>
                    <div className="text-sm text-gray-400">Enter amount received</div>
                </div>

                {/* Display */}
                <div className="bg-black/50 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Amount Due:</span>
                        <span className="text-white font-mono text-lg">${amountDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Cash Received:</span>
                        <span className="text-gemini-400 font-mono text-2xl font-bold">
                            ${input || '0.00'}
                        </span>
                    </div>
                    <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Change:</span>
                        <span className={`font-mono text-xl font-bold ${change > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                            ${change.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Keypad */}
                <div className="grid gap-2 mb-4">
                    {keys.map((row, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2">
                            {row.map(k => (
                                <button
                                    key={k}
                                    onClick={() => handlePress(k)}
                                    disabled={k === '✓' && received < amountDue}
                                    className={`
                                        h-14 rounded-lg font-bold text-lg transition-all active:scale-95
                                        ${k === '✓'
                                            ? (received >= amountDue
                                                ? 'bg-green-600 hover:bg-green-500 text-white col-span-2'
                                                : 'bg-gray-800 text-gray-600 cursor-not-allowed col-span-2')
                                            : k === 'C'
                                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                                : k === '←'
                                                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                                                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                                        }
                                    `}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Cancel Button */}
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

const CaptureModal = ({
    type,
    onClose,
    deviceId,
    orderId,
    onBarcodeDetect
}: {
    type: 'camera' | 'video' | 'barcode',
    onClose: () => void,
    deviceId: string,
    orderId: string,
    onBarcodeDetect?: (code: string) => void
}) => {
    // --- VIDEO RECORDING STATE ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [sessionCount, setSessionCount] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- BARCODE SCANNER STATE ---
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [isScannerRunning, setIsScannerRunning] = useState(false);

    // --- UI STATE ---
    const [isMirrored, setIsMirrored] = useState(false);

    useEffect(() => {
        // Mode 1: Barcode Scanning (Html5Qrcode)
        if (type === 'barcode') {
            const startScanner = async () => {
                // Ensure container is present
                const container = document.getElementById("reader");
                if (!container) return;

                const html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;

                try {
                    await html5QrCode.start(
                        deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.777778
                        },
                        (decodedText) => {
                            // Success callback
                            if (onBarcodeDetect) {
                                onBarcodeDetect(decodedText);
                                onClose(); // Close on success
                            }
                        },
                        (errorMessage) => {
                            // ignore parse errors
                        }
                    );
                    setIsScannerRunning(true);
                } catch (err) {
                    console.error("Failed to start barcode scanner", err);
                    alert("Failed to start camera for scanning.");
                    onClose();
                }
            };
            // Small delay to allow DOM render
            setTimeout(startScanner, 100);
        }
        // Mode 2: Media Capture (Manual getUserMedia)
        else {
            const initMedia = async () => {
                const videoConstraints = {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1280 }, // 720p Preference
                    height: { ideal: 720 }
                };

                try {
                    let s: MediaStream;
                    try {
                        s = await navigator.mediaDevices.getUserMedia({
                            video: videoConstraints,
                            audio: type === 'video'
                        });
                    } catch (firstErr) {
                        if (type === 'video') {
                            console.warn("Failed to get audio+video, falling back to video only.", firstErr);
                            s = await navigator.mediaDevices.getUserMedia({
                                video: videoConstraints,
                                audio: false
                            });
                        } else {
                            throw firstErr;
                        }
                    }

                    setStream(s);
                    streamRef.current = s;
                    if (videoRef.current) {
                        videoRef.current.srcObject = s;
                    }
                } catch (e) {
                    console.error("Capture Modal Init Error", e);
                    alert("Failed to access camera.");
                    onClose();
                }
            };
            initMedia();
        }

        // Cleanup Function
        return () => {
            // Stop Barcode Scanner
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => console.error("Stop failed", err));
            }
            // Stop Media Stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [type, deviceId]);

    const handlePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Handle mirroring in the capture logic if needed, but usually photo capture shouldn't be mirrored unless intended.
            // If the user sees a mirrored preview, they might expect a mirrored photo.
            // For now, we capture raw feed.
            if (isMirrored) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(videoRef.current, 0, 0);

            canvas.toBlob(async (blob) => {
                if (blob) {
                    await saveOrderMedia({
                        orderId,
                        type: 'image',
                        blob: blob,
                        timestamp: Date.now()
                    });
                    setSessionCount(p => p + 1);
                }
            }, 'image/jpeg', 0.8);
        }
    };

    const startRecording = () => {
        if (!stream) return;
        chunksRef.current = [];
        let options: MediaRecorderOptions = { mimeType: 'video/webm' };
        if (!MediaRecorder.isTypeSupported('video/webm')) {
            options = {};
        }

        try {
            const recorder = new MediaRecorder(stream, options);
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                await saveOrderMedia({
                    orderId,
                    type: 'video',
                    blob: blob,
                    timestamp: Date.now()
                });
                setSessionCount(p => p + 1);
                setIsRecording(false);
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            timerRef.current = setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    stopRecording();
                    alert("Maximum recording time (5 mins) reached.");
                }
            }, 5 * 60 * 1000);
        } catch (e) {
            console.error("MediaRecorder Start Error", e);
            alert("Failed to start recording.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            if (timerRef.current) clearTimeout(timerRef.current);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-4 shadow-2xl relative flex flex-col items-center gap-4 max-w-4xl w-full">
                <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-gray-800 shadow-inner flex items-center justify-center group">

                    {/* Mode 1: Barcode Scanner */}
                    {type === 'barcode' && (
                        <div
                            id="reader"
                            className="w-full h-full"
                            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                        ></div>
                    )}

                    {/* Mode 2: Photo/Video */}
                    {type !== 'barcode' && (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-contain"
                            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                        />
                    )}

                    {/* --- CONTROLS OVERLAY (TOP RIGHT) --- */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                        {/* Session Count Badge */}
                        {type !== 'barcode' && (
                            <div className="bg-black/50 px-3 py-1.5 rounded-lg text-xs text-white font-mono border border-white/10 backdrop-blur-md self-end">
                                Captured: {sessionCount}
                            </div>
                        )}

                        {/* Mirror Toggle Button */}
                        <button
                            onClick={() => setIsMirrored(!isMirrored)}
                            className={`p-2 rounded-lg border backdrop-blur-md transition-all self-end ${isMirrored ? 'bg-blue-600/80 border-blue-500 text-white' : 'bg-black/50 border-white/10 text-gray-300 hover:text-white'}`}
                            title="Mirror Camera"
                        >
                            <FlipHorizontal className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Recording Indicator */}
                    {type === 'video' && isRecording && (
                        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-900/50 px-3 py-1.5 rounded-lg backdrop-blur-md border border-red-500/30 z-20">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-white font-bold uppercase tracking-widest drop-shadow">REC</span>
                        </div>
                    )}
                </div>

                <div className="w-full flex items-center justify-between px-4 pb-2">
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                        {type === 'camera' && <><Camera className="w-5 h-5" /> Photo Mode</>}
                        {type === 'video' && <><Video className="w-5 h-5" /> Video Mode</>}
                        {type === 'barcode' && <><ScanBarcode className="w-5 h-5 text-green-400" /> Scanning...</>}
                    </div>

                    <div className="flex gap-6 items-center">
                        {type === 'camera' ? (
                            <button onClick={handlePhoto} className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all shadow-lg hover:shadow-xl hover:border-white/50">
                                <div className="w-12 h-12 bg-white rounded-full shadow-inner"></div>
                            </button>
                        ) : type === 'video' ? (
                            isRecording ? (
                                <button onClick={stopRecording} className="w-16 h-16 rounded-full border-4 border-red-500/30 flex items-center justify-center hover:bg-red-900/20 active:scale-95 transition-all shadow-lg shadow-red-900/20">
                                    <div className="w-8 h-8 bg-red-500 rounded-sm shadow-inner"></div>
                                </button>
                            ) : (
                                <button onClick={startRecording} className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all shadow-lg">
                                    <div className="w-12 h-12 bg-red-600 rounded-full border-2 border-transparent shadow-inner"></div>
                                </button>
                            )
                        ) : (
                            // Barcode Mode: No Button needed, auto-scan
                            <div className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">Point at Barcode</div>
                        )}
                    </div>

                    <button onClick={onClose} className="p-3 text-gray-400 hover:text-white bg-gray-800 rounded-full hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ProductScanner: React.FC<ProductScannerProps> = ({
    files, wpConfig, order, onUpdateOrder, selectedCameraId,
    appMode, isGeneralReady = true, printerConfig, enableLocalPrint
}) => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [scanMode, setScanMode] = useState<ExtendedScanMode>('general'); // Default

    // Input States
    const [searchInput, setSearchInput] = useState(''); // Text Search
    const [scanInput, setScanInput] = useState(''); // Barcode Gun input

    const [scannedProduct, setScannedProduct] = useState<InventoryItem | null>(null);
    const [suggestions, setSuggestions] = useState<InventoryItem[]>([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [activeImage, setActiveImage] = useState<string | null>(null);
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [inputQty, setInputQty] = useState<number>(1);
    const [isVirtualKeypadEnabled, setIsVirtualKeypadEnabled] = useState(true);
    const [showAlphaKeyboard, setShowAlphaKeyboard] = useState(false);
    const [activeKeypad, setActiveKeypad] = useState<any>(null);
    const [isProcessingPay, setIsProcessingPay] = useState(false);

    // Cash Payment State
    const [showCashKeypad, setShowCashKeypad] = useState(false);
    const [cashReceived, setCashReceived] = useState(0);

    // Capture Modal State (Reused for Camera Scan)
    const [captureModal, setCaptureModal] = useState<{ isOpen: boolean; type: 'camera' | 'video' | 'barcode' }>({ isOpen: false, type: 'camera' });

    // Modal State
    const [completedOrderModal, setCompletedOrderModal] = useState<{ id: string, total: number, header: OrderHeader, items: OrderItem[], status: 'Completed' | 'Hold' } | null>(null);

    // Idempotency Check
    const isOrderSavedRef = useRef(false);

    // Reset saved flag when orderId changes (New Order)
    useEffect(() => {
        isOrderSavedRef.current = false;
    }, [order.orderId]);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const scanInputRef = useRef<HTMLInputElement>(null); // Ref for Barcode Gun Input

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const suggestionsListRef = useRef<HTMLDivElement>(null);
    const gnCountersRef = useRef<Record<string, number>>({});
    const generalScrollRef = useRef<HTMLDivElement>(null);

    const [genFilter, setGenFilter] = useState<'GN' | 'ALL' | string>('ALL');
    const [genSelection, setGenSelection] = useState<string>('');

    const orderRef = useRef(order);
    useEffect(() => { orderRef.current = order; }, [order]);

    const [generalImageVersion, setGeneralImageVersion] = useState(0);
    useEffect(() => { const interval = setInterval(() => setGeneralImageVersion(v => v + 1), 2000); return () => clearInterval(interval); }, []);

    const generalProducts = useMemo(() => GENERAL_PRODUCT_NAMES.map(name => ({ name, displayName: name, src: getGeneralProductIcon(name) })), [generalImageVersion]);
    useEffect(() => { if (files.length > 0) setInventory(processRawData(files)); }, [files]);

    useEffect(() => {
        audioRef.current = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');
        const loadSettings = async () => {
            const savedPref = await getSetting('pos_camera_preference');
            if (savedPref && savedPref.mode && savedPref.mode !== 'manual_save') {
                // Map legacy modes if needed or trust saved
                if (['general', 'gun', 'search'].includes(savedPref.mode)) {
                    setScanMode(savedPref.mode as ExtendedScanMode);
                }
            }
            else {
                const savedMode = localStorage.getItem('pos_scan_mode');
                if (savedMode && ['general', 'gun', 'search'].includes(savedMode)) {
                    setScanMode(savedMode as ExtendedScanMode);
                }
            }
        };
        loadSettings();
    }, []);

    const CUSTOM_GENERAL_ORDER = [
        "Bouquet", "Arrangement",
        "Garland", "Flower",
        "Basket", "Leaves",
        "Hanging", "HPot",
        "Bush", "Pot",
        "Branch", "Spray",
        "Succulent", "Tree",
        "Other", "Grass",
        "Mat", "Moss",
        "Fruit", "Foam",
        "Gift", "Freight"
    ];

    // Search Suggestions Logic (Text Input)
    useEffect(() => {
        if (!searchInput || searchInput.length < 2) { setSuggestions([]); setIsSuggestionsOpen(false); return; }
        const lower = searchInput.toLowerCase();

        // Updated Logic: Include SKU and Barcode
        const matches = inventory.filter(i =>
            (i.Description && i.Description.toLowerCase().includes(lower)) ||
            (i.Code && i.Code.toLowerCase().includes(lower)) ||
            (i.SKU && i.SKU.toLowerCase().includes(lower)) ||
            (i.Barcode && i.Barcode.toLowerCase().includes(lower))
        ).slice(0, 50);

        if (matches.length > 0) { setSuggestions(matches); setIsSuggestionsOpen(true); } else { setSuggestions([]); setIsSuggestionsOpen(false); }
    }, [searchInput, inventory]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => (p < suggestions.length - 1 ? p + 1 : p)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => (p > 0 ? p - 1 : -1)); }
        else if (e.key === 'Enter') {
            if (isSuggestionsOpen && selectedIndex >= 0) { e.preventDefault(); setScannedProduct(suggestions[selectedIndex]); setInputQty(1); setSearchInput(''); setSuggestions([]); setIsSuggestionsOpen(false); }
            else { /* Manual Search Enter */ }
        } else if (e.key === 'Escape') { setIsSuggestionsOpen(false); }
    };

    // Barcode Gun Logic
    const handleScanEnter = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBarcodeScan(scanInput);
        }
    };

    useEffect(() => { if (selectedIndex >= 0 && suggestionsListRef.current) { const el = suggestionsListRef.current.children[selectedIndex] as HTMLElement; if (el) el.scrollIntoView({ block: 'nearest' }); } }, [selectedIndex]);

    useEffect(() => {
        if (scannedProduct) {
            if (activeImage && (activeImage.includes(scannedProduct.SKU) || activeImage.includes(scannedProduct.Code))) { /* skip */ } else {
                setIsLoadingImage(true);
                const identifier = scannedProduct.SKU || scannedProduct.Code;
                if (wpConfig.url) { fetchWpImage(identifier, wpConfig).then(u => { if (u) setActiveImage(u); else setActiveImage(null); setIsLoadingImage(false); }); } else { setActiveImage(null); setIsLoadingImage(false); }
            }
        } else { setActiveImage(null); }
    }, [scannedProduct]);

    const changeScanMode = async (mode: ExtendedScanMode) => {
        setScannedProduct(null); setSearchInput(''); setSuggestions([]);
        setShowAlphaKeyboard(false);
        setScanMode(mode);
        localStorage.setItem('pos_scan_mode', mode);
        saveDbSetting('pos_camera_preference', { mode: mode, deviceId: selectedCameraId }).catch(console.error);
    };

    const addToCart = (item: InventoryItem, qty: number = 1, priceOverride?: number) => {
        onUpdateOrder(prev => {
            const listPrice = priceOverride !== undefined ? priceOverride : item.ListPrice;

            if (item.Category === 'General') {
                const code = item.Code;
                if (genSelection) {
                    const newItem: CartItem = {
                        ...item, ListPrice: listPrice, quantity: qty, cartId: Math.random().toString(36),
                        discountType: null, discountValue: 0, imageUrl: null, isGeneralProduct: true,
                        gnIndexLetter: genSelection
                    };
                    return { ...prev, items: [newItem, ...prev.items] };
                }
                else {
                    const currentCount = gnCountersRef.current[code] || 0;
                    const nextLetter = String.fromCharCode(65 + currentCount);
                    gnCountersRef.current[code] = currentCount + 1;
                    const newItem: CartItem = {
                        ...item, ListPrice: listPrice, quantity: qty, cartId: Math.random().toString(36),
                        discountType: null, discountValue: 0, imageUrl: null, isGeneralProduct: true,
                        gnIndexLetter: nextLetter
                    };
                    return { ...prev, items: [newItem, ...prev.items] };
                }
            } else {
                const idx = prev.items.findIndex(i => i.Code === item.Code && !i.isGeneralProduct);
                if (idx >= 0) { const copy = [...prev.items]; copy[idx].quantity = qty; return { ...prev, items: copy }; }
                const newItem: CartItem = { ...item, quantity: qty, cartId: Math.random().toString(36), discountType: null, discountValue: 0, imageUrl: null };
                return { ...prev, items: [newItem, ...prev.items] };
            }
        });
        setScannedProduct({ ...item, ListPrice: priceOverride !== undefined ? priceOverride : item.ListPrice });
        setInputQty(1);
        setGenFilter('ALL');
        setGenSelection('');
    };

    const scanToCart = (item: InventoryItem) => {
        onUpdateOrder(prev => {
            if (item.Category === 'General') return prev;
            const idx = prev.items.findIndex(i => i.Code === item.Code && !i.isGeneralProduct);
            if (idx >= 0) { const copy = [...prev.items]; copy[idx].quantity += 1; return { ...prev, items: copy }; }
            const newItem: CartItem = { ...item, quantity: 1, cartId: Math.random().toString(36), discountType: null, discountValue: 0, imageUrl: null };
            return { ...prev, items: [newItem, ...prev.items] };
        });
        setScannedProduct(item);
    };

    // Centralized Barcode Logic (Used by Scan Input & Camera)
    const handleBarcodeScan = (code: string) => {
        if (!code.trim()) return;
        const clean = code.trim().toLowerCase();

        const found = inventory.find(i => String(i.Barcode).toLowerCase() === clean || String(i.SKU).toLowerCase() === clean || String(i.Code).toLowerCase() === clean);

        if (found) {
            scanToCart(found);
            audioRef.current?.play().catch(() => { });
            setScanInput('');
        } else {
            // Optional: Beep for not found?
        }
    };

    const selectGeneralProduct = (name: string) => {
        const mapping = GENERAL_PRODUCT_MAPPING[name];
        const code = mapping?.Code || `GN-${name.toUpperCase()}`;
        const dbItem = inventory.find(i => i.Code === code);
        const baseItem: InventoryItem = dbItem ? { ...dbItem } : {
            Code: code, SKU: mapping?.SKU || 'NOSKU', Description: `General ${name}`, ListPrice: 0, SalePrice: 0, Stock: 999, Sold: 0, HL: 0, Category: 'General', SubCat: 'General', StockStatus: 'Active', SU: 'GN', Barcode: '', NetCost: 0, DiscRate: 0, FinalCost: 0, Qty: 999, Location: '', Comment: '', RefPrice: 0, _id: Math.random()
        };
        if (mapping) baseItem.SKU = mapping.SKU;
        baseItem.Category = 'General';
        const icon = getGeneralProductIcon(name);
        if (icon) setActiveImage(icon);
        setScannedProduct(baseItem); setInputQty(1); setGenFilter('ALL'); setGenSelection('');
        if (baseItem.ListPrice === 0) setActiveKeypad({ type: 'price_override', isPriceInput: true, align: 'center' });
    };

    const selectProductFromCart = (item: CartItem) => { setScannedProduct(item); setInputQty(item.quantity); };
    const openKeypad = (e: React.MouseEvent, type: string, props: any = {}) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setActiveKeypad({ type, triggerRect: rect, ...props }); };

    const handleManualAdd = () => {
        if (scannedProduct) {
            addToCart(scannedProduct, inputQty, scannedProduct.ListPrice);
            setScannedProduct(null);
        }
    };
    const scrollGeneral = (dir: 1 | -1) => { if (generalScrollRef.current) generalScrollRef.current.scrollBy({ left: dir * 200, behavior: 'smooth' }); };

    const totals = useMemo(() => {
        let base = 0, std = 0, spec = 0, grand = 0;
        const processed = order.items.map(item => {
            const b = item.ListPrice * item.quantity; base += b;
            let f = b; if (item.discountType === 'percent') f -= b * (item.discountValue / 100); else if (item.discountType === 'amount') f -= item.discountValue; f = Math.max(0, f);
            if (item.discountType) spec += f; else std += f;
            return { ...item, baseTotal: b, finalLineTotal: f, hasSpecificDiscount: !!item.discountType, discountAmount: b - f };
        });
        if (order.finalPriceOverride !== null) grand = order.finalPriceOverride; else { let dStd = std; if (order.sysPercent > 0) dStd *= (1 - order.sysPercent / 100); if (order.sysAmount > 0) dStd = Math.max(0, dStd - order.sysAmount); grand = spec + dStd; }
        return { original: base, grand, discount: Math.max(0, base - grand), items: processed };
    }, [order]);

    const handleCashConfirm = async (received: number, change: number) => {
        setShowCashKeypad(false);
        setCashReceived(received);
        // Proceed with order completion, passing cash info
        await handleOrderAction('finish', received, change);
    };

    const handleOrderAction = async (action: 'finish' | 'hold', cashReceived?: number, cashChange?: number) => {
        if (order.items.length === 0) return;

        // For Cash payments on Finish, show cash keypad first (only if not already provided)
        if (action === 'finish' && order.paymentMethod === 'Cash' && !cashReceived) {
            setShowCashKeypad(true);
            return;
        }

        setIsProcessingPay(true);
        try {
            const timeStr = getMelbourneTimeString();
            const header: OrderHeader = {
                INDEX: order.orderId, TIME: timeStr, ID: order.customerId,
                REFTOTAL: totals.original, ALLDISC: totals.discount, NEEDTOPAY: totals.grand,
                PAIDBY: order.paymentMethod, PERCENT_DISC: order.sysPercent, DOLLAR_DISC: order.sysAmount,
                FINALSET: order.finalPriceOverride || 0, OSTATUS: action === 'hold' ? 'Hold' : 'Completed',
                IS_SYNCED: false, UUID: order.uuid, OTN: appMode
            };
            const items: OrderItem[] = totals.items.map((item, idx) => ({
                INDEX: order.orderId, TIME: timeStr, CODE: item.Code, SKU: item.SKU || 'NOSKU',
                GNINDEX: item.isGeneralProduct ? (item.gnIndexLetter || '') : '',
                QTY: item.quantity, PRICE: item.ListPrice,
                ITEMDISC: item.discountAmount,
                SUBTOTAL: item.finalLineTotal, UUID: order.uuid,
                DESC: item.Description
            }));

            // --- DATE CHECK & RESET LOGIC ---
            let finalOrderId = order.orderId;
            const todayPrefix = getMelbourneIdPrefix();
            if (!finalOrderId.startsWith(todayPrefix)) {
                // Detected rollover! Reset sequence.
                localStorage.setItem('pos_seq', '0');
                finalOrderId = `${todayPrefix}-001`;

                // Update local storage date tracking
                localStorage.setItem('pos_seq_date', todayPrefix);

                // Update header/items index
                header.INDEX = finalOrderId;
                items.forEach(i => i.INDEX = finalOrderId);

                console.log(`Date Check: Rollover detected. Resetting ID to ${finalOrderId}`);

                // Update local order state so UI reflects new ID
                onUpdateOrder(prev => ({ ...prev, orderId: finalOrderId }));
            }

            // --- IDEMPOTENCY CHECK ---
            if (isOrderSavedRef.current && action === 'finish') {
                console.log("Order previously saved. Retrying print/modal only.");
                if (enableLocalPrint && printerConfig?.receiptPrinter) {
                    await printOrderReceipt(printerConfig, header, items, cashReceived, cashChange);
                }
                setCompletedOrderModal({ id: order.orderId, total: totals.grand, header, items, status: 'Completed' });
                setIsProcessingPay(false);
                return;
            }

            // --- SAVE TO DB ---
            const dbSuccess = await saveOrderToSupabase(header, items);

            if (!dbSuccess) { alert("⚠️ CRITICAL: Cloud Save Failed."); setIsProcessingPay(false); return; }

            isOrderSavedRef.current = true;

            // --- UPDATE LOCAL CACHE WITH USED SEQUENCE ---
            // Only now do we "claim" the number in the local device cache
            const datePrefix = getMelbourneIdPrefix();
            const idParts = order.orderId.split('-');
            if (idParts.length === 2) {
                const usedSeq = parseInt(idParts[1]);
                if (!isNaN(usedSeq)) {
                    localStorage.setItem('pos_seq', usedSeq.toString());
                    localStorage.setItem('pos_seq_date', datePrefix);
                }
            }

            if (action === 'finish') {
                if (enableLocalPrint && printerConfig?.receiptPrinter) {
                    await printOrderReceipt(printerConfig, header, items, cashReceived, cashChange);
                }
                setCompletedOrderModal({ id: order.orderId, total: totals.grand, header, items, status: 'Completed' });
            } else {
                setCompletedOrderModal({ id: order.orderId, total: totals.grand, header, items, status: 'Hold' });
            }

        } catch (e) { console.error(e); alert("Error processing transaction"); } finally { setIsProcessingPay(false); }
    };

    const closeSuccessModal = async () => {
        const datePrefix = getMelbourneIdPrefix();
        const localSeq = parseInt(localStorage.getItem('pos_seq') || '0');
        const nextSeq = localSeq + 1;
        localStorage.setItem('pos_seq', nextSeq.toString());
        const nextId = `${datePrefix}-${String(nextSeq).padStart(3, '0')}`;

        onUpdateOrder({ uuid: crypto.randomUUID(), orderId: nextId, items: [], sysPercent: 0, sysAmount: 0, finalPriceOverride: null, customerId: 'DEFAULT', paymentMethod: 'Card' });
        setScannedProduct(null); gnCountersRef.current = {};
        setCompletedOrderModal(null);
    };

    const handleManualReprint = async () => {
        if (completedOrderModal && printerConfig?.receiptPrinter) {
            await printOrderReceipt(printerConfig, completedOrderModal.header, completedOrderModal.items);
        }
    };

    // Derived Options for General Products
    const genOptions = useMemo(() => {
        if (!scannedProduct || scannedProduct.Category !== 'General') return [];
        return generalConfigService.getOptions(scannedProduct.SKU, genFilter);
    }, [scannedProduct, genFilter]);

    const genUniqueLetters = useMemo(() => {
        if (!scannedProduct || scannedProduct.Category !== 'General') return [];
        return generalConfigService.getUniqueLetters(scannedProduct.SKU);
    }, [scannedProduct]);

    if (files.length === 0) return <div className="p-10 text-center text-gray-500">Please upload data first.</div>;

    return (
        <div className="h-full w-full flex gap-4 overflow-hidden flex-row relative" onClick={() => setActiveKeypad(null)}>
            <HideSpinnersStyle />

            {/* --- CAPTURE MODAL (FIXED POSITION) --- */}
            {captureModal.isOpen && (
                <CaptureModal
                    type={captureModal.type}
                    onClose={() => setCaptureModal({ isOpen: false, type: 'camera' })}
                    deviceId={selectedCameraId || ''}
                    orderId={order.orderId}
                    onBarcodeDetect={(code) => handleBarcodeScan(code)}
                />
            )}

            {/* --- CASH PAYMENT KEYPAD --- */}
            {showCashKeypad && (
                <CashPaymentKeypad
                    amountDue={totals.grand}
                    onClose={() => setShowCashKeypad(false)}
                    onConfirm={handleCashConfirm}
                />
            )}

            {/* --- SUCCESS / HOLD MODAL --- */}
            {completedOrderModal && (
                <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-dark-surface border border-green-500/30 rounded-2xl p-8 shadow-2xl max-w-md w-full text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse ${completedOrderModal.status === 'Hold' ? 'bg-orange-500/20' : 'bg-green-500/20'}`}>
                            {completedOrderModal.status === 'Hold' ? <PauseCircle className="w-10 h-10 text-orange-500" /> : <CheckCircle className="w-10 h-10 text-green-500" />}
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">{completedOrderModal.status === 'Hold' ? 'Order Held' : 'Order Completed!'}</h2>
                        <p className="text-gray-400 font-mono mb-8 text-lg">ID: {completedOrderModal.id}</p>

                        <div className="bg-black/40 rounded-xl p-6 mb-8 border border-white/5">
                            <div className="text-sm text-gray-500 uppercase font-bold mb-1">Total</div>
                            <div className="text-4xl font-bold text-white font-mono">${completedOrderModal.total.toFixed(2)}</div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {enableLocalPrint && printerConfig?.receiptPrinter && (
                                <button
                                    onClick={handleManualReprint}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl border border-blue-500 transition-colors flex items-center justify-center gap-2 mb-2"
                                >
                                    <Printer className="w-5 h-5" /> {completedOrderModal.status === 'Hold' ? 'Print Receipt (Optional)' : 'Reprint Receipt'}
                                </button>
                            )}

                            <button
                                onClick={closeSuccessModal}
                                className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-gray-700 transition-colors"
                            >
                                Start New Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GLOBAL KEYPAD RENDER */}
            {activeKeypad && (
                <NumberKeypad
                    {...activeKeypad}
                    onClose={() => setActiveKeypad(null)}
                    onConfirm={(v: number) => {
                        if (activeKeypad.type === 'price_override') setScannedProduct(p => p ? ({ ...p, ListPrice: v }) : null);
                        if (activeKeypad.type === 'sys_pct') onUpdateOrder(p => ({ ...p, sysPercent: v }));
                        if (activeKeypad.type === 'sys_amt') onUpdateOrder(p => ({ ...p, sysAmount: v }));
                        if (activeKeypad.type === 'sys_final') onUpdateOrder(p => ({ ...p, finalPriceOverride: v }));
                        if (activeKeypad.type === 'item_disc' || activeKeypad.type === 'item_amt') {
                            const isAmt = activeKeypad.type === 'item_amt';
                            onUpdateOrder(p => ({ ...p, items: p.items.map(i => i.cartId === activeKeypad.targetId ? { ...i, discountType: v ? (isAmt ? 'amount' : 'percent') : null, discountValue: v } : i) }));
                        }
                    }}
                />
            )}

            {appMode === 'Test' && (
                <div className="absolute top-0 left-0 right-0 bg-orange-600 text-white text-[10px] font-bold text-center z-[90] uppercase tracking-widest pointer-events-none opacity-80">
                    ⚠️ System in Test Mode - No Inventory Deduction ⚠️
                </div>
            )}

            {/* LEFT PANEL */}
            <div className="w-[30%] flex flex-col relative h-full pt-4">

                {/* Top Controls: 4 Distinct Buttons */}
                <div className="grid grid-cols-4 gap-1 mb-2 px-1">
                    {/* 1. General Product */}
                    <button
                        onClick={() => changeScanMode('general')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg border font-bold text-[10px] uppercase transition-all ${scanMode === 'general' ? 'bg-gemini-600 border-gemini-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'
                            }`}
                        title="General Products"
                    >
                        <Icons.Grid className="w-5 h-5" />
                    </button>

                    {/* 2. Infrared Scan (Gun) */}
                    <button
                        onClick={() => changeScanMode('gun')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg border font-bold text-[10px] uppercase transition-all ${scanMode === 'gun' ? 'bg-red-600 border-red-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'
                            }`}
                        title="Infrared Scan"
                    >
                        <ScanBarcode className="w-5 h-5" />
                    </button>

                    {/* 3. Fuzzy Search */}
                    <button
                        onClick={() => changeScanMode('search')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg border font-bold text-[10px] uppercase transition-all ${scanMode === 'search' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'
                            }`}
                        title="Search Name/Code"
                    >
                        <Search className="w-5 h-5" />
                    </button>

                    {/* 4. Camera Scan (Action) */}
                    <button
                        onClick={() => setCaptureModal({ isOpen: true, type: 'barcode' })}
                        className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg border border-gray-600 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white font-bold text-[10px] uppercase transition-all active:scale-95"
                        title="Camera Scan"
                    >
                        <Camera className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 bg-dark-bg border border-dark-border rounded-xl p-3 flex flex-col overflow-hidden relative">

                    {/* MODE 2: GUN SCAN (Barcode Input Only) */}
                    {scanMode === 'gun' && (
                        <div className="mb-4 animate-in fade-in slide-in-from-top-2">
                            <div className="h-14 bg-gray-900 border border-red-900/50 rounded-xl flex items-center px-3 focus-within:ring-1 focus-within:ring-red-500 shadow-inner">
                                <ScanBarcode className="w-6 h-6 text-red-500 mr-3 flex-shrink-0" />
                                <input
                                    ref={scanInputRef}
                                    value={scanInput}
                                    onChange={e => setScanInput(e.target.value)}
                                    onKeyDown={handleScanEnter}
                                    className="bg-transparent border-none outline-none text-white w-full placeholder-gray-600 font-mono text-lg"
                                    placeholder="Scan Barcode..."
                                    autoFocus
                                />
                            </div>
                            <div className="text-center mt-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                Ready for Infrared Scanner
                            </div>
                        </div>
                    )}

                    {/* MODE 3: SEARCH (Fuzzy Search Only) */}
                    {scanMode === 'search' && (
                        <div className="mb-4 relative animate-in fade-in slide-in-from-top-2">
                            <div className="h-14 bg-gray-800 border border-blue-900/50 rounded-xl flex items-center px-3 focus-within:ring-1 focus-within:ring-blue-500 shadow-inner">
                                <Keyboard className="w-6 h-6 text-blue-400 mr-3 flex-shrink-0" />
                                <input
                                    ref={searchInputRef}
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    readOnly={isVirtualKeypadEnabled} // Only read-only if virtual keypad is ON
                                    onClick={() => { if (isVirtualKeypadEnabled) setShowAlphaKeyboard(true); }}
                                    onKeyDown={!isVirtualKeypadEnabled ? handleKeyDown : undefined} // Allow manual native enter if keyboard disabled
                                    className={`bg-transparent border-none outline-none text-white w-full placeholder-gray-500 ${isVirtualKeypadEnabled ? 'cursor-pointer' : ''}`}
                                    placeholder={isVirtualKeypadEnabled ? "Tap to Search..." : "Type to Search..."}
                                />
                                {searchInput && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSearchInput('');
                                            if (isVirtualKeypadEnabled) {
                                                setShowAlphaKeyboard(true);
                                                searchInputRef?.current?.focus();
                                            } else {
                                                searchInputRef?.current?.focus();
                                            }
                                        }}
                                        className="p-1 hover:bg-gray-700 rounded-full text-gray-500 hover:text-white mr-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                                {/* Keypad Toggle Button */}
                                <button
                                    onClick={() => {
                                        setSearchInput('');
                                        setShowAlphaKeyboard(false);
                                        setIsVirtualKeypadEnabled(!isVirtualKeypadEnabled);
                                        // Focus logic
                                        setTimeout(() => searchInputRef.current?.focus(), 100);
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${isVirtualKeypadEnabled ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                                    title={isVirtualKeypadEnabled ? "Use Physical Keyboard" : "Use Virtual Keypad"}
                                >
                                    <Keyboard className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Alphanumeric Keypad (In-Flow) */}
                            {showAlphaKeyboard && (
                                <div className="mt-2 animate-in slide-in-from-bottom-5 fade-in duration-200 shadow-2xl rounded-xl overflow-hidden border border-gray-700">
                                    <div className="bg-gray-800 text-[10px] text-gray-500 text-center py-1 uppercase font-bold tracking-widest border-b border-gray-700">Detailed Search Input</div>
                                    <AlphanumericKeypad
                                        onInput={(char) => {
                                            setSearchInput(prev => prev + char);
                                        }}
                                        onDelete={() => {
                                            setSearchInput(prev => prev.slice(0, -1));
                                        }}
                                        onEnter={() => {
                                            setShowAlphaKeyboard(false);
                                            // Trigger search enter logic if needed
                                            if (searchInput.length >= 2) {
                                                // Wait for suggestion select or do manual search
                                            }
                                        }}
                                        onClose={() => setShowAlphaKeyboard(false)}
                                    />
                                </div>
                            )}

                            {/* Suggestions Dropdown */}
                            {isSuggestionsOpen && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar" ref={suggestionsListRef}>
                                    {suggestions.map((item, idx) => (
                                        <div key={item.Code} onClick={() => { setScannedProduct(item); setInputQty(1); setSearchInput(''); setSuggestions([]); setIsSuggestionsOpen(false); }} className={`p-3 border-b border-gray-700/50 cursor-pointer ${idx === selectedIndex ? 'bg-blue-900/50' : 'hover:bg-gray-700'}`}>
                                            <div className="flex justify-between"><span className="font-bold text-white">{item.Code}</span><span className="font-mono text-green-400">${item.ListPrice.toFixed(2)}</span></div>
                                            <div className="text-xs text-gray-400 truncate">{item.Description}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {scannedProduct ? (
                        <div className="flex-1 flex flex-col animate-in fade-in overflow-hidden">
                            {/* 1. Header (Image & Info) */}
                            <div className="flex gap-3 mb-2 shrink-0 relative">
                                <div className={`w-24 h-24 bg-black/40 rounded-xl border border-dark-border flex items-center justify-center relative overflow-hidden flex-shrink-0`}>
                                    {isLoadingImage ? <Icons.Refresh className="w-8 h-8 text-gray-500 animate-spin" /> : activeImage ? <img src={activeImage} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" /> : <Icons.Image className="w-8 h-8 text-gray-500" />}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                    <div>
                                        <h2 className="text-lg font-bold text-white leading-tight truncate">{scannedProduct.Description}</h2>
                                        <div className="text-sm text-gray-400 mt-1 font-mono">{scannedProduct.Code}  <span className="text-blue-400">{scannedProduct.SKU}</span></div>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="bg-black/50 border border-gray-600 rounded-lg px-3 py-1">
                                            <span className="text-gray-500 text-xs mr-1">$</span>
                                            <span className="text-2xl font-mono font-bold text-white">{scannedProduct.ListPrice.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Action Row (Edit/Cancel) - NEW ROW */}
                            <div className="grid grid-cols-2 gap-3 mb-3 shrink-0">
                                <button
                                    onClick={(e) => openKeypad(e, 'price_override', { isPriceInput: true, currentValue: scannedProduct.ListPrice })}
                                    className="h-12 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center gap-2 text-white font-bold transition-all active:scale-95 shadow-lg"
                                >
                                    <Icons.Edit className="w-5 h-5" /> Edit Price
                                </button>
                                <button
                                    onClick={() => setScannedProduct(null)}
                                    className="h-12 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center gap-2 text-gray-300 hover:text-white font-bold transition-all active:scale-95 shadow-lg border border-gray-600"
                                >
                                    <X className="w-5 h-5" /> Cancel
                                </button>
                            </div>

                            {/* 2. Quantity & Add Button */}
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700 shrink-0">
                                <button onClick={() => setInputQty(Math.max(1, inputQty - 1))} className="w-10 h-10 bg-gray-700 rounded-lg text-white hover:bg-gray-600 flex items-center justify-center"><Icons.Minus className="w-5 h-5" /></button>
                                <div className="flex-1 h-10 bg-black border border-gray-700 rounded-lg flex items-center justify-center text-xl font-bold text-white">{inputQty}</div>
                                <button onClick={() => setInputQty(inputQty + 1)} className="w-10 h-10 bg-gray-700 rounded-lg text-white hover:bg-gray-600 flex items-center justify-center"><Icons.Plus className="w-5 h-5" /></button>
                                <button onClick={handleManualAdd} className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">ADD</button>
                            </div>

                            {/* 3. General Product UI */}
                            {scannedProduct.Category === 'General' && (
                                <div className="flex-1 flex flex-col overflow-hidden min-h-0 mt-2">

                                    <div className="flex flex-wrap gap-2 pb-2 shrink-0">
                                        <button onClick={() => { setGenFilter('GN'); setGenSelection(''); }} className={`px-3 py-1.5 rounded text-xs font-bold border whitespace-nowrap ${genFilter === 'GN' ? 'bg-gemini-600 border-gemini-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>GN</button>
                                        <button onClick={() => { setGenFilter('ALL'); setGenSelection(''); }} className={`px-3 py-1.5 rounded text-xs font-bold border whitespace-nowrap ${genFilter === 'ALL' ? 'bg-gemini-600 border-gemini-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>ALL</button>
                                        {genUniqueLetters.map(l => (
                                            <button key={l} onClick={() => { setGenFilter(l); setGenSelection(''); }} className={`w-8 py-1.5 rounded text-xs font-bold border flex-shrink-0 flex items-center justify-center ${genFilter === l ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>{l}</button>
                                        ))}
                                    </div>

                                    {genFilter !== 'GN' && (
                                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded border border-gray-700 mt-1">
                                            {genOptions.length > 0 ? (
                                                genOptions.map((opt, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setGenSelection(opt.name)}
                                                        className={`w-full text-left px-3 py-2 border-b border-gray-800 text-xs flex justify-between items-center ${genSelection === opt.name ? 'bg-gemini-900/40 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                                                    >
                                                        <span className="truncate mr-2">{opt.name}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-gray-500 text-xs italic">
                                                    No options found.<br />
                                                    Filter: {genFilter}<br />
                                                    Group: {generalConfigService.skuToCategory.get(scannedProduct.SKU) || 'Unknown'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 text-sm italic p-0 text-center relative overflow-hidden">
                            {scanMode === 'general' ? (
                                <div className="w-full h-full overflow-y-auto custom-scrollbar p-2">
                                    <div className="grid grid-cols-2 gap-2 pb-20">
                                        {CUSTOM_GENERAL_ORDER.map(name => {
                                            const icon = getGeneralProductIcon(name);
                                            // Custom display names for better UI
                                            const displayName = name === 'Arrangement' ? 'FLORAL' : name;
                                            return (
                                                <button
                                                    key={name}
                                                    onClick={() => selectGeneralProduct(name)}
                                                    className="aspect-square bg-gray-800 rounded-xl border border-gray-700 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-500 hover:bg-gray-750 transition-all active:scale-95 shadow-lg"
                                                >
                                                    {icon ? (
                                                        <img src={icon} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <Icons.Box className="w-8 h-8 opacity-20 group-hover:opacity-50 mb-2" />
                                                    )}
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-12 text-center">
                                                        <span className="text-white font-bold text-xl uppercase tracking-wide drop-shadow-md leading-tight block break-words">{displayName}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {scanMode === 'gun' && (
                                        <>
                                            <ScanBarcode className="w-12 h-12 opacity-20 mb-2" />
                                            <p>Ready to Scan</p>
                                        </>
                                    )}
                                    {scanMode === 'search' && (
                                        <>
                                            <Search className="w-12 h-12 opacity-20 mb-2" />
                                            <p>Type to Search</p>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: CART */}
            <div className="w-[70%] bg-black rounded-2xl border border-dark-border flex flex-col shadow-2xl relative overflow-hidden pt-4">



                {/* Cart Header - Redesigned */}
                <div className="p-4 border-b border-dark-border bg-gradient-to-r from-dark-surface to-dark-bg relative z-10">
                    <div className="flex justify-between items-stretch h-32 mb-2">
                        {/* LEFT: Order Info (Order, Items, ID) */}
                        <div className="flex flex-col justify-center gap-2 mr-4 min-w-[120px]">
                            <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex flex-col items-center justify-center flex-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase">Order #</span>
                                <span className="text-sm font-mono text-white font-bold tracking-tight">{order.orderId}</span>
                            </div>
                            <div className="bg-black/30 p-1 rounded-lg border border-white/5 flex-1">
                                <div className="grid grid-cols-2 gap-1 h-full">
                                    {/* Types (品种数) */}
                                    <div className="flex flex-col items-center justify-center border-r border-white/10">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase">Types</span>
                                        <span className="text-lg font-mono text-white font-bold">{totals.items.length}</span>
                                    </div>
                                    {/* Qty (总数量) */}
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase">Qty</span>
                                        <span className="text-lg font-mono text-white font-bold">{totals.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                    </div>
                                </div>
                            </div>
                            {/* User ID Input moved here */}
                            <div className="bg-black/30 p-1 rounded-lg border border-white/5 flex items-center justify-center flex-1">
                                <Icons.User className="w-3 h-3 text-gray-500 mr-1" />
                                <input
                                    type="text"
                                    value={order.customerId}
                                    onChange={e => onUpdateOrder(p => ({ ...p, customerId: e.target.value.toUpperCase() }))}
                                    className="bg-transparent text-white font-mono font-bold text-sm w-16 focus:outline-none uppercase text-center"
                                    placeholder="ID"
                                />
                            </div>
                        </div>

                        {/* RIGHT: Action Grid (3 Columns) */}
                        <div className="flex-1 grid grid-cols-3 gap-3">
                            {/* Col 1: Payment Methods (Vertical) */}
                            <div className="bg-black/20 rounded-xl border border-white/5 p-2 flex flex-col gap-1 justify-center">
                                {['Cash', 'Card', 'Online'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => onUpdateOrder(p => ({ ...p, paymentMethod: m as any }))}
                                        className={`flex-1 rounded-lg font-bold text-xs uppercase transition-colors flex items-center justify-center ${order.paymentMethod === m ? 'bg-white text-black shadow-md' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {/* Col 2: Hold / Finish (Vertical) */}
                            <div className="bg-black/20 rounded-xl border border-white/5 p-2 flex flex-col gap-2 justify-center">
                                <button
                                    onClick={() => handleOrderAction('hold')}
                                    disabled={isProcessingPay || totals.items.length === 0}
                                    className={`flex-1 rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-xs ${isProcessingPay ? 'bg-orange-900 text-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white active:scale-95'}`}
                                >
                                    <Icons.Pause className="w-4 h-4" /> HOLD
                                </button>
                                <button
                                    onClick={() => handleOrderAction('finish')}
                                    disabled={isProcessingPay || totals.items.length === 0}
                                    className={`flex-[2] rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-sm ${isProcessingPay ? 'bg-green-900 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white active:scale-95'}`}
                                >
                                    {isProcessingPay ? <Icons.Refresh className="w-4 h-4 animate-spin" /> : <Icons.Check className="w-4 h-4" />} {isProcessingPay ? '...' : 'FINISH'}
                                </button>
                            </div>

                            {/* Col 3: Media (Vertical) */}
                            <div className="bg-black/20 rounded-xl border border-white/5 p-2 flex flex-col gap-2 justify-center">
                                <button onClick={() => setCaptureModal({ isOpen: true, type: 'video' })} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                    <Video className="w-4 h-4 text-red-400" /> Video
                                </button>
                                <button onClick={() => setCaptureModal({ isOpen: true, type: 'camera' })} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                    <Camera className="w-4 h-4 text-blue-400" /> Camera
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer Row (System Discounts & Totals) - Resized Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-2">
                        <div className="flex items-center gap-2">
                            {/* Large System Discount Buttons matching Total To Pay height approx */}
                            <button onClick={(e) => openKeypad(e, 'sys_pct', { currentValue: order.sysPercent })} className="h-14 w-16 bg-gray-800 border border-gray-700 rounded-xl text-white hover:bg-gray-700 flex flex-col items-center justify-center gap-0 shadow-lg active:scale-95 transition-transform"><span className="text-[10px] font-bold text-gray-500">%</span><span className="font-bold text-lg">{order.sysPercent || '-'}</span></button>
                            <button onClick={(e) => openKeypad(e, 'sys_amt', { currentValue: order.sysAmount })} className="h-14 w-16 bg-gray-800 border border-gray-700 rounded-xl text-white hover:bg-gray-700 flex flex-col items-center justify-center gap-0 shadow-lg active:scale-95 transition-transform"><span className="text-[10px] font-bold text-gray-500">$</span><span className="font-bold text-lg">{order.sysAmount || '-'}</span></button>
                            <button onClick={(e) => openKeypad(e, 'sys_final', { currentValue: order.finalPriceOverride })} className="h-14 w-20 bg-gray-800 border border-gray-700 rounded-xl text-white hover:bg-gray-700 flex flex-col items-center justify-center gap-0 shadow-lg active:scale-95 transition-transform"><span className="text-[10px] font-bold text-gray-500">Fixed</span><span className="font-bold text-lg">{order.finalPriceOverride ? '$' + order.finalPriceOverride : '-'}</span></button>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right"><div className="text-[10px] text-gray-500 uppercase font-bold">Subtotal</div><div className="text-lg font-mono text-gray-400">${totals.original.toFixed(2)}</div></div>
                            <div className="text-right"><div className="text-[10px] text-gray-500 uppercase font-bold">Disc.</div><div className="text-lg font-mono text-red-400">-${totals.discount.toFixed(2)}</div></div>
                            <div className="text-right bg-gray-800 px-6 py-2 rounded-xl border border-gray-600 shadow-xl h-14 flex flex-col justify-center min-w-[140px]"><div className="text-[10px] text-gray-500 uppercase font-bold text-right leading-none mb-1">Total To Pay</div><div className="text-2xl font-bold text-white font-mono leading-none text-right">${totals.grand.toFixed(2)}</div></div>
                        </div>
                    </div>
                </div>

                {/* Cart Table */}
                {/* Cart Table - Redesigned */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
                            <th className="pb-2 w-[35%] pl-2">Product</th>
                            <th className="pb-2 text-center w-[15%]">Price/Qty</th>
                            <th className="pb-2 text-center w-[15%]">Disc</th>
                            <th className="pb-2 text-center w-[15%]">Total</th>
                            <th className="pb-2"></th>
                        </tr></thead>
                        <tbody className="text-sm text-gray-300">
                            {totals.items.map((item, idx) => (
                                <tr key={item.cartId} className="border-b border-gray-800/50 hover:bg-white/5 group" onClick={() => selectProductFromCart(item)}>
                                    {/* Product Column */}
                                    <td className="py-3 pl-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-800 rounded mx-1 overflow-hidden flex-shrink-0 border border-gray-700">
                                                <CartItemThumbnail sku={item.SKU} code={item.Code} wpConfig={wpConfig} isGeneral={item.isGeneralProduct} generalName={item.Description.replace('General ', '')} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-white truncate max-w-[180px]">{item.Description}</div>
                                                <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                                    <span>{item.Code} {item.isGeneralProduct && item.gnIndexLetter ? <span className="text-orange-400 ml-1 font-mono">[{item.gnIndexLetter}]</span> : ''}</span>
                                                </div>
                                                <div className="text-[10px] text-blue-400 font-mono">{item.SKU}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Price / Qty Stack */}
                                    <td className="py-3 text-center">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <div className="font-mono text-gray-300">${item.ListPrice.toFixed(2)}</div>
                                            <div className="bg-gray-800 px-3 py-0.5 rounded border border-gray-700 font-mono font-bold text-white min-w-[2rem]">{item.quantity}</div>
                                        </div>
                                    </td>

                                    {/* Discount Column */}
                                    <td className="py-3 text-center">
                                        {item.hasSpecificDiscount ? (
                                            <div className="flex flex-col items-center">
                                                <span className="font-mono font-bold text-red-400 text-lg">-${item.discountAmount.toFixed(2)}</span>
                                                <span className="text-[10px] text-gray-500">{item.discountType === 'percent' ? `${item.discountValue}%` : 'Fixed'}</span>
                                            </div>
                                        ) : (
                                            <div className="text-gray-600 font-mono">-</div>
                                        )}
                                    </td>

                                    {/* Total Column (Boxed) */}
                                    <td className="py-3">
                                        <div className="bg-blue-900/20 border border-blue-900/50 rounded flex items-center justify-center h-10 w-24 mx-auto">
                                            <span className="font-bold text-white font-mono text-lg">${item.finalLineTotal.toFixed(2)}</span>
                                        </div>
                                    </td>

                                    {/* Actions (Large Square Buttons 25% bigger) */}
                                    <td className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-1 h-full">
                                            <button onClick={(e) => openKeypad(e, 'item_disc', { targetId: item.cartId, currentValue: item.discountValue })} className="w-[50px] h-[50px] bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-200 border border-gray-700 font-bold flex items-center justify-center transition-colors active:scale-95 text-xl">%</button>
                                            <button onClick={(e) => openKeypad(e, 'item_amt', { targetId: item.cartId, currentValue: item.discountValue })} className="w-[50px] h-[50px] bg-gray-800 hover:bg-gray-700 rounded-lg text-green-200 border border-gray-700 font-bold flex items-center justify-center transition-colors active:scale-95 text-xl">$</button>
                                            <button onClick={(e) => { e.stopPropagation(); onUpdateOrder(p => ({ ...p, items: p.items.filter(i => i.cartId !== item.cartId) })); }} className="w-[50px] h-[50px] bg-red-900/20 hover:bg-red-900/40 border border-red-900/30 rounded-lg text-red-400 flex items-center justify-center transition-colors active:scale-95"><Icons.Trash className="w-6 h-6" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
