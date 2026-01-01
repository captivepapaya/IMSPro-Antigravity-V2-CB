import React, { useState, useMemo } from 'react';
import { InventoryItem, PrinterConfig } from '../types';
import { Printer, Trash2, Box, AlertCircle, ScanBarcode, Plus, Minus, Eye, X } from 'lucide-react';
import { testLabelPrint, encodeCode128B, printBarcodeQueue } from '../services/printService';
import { useToast } from '../hooks/useToast';

interface BarcodeManagerProps {
    queue: InventoryItem[];
    setQueue: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    printerConfig: PrinterConfig;
}

// Reuse BarcodeVisual logic from App.tsx
const BarcodeVisual = ({ value }: { value: string }) => {
    const bars = useMemo(() => {
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

interface LabelPreviewModalProps {
    item: InventoryItem;
    onClose: () => void;
}

const LabelPreviewModal: React.FC<LabelPreviewModalProps> = ({ item, onClose }) => {
    // Adapter for display
    const data = {
        PNDesc: item.PNDesc || item.Description,
        HL: item.HL?.toString() || '',
        Code: item.Code,
        Color: item.Color || '',
        Price: item.ListPrice?.toFixed(2) || '0.00',
        SKU: item.SKU
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-dark-bg border border-dark-border p-6 rounded-2xl max-w-lg w-full relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <ScanBarcode className="w-5 h-5 text-purple-400" /> Label Preview
                </h2>
                <p className="text-sm text-gray-500 mb-6">Visual representation of the 40x30mm label.</p>

                {/* VISUAL REPRESENTATION (Scaled 10x CSS) */}
                <div className="w-[400px] h-[300px] bg-white text-black mx-auto rounded-md overflow-hidden relative shadow-white/10 shadow-2xl select-none">

                    {/* 1. PNDesc (Centered Top) */}
                    <div className="absolute top-2 w-full text-center font-sans text-[28px] font-medium leading-none px-4 whitespace-nowrap overflow-hidden text-ellipsis">
                        {data.PNDesc}
                    </div>

                    {/* 2. SKU & Color (Left Side) - SWAPPED: SKU is now here */}
                    <div className="absolute top-12 left-5 flex flex-col items-start leading-none">
                        <div className="text-[34px] font-bold tracking-tight origin-left" style={{ transform: 'scale(0.85)' }}>
                            {data.SKU}
                        </div>
                        <div className="text-[26px] font-medium text-[#444] mt-1">{data.Color}</div>
                    </div>

                    {/* 3. Price (Right Side) */}
                    <div className="absolute top-12 right-5 flex items-start leading-none">
                        {parseFloat(data.Price) < 100 && (
                            <span className="text-[30px] font-bold mt-1 mr-1">$</span>
                        )}
                        <span className="text-[58px] font-extrabold tracking-tighter">{data.Price}</span>
                    </div>

                    {/* 4. Barcode Area */}
                    <div className="absolute top-[135px] left-5 w-[360px] h-[100px] overflow-hidden">
                        <BarcodeVisual value={data.SKU} />
                    </div>

                    {/* 5. Code & HL (Bottom) - SWAPPED: Code is now here */}
                    <div className="absolute bottom-3 left-6 text-[28px] font-bold font-sans tracking-tight">
                        {data.Code}
                    </div>
                    <div className="absolute bottom-3 right-6 text-[26px] font-bold font-mono">
                        {data.HL}
                    </div>

                    {/* Rulers for visual reference */}
                    <div className="absolute top-0 -right-6 h-full flex flex-col justify-between text-[10px] text-gray-500 py-1 rotate-180 font-mono pointer-events-none opacity-50">
                        <span>0</span><span>30mm</span>
                    </div>
                    <div className="absolute -bottom-6 left-0 w-full flex justify-between text-[10px] text-gray-500 px-1 font-mono pointer-events-none opacity-50">
                        <span>0</span><span>40mm</span>
                    </div>
                </div>

                <div className="mt-8 flex justify-center">
                    <button onClick={onClose} className="px-8 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors">
                        Close Preview
                    </button>
                </div>
            </div>
        </div>
    );
};

export const BarcodeManager: React.FC<BarcodeManagerProps> = ({ queue, setQueue, printerConfig }) => {
    const [previewItem, setPreviewItem] = useState<InventoryItem | null>(null);
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);
    const { success, error, info } = useToast();

    const handleClearQueue = () => {
        setIsConfirmingClear(true);
    };

    const confirmClearQueue = () => {
        setQueue([]);
        setIsConfirmingClear(false);
        info("Queue cleared.");
    };

    const handleRemoveItem = (index: number) => {
        setQueue(prev => prev.filter((_, i) => i !== index));
    };

    const updateQty = (index: number, newQty: number) => {
        // Enforce max 2 digits (0-99)
        const safeQty = Math.max(0, Math.min(99, newQty));
        setQueue(prev => {
            const next = [...prev];
            next[index] = { ...next[index], printQty: safeQty };
            return next;
        });
    };

    const handlePrintQueue = async () => {
        if (!printerConfig.labelPrinter) {
            error("No Label Printer configured. Please go to Settings.");
            return;
        }

        if (queue.length === 0) {
            info("Queue is empty.");
            return;
        }

        // execute batch print
        const successResult = await printBarcodeQueue(printerConfig, queue);
        if (successResult) {
            success(`Sent ${queue.length} types of labels to printer.`);
        }
    };

    return (
        <div className="h-full flex flex-col p-8 space-y-6 max-w-7xl mx-auto">

            {previewItem && (
                <LabelPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
            )}

            {/* Clear Queue Confirmation Modal */}
            {isConfirmingClear && (
                <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4 text-red-400">
                            <AlertCircle className="w-6 h-6" />
                            <h3 className="font-bold">Clear Queue</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">Are you sure you want to remove all {queue.length} items from the print queue? This action cannot be undone.</p>

                        <div className="flex gap-2">
                            <button onClick={confirmClearQueue} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm">Clear All</button>
                            <button onClick={() => setIsConfirmingClear(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ScanBarcode className="w-8 h-8 text-gemini-400" />
                        Barcode Print Queue
                    </h1>
                    <p className="text-gray-400 mt-1">Manage and print product labels.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleClearQueue}
                        disabled={queue.length === 0}
                        className="px-5 py-2.5 bg-dark-surface border border-dark-border hover:bg-red-900/20 hover:border-red-800 text-gray-300 hover:text-red-400 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" /> Clear
                    </button>
                    <button
                        onClick={handlePrintQueue}
                        disabled={queue.length === 0}
                        className="px-8 py-2.5 bg-gemini-600 hover:bg-gemini-500 text-white rounded-xl font-bold shadow-lg shadow-gemini-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Printer className="w-5 h-5" /> Print
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="flex-1 bg-dark-surface border border-dark-border rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-dark-bg text-gray-500 text-xs uppercase sticky top-0 z-10 shadow-sm border-b border-dark-border">
                            <tr>
                                <th className="p-4 font-bold w-12 text-center">#</th>
                                <th className="p-4 font-bold w-32">Code</th>
                                <th className="p-4 font-bold w-32">SKU</th>
                                <th className="p-4 font-bold w-24 text-right">Price</th>
                                <th className="p-4 font-bold w-24 text-right">HL</th>
                                <th className="p-4 font-bold w-32">Color</th> {/* New Color Column */}
                                <th className="p-4 font-bold">Barcode Name</th> {/* Renamed from Barcode Name (PNDesc) */}
                                <th className="p-4 font-bold w-80 text-center">Quantity</th>
                                <th className="p-4 font-bold w-24 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/30 text-sm text-gray-300">
                            {queue.length === 0 ? (
                                <tr>
                                    <td colSpan={9}> {/* Updated colspan */}
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                            <Box className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-lg font-medium">Queue is empty</p>
                                            <p className="text-xs mt-1">Add items from the IMS Inventory page</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                queue.map((item, idx) => (
                                    <tr key={`${item.Code}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-center font-mono text-gray-500">{idx + 1}</td>
                                        <td className="p-4 font-bold text-white">{item.Code}</td>
                                        <td className="p-4 font-mono text-gemini-400">{item.SKU}</td>
                                        <td className="p-4 text-right font-mono">${item.ListPrice?.toFixed(2)}</td>
                                        <td className="p-4 text-right font-mono">{item.HL}</td>
                                        <td className="p-4 text-gray-300">{item.Color || '-'}</td> {/* Color Value */}
                                        <td className="p-4 text-gray-400">{item.PNDesc || '-'}</td>
                                        {/* QUANTITY CONTROL */}
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => updateQty(idx, Math.max(0, (item.printQty || 0) - 1))}
                                                    className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <div className="w-10 text-center font-mono font-bold text-white text-lg">
                                                    {item.printQty || 0}
                                                </div>
                                                <button
                                                    onClick={() => updateQty(idx, (item.printQty || 0) + 1)}
                                                    className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>

                                                <div className="w-px h-6 bg-gray-700 mx-2"></div>

                                                {/* Clear Button */}
                                                <button
                                                    onClick={() => updateQty(idx, 0)}
                                                    className="w-8 h-8 flex items-center justify-center bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded text-red-400 font-bold text-xs transition-colors"
                                                    title="Clear (Set to 0)"
                                                >
                                                    C
                                                </button>

                                                {/* Step 4 Button */}
                                                <button
                                                    onClick={() => updateQty(idx, (item.printQty || 0) + 4)}
                                                    className="w-8 h-8 flex items-center justify-center bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded text-purple-400 font-bold text-xs transition-colors"
                                                    title="Add 4"
                                                >
                                                    +4
                                                </button>

                                                {/* Step 6 Button */}
                                                <button
                                                    onClick={() => updateQty(idx, (item.printQty || 0) + 6)}
                                                    className="w-8 h-8 flex items-center justify-center bg-green-900/30 hover:bg-green-900/50 border border-green-500/30 rounded text-green-400 font-bold text-xs transition-colors"
                                                    title="Add 6"
                                                >
                                                    +6
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setPreviewItem(item)}
                                                    className="p-2 text-blue-400 hover:text-white hover:bg-blue-600/20 rounded-lg transition-colors"
                                                    title="Preview Label"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Remove from queue"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Stats */}
            <div className="bg-dark-bg border border-dark-border rounded-xl p-4 flex justify-between items-center text-sm text-gray-400">
                <div>
                    Total Items: <span className="font-bold text-white">{queue.length}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    Total Labels: <span className="font-bold text-white">{queue.reduce((acc, i) => acc + (i.printQty ?? 0), 0)}</span>
                </div>
                <div className="text-xs">
                    Printer: <span className="text-gemini-400 font-bold">{printerConfig.labelPrinter || 'Not Configured'}</span>
                </div>
            </div>
        </div>
    );
};