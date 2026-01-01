
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OrderHeader, OrderItem, AppMode, WordPressConfig, PrinterConfig, CsvFile, OrderMedia } from '../types';
import { getOrdersByRange, getOrderItems, voidOrder, getMediaCountsForOrders, getMediaForOrder } from '../services/db';
import { getMelbourneFilterDate, getMelbourneISODate } from '../services/dateService';
import { fetchWpImage } from '../services/wpService';
import { processRawData } from '../services/dataProcessor';
import { printOrderReceipt } from '../services/printService';
import { Calendar, Search, Clock, User, AlertCircle, Filter, RotateCcw, Box, Printer, MoreVertical, Copy, XCircle, Ban, CheckCircle2, Loader2, ArrowLeft, AlertTriangle, CreditCard, PlayCircle, Film, Image as ImageIcon, FileText } from 'lucide-react';

interface OrdersManagerProps {
    wpConfig: WordPressConfig;
    printerConfig: PrinterConfig;
    enableLocalPrint: boolean;
    files: CsvFile[];
    onLoadOrder: (items: OrderItem[]) => void;
}

// Add simple helper if not imported
const getMelbourneDate = (): Date => {
    const now = new Date();
    const melString = now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' });
    return new Date(melString);
};

const OrderThumbnail = ({ code, sku, wpConfig }: { code: string, sku: string, wpConfig: WordPressConfig }) => {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        let isMounted = true;
        if (wpConfig.url && sku) {
            fetchWpImage(sku, wpConfig).then(url => { if (isMounted && url) setSrc(url); });
        }
        return () => { isMounted = false; };
    }, [code, sku, wpConfig]);

    if (!src) return <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-gray-600"><Box className="w-4 h-4" /></div>;
    return <img src={src} className="w-8 h-8 object-cover rounded" referrerPolicy="no-referrer" />;
};

const MediaGalleryModal = ({ orderId, onClose }: { orderId: string, onClose: () => void }) => {
    const [media, setMedia] = useState<OrderMedia[]>([]);
    const [selectedMedia, setSelectedMedia] = useState<OrderMedia | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await getMediaForOrder(orderId);
            setMedia(data.sort((a, b) => b.timestamp - a.timestamp));
            if (data.length > 0) setSelectedMedia(data[0]);
            setLoading(false);
        };
        load();
    }, [orderId]);

    const getUrl = (blob: Blob) => URL.createObjectURL(blob);

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-200">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full z-50">
                <XCircle className="w-8 h-8" />
            </button>

            <h2 className="text-white font-bold text-center mb-4 text-xl">Order Media: {orderId}</h2>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : media.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">No media found</div>
            ) : (
                <div className="flex-1 flex gap-4 overflow-hidden">
                    {/* Main Viewer */}
                    <div className="flex-1 bg-black rounded-xl border border-gray-800 flex items-center justify-center relative overflow-hidden">
                        {selectedMedia && (
                            selectedMedia.type === 'video' ? (
                                <video
                                    src={getUrl(selectedMedia.blob)}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <img
                                    src={getUrl(selectedMedia.blob)}
                                    className="max-w-full max-h-full object-contain"
                                />
                            )
                        )}
                    </div>

                    {/* Thumbnail List */}
                    <div className="w-[120px] flex flex-col gap-2 overflow-y-auto custom-scrollbar">
                        {media.map((m, i) => (
                            <div
                                key={i}
                                onClick={() => setSelectedMedia(m)}
                                className={`aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer border-2 relative ${selectedMedia === m ? 'border-gemini-500' : 'border-transparent hover:border-gray-600'}`}
                            >
                                {m.type === 'image' ? (
                                    <img src={getUrl(m.blob)} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900">
                                        <Film className="w-8 h-8" />
                                    </div>
                                )}
                                <div className="absolute bottom-0 inset-x-0 bg-black/50 text-[9px] text-white text-center py-0.5 font-mono">
                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const OrdersManager: React.FC<OrdersManagerProps> = ({ wpConfig, printerConfig, enableLocalPrint, files, onLoadOrder }) => {
    const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'this_week' | 'this_month' | 'custom'>('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const [statusFilter, setStatusFilter] = useState<'ALL' | 'Completed' | 'Hold' | 'Void'>('Completed');
    const [otnFilter, setOtnFilter] = useState<'ALL' | 'Normal' | 'Test'>('Normal');
    const [searchQuery, setSearchQuery] = useState('');

    const [orders, setOrders] = useState<OrderHeader[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<OrderHeader | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);

    // --- MEDIA PRE-FETCH STATE ---
    const [mediaCounts, setMediaCounts] = useState<Record<string, number>>({});
    const [showMediaGallery, setShowMediaGallery] = useState(false);

    // --- NEW MODAL STATE ---
    const [targetOrder, setTargetOrder] = useState<OrderHeader | null>(null);
    const [modalPhase, setModalPhase] = useState<'menu' | 'confirm_void' | 'confirm_copy' | 'processing' | 'success' | 'error'>('menu');
    const [statusMessage, setStatusMessage] = useState('');
    const [isPrinting, setIsPrinting] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);

    const inventoryMap = useMemo(() => {
        const data = processRawData(files);
        const map = new Map<string, string>();
        data.forEach(d => {
            if (d.Code) map.set(d.Code, d.Description);
        });
        return map;
    }, [files]);

    const dateRange = useMemo(() => {
        const melbourneToday = getMelbourneISODate();
        switch (filterType) {
            case 'today': return { start: melbourneToday, end: melbourneToday };
            case 'week': return { start: getMelbourneFilterDate(7), end: melbourneToday };
            case 'month': return { start: getMelbourneFilterDate(30), end: melbourneToday };
            case 'this_week': {
                const d = new Date(); // Use local or melbourne logic
                // Using internal logic to align with getMelbourneDate would be best, but mimicking basics here
                const mel = getMelbourneDate();
                const day = mel.getDay();
                const diff = mel.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
                const monday = new Date(mel.setDate(diff));
                const isoMon = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
                return { start: isoMon, end: melbourneToday };
            }
            case 'this_month': {
                const mel = getMelbourneDate();
                const isoFirst = `${mel.getFullYear()}-${String(mel.getMonth() + 1).padStart(2, '0')}-01`;
                return { start: isoFirst, end: melbourneToday };
            }
            case 'custom': return { start: customStart || melbourneToday, end: customEnd || melbourneToday };
            default: return { start: melbourneToday, end: melbourneToday };
        }
    }, [filterType, customStart, customEnd]);

    const loadOrders = async () => {
        setIsLoading(true);
        try {
            const data = await getOrdersByRange(dateRange.start, dateRange.end);
            data.sort((a, b) => b.INDEX.localeCompare(a.INDEX));
            setOrders(data);

            // --- PRE-FETCH MEDIA COUNTS ---
            const ids = data.map(o => o.INDEX);
            const counts = await getMediaCountsForOrders(ids);
            setMediaCounts(counts);

            if (selectedOrder) {
                const refreshed = data.find(o => o.INDEX === selectedOrder.INDEX);
                if (refreshed) setSelectedOrder(refreshed);
                else setSelectedOrder(null);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => {
        if (filterType === 'custom' && (!customStart || !customEnd)) return;
        loadOrders();
    }, [dateRange]);

    useEffect(() => {
        if (selectedOrder) {
            setItemsLoading(true);
            getOrderItems(selectedOrder.INDEX).then(items => {
                setOrderItems(items);
                setItemsLoading(false);
            });
        } else {
            setOrderItems([]);
        }
    }, [selectedOrder]);

    const openMenu = (order: OrderHeader) => {
        setTargetOrder(order);
        setModalPhase('menu');
    };

    const closeMenu = () => {
        setTargetOrder(null);
        setModalPhase('menu');
    };

    const executeVoid = async () => {
        if (!targetOrder) return;
        setModalPhase('processing');
        const success = await voidOrder(targetOrder.INDEX);

        if (success) {
            setModalPhase('success');
            setStatusMessage("Order Voided Successfully");
            await loadOrders();
            setTimeout(closeMenu, 1500);
        } else {
            setModalPhase('error');
            setStatusMessage("Database Update Failed");
        }
    };

    const executeCopy = async () => {
        if (!targetOrder) return;
        setModalPhase('processing');
        const items = await getOrderItems(targetOrder.INDEX);

        if (items.length > 0) {
            setModalPhase('success');
            setStatusMessage("Copied! Redirecting...");
            setTimeout(() => {
                onLoadOrder(items);
                closeMenu();
            }, 1000);
        } else {
            setModalPhase('error');
            setStatusMessage("No items found in this order");
        }
    };

    const executePrint = async () => {
        if (!targetOrder) return;
        if (!printerConfig.receiptPrinter) { alert("No Receipt Printer Configured"); return; }

        setIsPrinting(true);
        try {
            const items = await getOrderItems(targetOrder.INDEX);
            await printOrderReceipt(printerConfig, targetOrder, items);
            alert("Sent to Printer!");
        } catch (e) {
            alert("Print Failed");
        } finally {
            setIsPrinting(false);
        }
    };

    const formatTime = (t: string) => {
        if (!t || t.length < 12) return t;
        return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'text-green-400 bg-green-400/10 border-green-400/20';
            case 'Hold': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
            case 'Cancelled': return 'text-red-400 bg-red-400/10 border-red-400/20';
            case 'Void': return 'text-gray-500 bg-gray-500/10 border-gray-500/20 line-through';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const currentStatus = order.OSTATUS || 'Completed';
            const matchesStatus = statusFilter === 'ALL' || currentStatus === statusFilter;
            const currentOTN = order.OTN || 'Normal';
            const matchesOTN = otnFilter === 'ALL' || currentOTN === otnFilter;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || order.INDEX.toLowerCase().includes(q) || order.ID.toLowerCase().includes(q);
            return matchesStatus && matchesOTN && matchesSearch;
        });
    }, [orders, statusFilter, otnFilter, searchQuery]);

    const cycleStatusFilter = () => {
        const modes: ('ALL' | 'Completed' | 'Hold' | 'Void')[] = ['ALL', 'Completed', 'Hold', 'Void'];
        const idx = modes.indexOf(statusFilter);
        const next = modes[(idx + 1) % modes.length];
        setStatusFilter(next);
    };

    const cycleOtnFilter = () => {
        const modes: ('ALL' | 'Normal' | 'Test')[] = ['ALL', 'Normal', 'Test'];
        const idx = modes.indexOf(otnFilter);
        const next = modes[(idx + 1) % modes.length];
        setOtnFilter(next);
    };

    const getStatusLabel = () => {
        switch (statusFilter) {
            case 'Completed': return 'FINISH';
            case 'Hold': return 'HOLD';
            case 'Void': return 'VOID';
            default: return 'ALL STATUS';
        }
    };

    const getOtnLabel = () => {
        switch (otnFilter) {
            case 'Normal': return 'NORMAL MODE';
            case 'Test': return 'TEST MODE';
            default: return 'ALL MODES';
        }
    };

    const getStatusButtonClass = () => {
        switch (statusFilter) {
            case 'Completed': return 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]';
            case 'Hold': return 'bg-orange-600 border-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]';
            case 'Void': return 'bg-gray-600 border-gray-500 text-gray-300';
            default: return 'bg-dark-bg border-dark-border text-gray-400 hover:text-white hover:border-gray-500';
        }
    };

    const getOtnButtonClass = () => {
        switch (otnFilter) {
            case 'Normal': return 'bg-blue-600 border-blue-500 text-white';
            case 'Test': return 'bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]';
            default: return 'bg-dark-bg border-dark-border text-gray-400 hover:text-white hover:border-gray-500';
        }
    };

    return (
        <div className="h-full flex gap-4 p-4 overflow-hidden relative">

            {/* Receipt Preview Modal */}
            {showReceiptPreview && selectedOrder && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowReceiptPreview(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold">Receipt Preview</h3>
                                <button
                                    onClick={() => setShowReceiptPreview(false)}
                                    className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                                >
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-blue-100 mt-1">Order: {selectedOrder.INDEX}</p>
                        </div>

                        {/* Receipt Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            <div className="bg-white p-6 rounded-lg shadow-sm font-mono text-sm space-y-4 border border-gray-200">
                                {/* Business Info */}
                                <div className="text-center border-b-2 border-dashed border-gray-300 pb-4">
                                    <div className="font-bold text-xl text-black mb-2">TAX INVOICE</div>
                                    <div className="font-bold text-lg text-black">LIFELIKE PLANTS</div>
                                    <div className="text-xs mt-1 text-gray-700">ABN: 55 660 744 196</div>
                                    <div className="text-xs text-gray-700">https://lifelikeplants.au/</div>
                                    <div className="text-xs text-gray-700">549 Whitehorse Road, Mitcham, VIC 3132</div>
                                    <div className="text-xs text-gray-700">Ph: 03-98748099</div>
                                </div>

                                {/* Order Info */}
                                <div className="text-center border-b border-dashed border-gray-300 pb-3">
                                    <div className="font-bold text-black">ORDER #{selectedOrder.INDEX}</div>
                                    <div className="text-xs text-gray-800">{formatTime(selectedOrder.TIME)}</div>
                                    <div className="text-xs text-gray-800">Customer: {selectedOrder.ID}</div>
                                    <div className="text-xs text-gray-800">Payment: {selectedOrder.PAIDBY}</div>
                                </div>

                                {/* Items Summary */}
                                <div className="flex justify-between text-xs border-b border-dashed border-gray-300 pb-2 text-gray-800 font-semibold">
                                    <span>Types: {orderItems.length}</span>
                                    <span>Qty: {orderItems.reduce((sum, item) => sum + item.QTY, 0)}</span>
                                </div>

                                {/* Items List */}
                                <div className="space-y-2">
                                    {orderItems.map((item, idx) => (
                                        <div key={idx} className="text-xs">
                                            <div className="flex justify-between text-black">
                                                <span className="font-bold">{item.CODE}</span>
                                                <span className="font-semibold">${item.SUBTOTAL.toFixed(2)}</span>
                                            </div>
                                            <div className="text-gray-700 ml-2">
                                                {inventoryMap.get(item.CODE) || item.DESC || '-'}
                                            </div>
                                            <div className="ml-2 text-gray-600">
                                                {item.QTY} x ${item.PRICE.toFixed(2)}
                                                {item.ITEMDISC > 0 && ` (Disc: $${item.ITEMDISC.toFixed(2)})`}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals */}
                                <div className="border-t-2 border-dashed border-gray-300 pt-3 space-y-1 text-gray-800">
                                    <div className="flex justify-between text-xs">
                                        <span>Subtotal:</span>
                                        <span>${selectedOrder.REFTOTAL.toFixed(2)}</span>
                                    </div>
                                    {selectedOrder.PERCENT_DISC > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span>Sys % Disc ({selectedOrder.PERCENT_DISC}%):</span>
                                            <span>-${(selectedOrder.REFTOTAL * (selectedOrder.PERCENT_DISC / 100)).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {selectedOrder.DOLLAR_DISC > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span>Sys $ Disc:</span>
                                            <span>-${selectedOrder.DOLLAR_DISC.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {selectedOrder.ALLDISC > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span>Total Discount:</span>
                                            <span>-${selectedOrder.ALLDISC.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2 mt-2 text-black">
                                        <span>TOTAL:</span>
                                        <span>${selectedOrder.NEEDTOPAY.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-700">
                                        <span>Inc GST:</span>
                                        <span>${((selectedOrder.NEEDTOPAY / 1.1) * 0.1).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="text-center text-xs text-gray-700 border-t border-dashed border-gray-300 pt-3">
                                    <div>Thank you for your business!</div>

                                    <div className="mt-3 text-gray-600">UUID: {selectedOrder.UUID}</div>

                                    {/* Barcode Placeholder */}
                                    <div className="mt-2 mb-2">
                                        <div className="text-[9px] text-gray-400 mb-1">(Barcode will print here)</div>
                                        <div className="flex justify-center">
                                            <div className="bg-white border border-gray-300 px-2 py-1">
                                                <div className="flex gap-[1px] justify-center mb-1">
                                                    {Array.from({ length: 40 }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-[2px] bg-black"
                                                            style={{ height: `${Math.random() > 0.5 ? '40px' : '30px'}` }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="text-[8px] text-center text-gray-600 font-mono">
                                                    {selectedOrder.UUID}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[8px] text-gray-400 mt-1">Visual placeholder - actual barcode is CODE128</div>
                                    </div>

                                    {selectedOrder.OTN === 'Test' && (
                                        <div className="mt-2 text-purple-600 font-bold">*** TEST MODE ***</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-4 bg-gray-100 border-t border-gray-200">
                            <button
                                onClick={() => setShowReceiptPreview(false)}
                                className="w-full py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold transition-colors"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMediaGallery && selectedOrder && (
                <MediaGalleryModal orderId={selectedOrder.INDEX} onClose={() => setShowMediaGallery(false)} />
            )}

            {/* --- FULL SCREEN ACTION MODAL (FIXED) --- */}
            {targetOrder && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (modalPhase === 'menu') closeMenu();
                    }}
                >
                    <div
                        className="bg-dark-surface border border-dark-border rounded-2xl p-8 shadow-2xl w-full max-w-md relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 1. MENU PHASE */}
                        {modalPhase === 'menu' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white mb-2">Manage Order</h3>
                                    <div className="text-3xl font-mono text-gemini-400 font-bold tracking-wider mb-1">{targetOrder.INDEX}</div>
                                    <div className="text-sm text-gray-500">{formatTime(targetOrder.TIME)}</div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                        onClick={() => setModalPhase('confirm_copy')}
                                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg transition-transform active:scale-95"
                                    >
                                        <Copy className="w-6 h-6" /> Copy to Cart
                                    </button>

                                    <button
                                        onClick={executePrint}
                                        disabled={isPrinting}
                                        className="w-full py-5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg transition-transform active:scale-95 border border-gray-600"
                                    >
                                        {isPrinting ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />} Print Order
                                    </button>

                                    {targetOrder.OSTATUS !== 'Void' && targetOrder.OSTATUS !== 'Cancelled' ? (
                                        <button
                                            onClick={() => setModalPhase('confirm_void')}
                                            className="w-full py-5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg transition-transform active:scale-95 border border-red-500"
                                        >
                                            {targetOrder.OSTATUS === 'Hold' ? <Ban className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                            {targetOrder.OSTATUS === 'Hold' ? 'Cancel Hold' : 'Void Order'}
                                        </button>
                                    ) : (
                                        <div className="w-full py-4 bg-gray-800 border border-gray-700 rounded-xl text-gray-500 font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed">
                                            <Ban className="w-5 h-5" /> Order already Void
                                        </div>
                                    )}
                                </div>

                                <button onClick={closeMenu} className="w-full py-3 mt-4 text-gray-400 hover:text-white font-medium">Cancel</button>
                            </div>
                        )}

                        {/* 2. CONFIRM VOID PHASE */}
                        {modalPhase === 'confirm_void' && (
                            <div className="text-center space-y-6 animate-in slide-in-from-right-10 duration-200">
                                <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-500">
                                    <AlertTriangle className="w-10 h-10" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Are you sure?</h3>
                                    <p className="text-gray-400">
                                        This will mark Order <span className="font-mono text-white">{targetOrder.INDEX}</span> as VOID.
                                        <br />This action updates the database immediately.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setModalPhase('menu')} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold">Back</button>
                                    <button onClick={executeVoid} className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg">Confirm Void</button>
                                </div>
                            </div>
                        )}

                        {/* 3. CONFIRM COPY PHASE */}
                        {modalPhase === 'confirm_copy' && (
                            <div className="text-center space-y-6 animate-in slide-in-from-right-10 duration-200">
                                <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-500">
                                    <Copy className="w-10 h-10" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Copy Order?</h3>
                                    <p className="text-gray-400">
                                        This will populate the cart with items from <span className="font-mono text-white">{targetOrder.INDEX}</span>.
                                        <br />Current cart items will be replaced.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setModalPhase('menu')} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold">Back</button>
                                    <button onClick={executeCopy} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg">Load Cart</button>
                                </div>
                            </div>
                        )}

                        {/* 4. PROCESSING PHASE */}
                        {modalPhase === 'processing' && (
                            <div className="text-center py-8">
                                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white">Processing...</h3>
                            </div>
                        )}

                        {/* 5. SUCCESS PHASE */}
                        {modalPhase === 'success' && (
                            <div className="text-center py-8 animate-in zoom-in duration-200">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                    <CheckCircle2 className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">{statusMessage}</h3>
                            </div>
                        )}

                        {/* 6. ERROR PHASE */}
                        {modalPhase === 'error' && (
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                                    <XCircle className="w-10 h-10" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Error</h3>
                                <p className="text-red-400 mb-6">{statusMessage}</p>
                                <button onClick={() => setModalPhase('menu')} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">Try Again</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Left Pane: Filters & List */}
            <div className="w-[300px] flex flex-col gap-3 h-full flex-shrink-0">

                {/* 1. Date Filter Card */}
                {/* 1. Date Filter Card */}
                <div className="bg-dark-surface border border-dark-border rounded-xl p-3 shadow-lg">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Calendar className="w-3 h-3" /> Date Range</h3>

                    {/* Row 1: Today, 7 Days, 30 Days */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        {['today', 'week', 'month'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t as any)}
                                className={`py-2 rounded text-xs font-bold uppercase border transition-colors ${filterType === t ? 'bg-gemini-600 border-gemini-500 text-white' : 'bg-dark-bg border-dark-border text-gray-400 hover:text-white'}`}
                            >
                                {t === 'today' ? 'Today' : t === 'week' ? '7 Days' : '30 Days'}
                            </button>
                        ))}
                    </div>

                    {/* Row 2: This Week, This Month */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {['this_week', 'this_month'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t as any)}
                                className={`py-2 rounded text-xs font-bold uppercase border transition-colors ${filterType === t ? 'bg-gemini-600 border-gemini-500 text-white' : 'bg-dark-bg border-dark-border text-gray-400 hover:text-white'}`}
                            >
                                {t === 'this_week' ? 'This Week' : 'This Month'}
                            </button>
                        ))}
                    </div>

                    {filterType === 'custom' ? (
                        <div className="animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-gray-500 font-mono">YYYY/MM/DD (English)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" lang="en-CA" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs" />
                                <input type="date" lang="en-CA" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs" />
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setFilterType('custom')}
                            className="w-full py-2 rounded text-xs font-bold uppercase border transition-colors bg-dark-bg border-dark-border text-gray-400 hover:text-white hover:border-gray-500"
                        >
                            Custom Range
                        </button>
                    )}
                </div>

                {/* 2 & 3. Merged OTN & Status Filters */}
                <div className="flex gap-2">
                    {/* OTN Filter */}
                    <button
                        onClick={cycleOtnFilter}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase border transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ${getOtnButtonClass()}`}
                    >
                        <RotateCcw className="w-3 h-3" />
                        {getOtnLabel().replace(' MODE', '')}
                    </button>

                    {/* Status Filter */}
                    <button
                        onClick={cycleStatusFilter}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase border transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ${getStatusButtonClass()}`}
                    >
                        <Filter className="w-3 h-3" />
                        {getStatusLabel()}
                    </button>
                </div>

                {/* 4. Orders List */}
                <div className="flex-1 bg-dark-surface border border-dark-border rounded-xl overflow-hidden flex flex-col shadow-lg">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-dark-border bg-dark-surface z-10">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-3 h-3 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search Order ID..."
                                className="w-full bg-dark-bg border border-dark-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gemini-500 transition-colors placeholder-gray-600"
                            />
                        </div>
                    </div>

                    {/* List Items */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {isLoading ? (
                            <div className="text-center p-8 text-gray-500">Loading...</div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="text-center p-8 text-gray-500 flex flex-col items-center">
                                <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-xs">No orders match filter</span>
                            </div>
                        ) : (
                            filteredOrders.map(order => (
                                <div
                                    key={order.INDEX}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-white/5 relative overflow-hidden group ${selectedOrder?.INDEX === order.INDEX ? 'bg-gemini-900/20 border-gemini-500/50' : 'bg-dark-bg border-dark-border'}`}
                                >
                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-mono font-bold text-sm ${selectedOrder?.INDEX === order.INDEX ? 'text-gemini-300' : 'text-white'} ${order.OSTATUS === 'Void' ? 'line-through opacity-50' : ''}`}>{order.INDEX}</span>
                                            {order.OTN === 'Test' && <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-800">TEST</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {/* Media Indicator */}
                                            {mediaCounts[order.INDEX] > 0 && (
                                                <span className="text-[9px] px-1 py-0.5 bg-blue-900/50 text-blue-300 rounded border border-blue-800 flex items-center gap-0.5">
                                                    <PlayCircle className="w-2.5 h-2.5" /> {mediaCounts[order.INDEX]}
                                                </span>
                                            )}

                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase ${getStatusColor(order.OSTATUS || 'Completed')}`}>
                                                {order.OSTATUS === 'Completed' ? 'FINISH' : order.OSTATUS || 'FINISH'}
                                            </span>

                                            {/* --- MENU TRIGGER BUTTON --- */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openMenu(order); }}
                                                className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                            >
                                                <MoreVertical className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end text-xs text-gray-400 relative z-10">
                                        <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(order.TIME)}</div>
                                        <div className={`font-mono font-bold text-sm ${order.OSTATUS === 'Void' ? 'text-gray-500 line-through' : 'text-gray-200'}`}>${order.NEEDTOPAY.toFixed(2)}</div>
                                    </div>

                                    {/* Active Indicator Stripe */}
                                    {selectedOrder?.INDEX === order.INDEX && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gemini-500"></div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    {/* Footer Stats */}
                    <div className="p-2 bg-dark-bg border-t border-dark-border text-center">
                        <span className="text-[10px] text-gray-500 font-mono">
                            {filteredOrders.length} Orders
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Pane: Details */}
            <div className="flex-1 bg-dark-surface border border-dark-border rounded-xl shadow-2xl overflow-hidden flex flex-col relative">
                {selectedOrder ? (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-dark-border bg-gradient-to-r from-dark-surface to-dark-bg">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        Order #{selectedOrder.INDEX}
                                        {selectedOrder.OTN === 'Test' && <span className="text-sm bg-purple-600 text-white px-2 py-0.5 rounded shadow">TEST MODE</span>}
                                        {selectedOrder.OSTATUS === 'Void' && <span className="text-sm bg-gray-600 text-white px-2 py-0.5 rounded shadow">VOIDED</span>}
                                        {selectedOrder.OSTATUS === 'Hold' && <span className="text-sm bg-orange-600 text-white px-2 py-0.5 rounded shadow">ON HOLD</span>}
                                    </h2>
                                    <p className="text-gray-400 text-sm mt-1 flex items-center gap-4">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(selectedOrder.TIME)}</span>
                                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedOrder.ID}</span>
                                        <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {selectedOrder.PAIDBY}</span>
                                        <span className="flex items-center gap-1 text-gray-500 font-mono text-xs">UUID: {selectedOrder.UUID?.slice(0, 8)}...</span>
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className={`text-3xl font-mono font-bold ${selectedOrder.OSTATUS === 'Void' ? 'text-gray-500 line-through' : 'text-white'}`}>${selectedOrder.NEEDTOPAY.toFixed(2)}</div>
                                    <button
                                        onClick={() => setShowReceiptPreview(true)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-bold shadow-lg"
                                        title="Preview receipt without printing"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Print Demo
                                    </button>
                                </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="flex gap-4 bg-black/20 p-4 rounded-xl border border-white/5 items-center">
                                {/* Types (品种数) */}
                                <div className="flex flex-col items-center justify-center text-center flex-1">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Types</div>
                                    <div className="text-lg text-white font-mono font-bold">{orderItems.length}</div>
                                </div>
                                {/* Qty (总数量) */}
                                <div className="flex flex-col items-center justify-center text-center flex-1">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Qty</div>
                                    <div className="text-lg text-white font-mono font-bold">{orderItems.reduce((sum, item) => sum + item.QTY, 0)}</div>
                                </div>
                                <div className="w-px h-10 bg-gray-700"></div>
                                <div className="flex flex-col items-center justify-center text-center flex-1">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Ref Total</div>
                                    <div className="text-lg text-gray-300 font-mono">${selectedOrder.REFTOTAL.toFixed(2)}</div>
                                </div>
                                <div className="flex flex-col items-center justify-center text-center flex-1">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Sys % Disc</div>
                                    <div className="text-lg text-gray-300 font-mono">{selectedOrder.PERCENT_DISC}%</div>
                                </div>
                                <div className="flex flex-col items-center justify-center text-center flex-1">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Sys $ Disc</div>
                                    <div className="text-lg text-gray-300 font-mono">${selectedOrder.DOLLAR_DISC.toFixed(2)}</div>
                                </div>
                                <div className="flex flex-col items-center justify-center text-center flex-1">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Override</div>
                                    <div className="text-lg text-gray-300 font-mono">{selectedOrder.FINALSET > 0 ? `$${selectedOrder.FINALSET}` : '-'}</div>
                                </div>

                                {/* Playback Button */}
                                <div className="w-px h-10 bg-gray-700 mx-2"></div>
                                <button
                                    onClick={() => setShowMediaGallery(true)}
                                    disabled={!mediaCounts[selectedOrder.INDEX]}
                                    className={`flex flex-col items-center justify-center px-4 py-1 rounded transition-colors ${mediaCounts[selectedOrder.INDEX] ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 cursor-pointer' : 'text-gray-600 cursor-not-allowed'}`}
                                >
                                    <PlayCircle className="w-5 h-5 mb-1" />
                                    <span className="text-[10px] font-bold uppercase">Playback ({mediaCounts[selectedOrder.INDEX] || 0})</span>
                                </button>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-dark-bg text-gray-500 text-xs uppercase sticky top-0 z-10 shadow-sm border-b border-dark-border">
                                    <tr>
                                        <th className="p-4 font-bold w-[30%]">Product</th>
                                        <th className="p-4 font-bold w-[5%]">Idx</th> {/* NEW: Idx Col */}
                                        <th className="p-4 font-bold w-[20%]">Description</th>
                                        <th className="p-4 font-bold text-center w-[10%]">Qty</th>
                                        <th className="p-4 font-bold text-right w-[15%]">Price</th>
                                        <th className="p-4 font-bold text-right w-[20%]">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border/30 text-sm text-gray-300">
                                    {itemsLoading ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading items...</td></tr>
                                    ) : (
                                        orderItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 flex items-center gap-3">
                                                    <OrderThumbnail code={item.CODE} sku={item.SKU} wpConfig={wpConfig} />
                                                    <div>
                                                        <div className="font-medium text-white">{item.CODE}</div>
                                                        <div className="text-xs text-gray-500">{item.SKU}</div>
                                                    </div>
                                                </td>
                                                {/* NEW: Idx Cell */}
                                                <td className="p-4 text-xs font-mono text-gray-400">
                                                    {item.GNINDEX || ''}
                                                </td>
                                                {/* Description Cell */}
                                                <td className="p-4 text-xs text-gray-400 truncate max-w-[200px]" title={inventoryMap.get(item.CODE) || item.CODE}>
                                                    {inventoryMap.get(item.CODE) || '-'}
                                                </td>
                                                <td className="p-4 text-center font-mono">{item.QTY}</td>
                                                <td className="p-4 text-right font-mono text-gray-400">${item.PRICE.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono font-bold text-white">${item.SUBTOTAL.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
                        <p>Select an order to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
};
