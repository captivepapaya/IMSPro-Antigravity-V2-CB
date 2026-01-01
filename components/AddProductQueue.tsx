import React, { useState, useEffect, useMemo } from 'react';
import { AddProductQueueItem, InventoryItem, CsvFile } from '../types';
import * as db from '../services/db';
import { processRawData } from '../services/dataProcessor';
import { Trash2, Package, RefreshCw, ScanBarcode, Edit3, CheckSquare, Square, X, Printer, Globe } from 'lucide-react';
import { printBarcodeQueue, encodeCode128B } from '../services/printService';
import { PrinterConfig } from '../types';

interface AddProductQueueProps {
    files: CsvFile[];
    onAddToBarcodeQueue: (items: InventoryItem[]) => void;
    onAddToWpQueue: (items: InventoryItem[]) => void;
    printerConfig: PrinterConfig;
}

// --- DUPLICATED VISUAL COMPONENTS (To be refactored) ---
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
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <ScanBarcode className="w-5 h-5 text-purple-400" /> Label Preview
                </h2>
                <div className="w-[400px] h-[300px] bg-white text-black mx-auto mt-6 rounded-md overflow-hidden relative shadow-white/10 shadow-2xl select-none">
                    <div className="absolute top-2 w-full text-center font-sans text-[28px] font-medium leading-none px-4 whitespace-nowrap overflow-hidden text-ellipsis">
                        {data.PNDesc}
                    </div>
                    <div className="absolute top-12 left-5 flex flex-col items-start leading-none">
                        <div className="text-[34px] font-bold tracking-tight origin-left" style={{ transform: 'scale(0.85)' }}>
                            {data.SKU}
                        </div>
                        <div className="text-[26px] font-medium text-[#444] mt-1">{data.Color}</div>
                    </div>
                    <div className="absolute top-12 right-5 flex items-start leading-none">
                        <span className="text-[30px] font-bold mt-1 mr-1">$</span>
                        <span className="text-[58px] font-extrabold tracking-tighter">{data.Price}</span>
                    </div>
                    <div className="absolute top-[135px] left-5 w-[360px] h-[100px] overflow-hidden">
                        <BarcodeVisual value={data.SKU} />
                    </div>
                    <div className="absolute bottom-3 left-6 text-[28px] font-bold font-sans tracking-tight">
                        {data.Code}
                    </div>
                    <div className="absolute bottom-3 right-6 text-[26px] font-bold font-mono">
                        {data.HL}
                    </div>
                </div>
                <div className="mt-8 flex justify-center text-gray-400 text-sm">
                    Print command sent...
                </div>
            </div>
        </div>
    );
};

export const AddProductQueue: React.FC<AddProductQueueProps> = ({ files, onAddToBarcodeQueue, onAddToWpQueue, printerConfig }) => {
    const [queueItems, setQueueItems] = useState<AddProductQueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [previewItem, setPreviewItem] = useState<InventoryItem | null>(null);

    // Memoize inventory lookup map for performance
    const inventoryMap = useMemo(() => {
        const data = processRawData(files);
        const map = new Map<string, InventoryItem>();
        data.forEach(item => {
            if (item.Code) map.set(item.Code, item);
        });
        return map;
    }, [files]);

    // Load queue on mount
    useEffect(() => {
        loadQueue();
    }, []);

    const loadQueue = async () => {
        setIsLoading(true);
        try {
            const items = await db.getAddProductQueue();
            setQueueItems(items);
            setSelectedIds(new Set()); // Clear selection on reload
        } catch (e) {
            console.error('Failed to load queue', e);
            alert('❌ Failed to load product queue');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Remove this product from the queue?')) return;

        try {
            const success = await db.removeFromProductQueue(id);
            if (success) {
                setQueueItems(prev => prev.filter(item => item.id !== id));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                alert('✅ Removed from queue');
            } else {
                alert('❌ Failed to remove from queue');
            }
        } catch (e) {
            console.error('Failed to delete', e);
            alert('❌ Failed to remove from queue');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === queueItems.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(queueItems.map(i => i.id!).filter(Boolean));
            setSelectedIds(allIds);
        }
    };

    const toggleSelectRow = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getFullItemData = (queueItem: AddProductQueueItem): any => {
        const fullItem = inventoryMap.get(queueItem.code);

        if (fullItem) {
            return {
                ...fullItem,
                Qty: 1 // For printing label logic
            };
        }

        // Fallback if not found in current loaded files
        console.warn(`Item ${queueItem.code} not found in loaded inventory files.`);
        return {
            Code: queueItem.code,
            SKU: queueItem.sku,
            Description: queueItem.description,
            Barcode: queueItem.sku,
            PNDesc: queueItem.description, // Fallback
            HL: 0,
            ListPrice: 0,
            Qty: 1
        };
    };

    const handleBatchLabel = () => {
        const selected = queueItems.filter(i => i.id && selectedIds.has(i.id));
        if (selected.length === 0) return;

        const barcodeItems = selected.map(item => getFullItemData(item));

        onAddToBarcodeQueue(barcodeItems);
        setSelectedIds(new Set());
    };

    const handlePublishSingle = (item: AddProductQueueItem) => {
        const fullItem = getFullItemData(item);
        if (fullItem) {
            onAddToWpQueue([fullItem]);
        }
    };

    const handleBatchPublish = () => {
        const selectedItems = queueItems
            .filter(item => selectedIds.has(item.id!))
            .map(item => getFullItemData(item))
            .filter((item): item is InventoryItem => item !== null);

        if (selectedItems.length > 0) {
            onAddToWpQueue(selectedItems);
        }
    };

    const handleDirectPrint = async (item: AddProductQueueItem) => {
        const barcodeItem = getFullItemData(item);

        // 1. Show Preview
        setPreviewItem(barcodeItem);

        // 2. Print Command
        if (!printerConfig.labelPrinter) {
            alert("❌ No Label Printer Configured!");
            return;
        }

        // Default qty 1 for this direct print action
        barcodeItem.printQty = 1;

        await printBarcodeQueue(printerConfig, [barcodeItem]);

        // Auto close after 2 seconds? Or let user close.
        setTimeout(() => setPreviewItem(null), 2000);
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-8 overflow-hidden">
            <div className="glass-panel border border-dark-border rounded-2xl p-8 shadow-2xl flex flex-col h-full">

                {previewItem && (
                    <LabelPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
                )}

                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-dark-border gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center text-purple-400">
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">New Product Queue</h1>
                            <p className="text-sm text-gray-400">Products pending website publication</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Select All */}
                        <button
                            onClick={toggleSelectAll}
                            disabled={queueItems.length === 0}
                            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors text-sm font-bold ${selectedIds.size > 0 && selectedIds.size === queueItems.length
                                ? 'bg-blue-600/20 text-blue-400 border-blue-500'
                                : 'bg-dark-surface text-gray-400 border-dark-border hover:text-white'
                                }`}
                        >
                            {selectedIds.size > 0 && selectedIds.size === queueItems.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            Select All
                        </button>

                        {/* Batch Action: Label */}
                        <button
                            onClick={handleBatchLabel}
                            disabled={selectedIds.size === 0}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-bold"
                            title="Add Selected to Barcode Queue"
                        >
                            <ScanBarcode className="w-4 h-4" />
                            Label
                        </button>

                        {/* Batch Action: Review */}
                        <button
                            onClick={handleBatchPublish}
                            disabled={selectedIds.size === 0}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-bold"
                            title="Add Selected to Product Review Queue"
                        >
                            <Globe className="w-4 h-4" />
                            Review
                        </button>

                        <div className="w-px h-6 bg-dark-border mx-2"></div>

                        <button
                            onClick={loadQueue}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-bold"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Queue Table */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                        </div>
                    ) : queueItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <Package className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg">No products in queue</p>
                            <p className="text-sm mt-2">Products added via New Product will appear here</p>
                        </div>
                    ) : (
                        <div className="overflow-auto custom-scrollbar">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-dark-surface border-b border-dark-border z-10">
                                    <tr>
                                        <th className="py-3 px-4 w-12">
                                            <div
                                                onClick={toggleSelectAll}
                                                className="cursor-pointer text-gray-500 hover:text-white"
                                            >
                                                {selectedIds.size > 0 && selectedIds.size === queueItems.length
                                                    ? <CheckSquare className="w-4 h-4 text-blue-400" />
                                                    : <Square className="w-4 h-4" />
                                                }
                                            </div>
                                        </th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">#</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Code</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">SKU</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Description</th>
                                        <th className="text-center py-3 px-4 text-xs font-bold text-gray-400 uppercase w-48">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queueItems.map((item, idx) => {
                                        const isSelected = item.id ? selectedIds.has(item.id) : false;
                                        return (
                                            <tr
                                                key={item.id}
                                                className={`border-b border-dark-border/50 transition-colors ${isSelected ? 'bg-blue-900/10 hover:bg-blue-900/20' : 'hover:bg-dark-bg/50'}`}
                                            >
                                                <td className="py-3 px-4">
                                                    <div
                                                        onClick={() => item.id && toggleSelectRow(item.id)}
                                                        className="cursor-pointer text-gray-500 hover:text-white"
                                                    >
                                                        {isSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-300">{item.sequence_number}</td>
                                                <td className="py-3 px-4">
                                                    <span className="text-sm font-mono text-purple-400 font-bold">{item.code}</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-sm font-mono text-gray-300">{item.sku}</span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-300">{item.description}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handlePublishSingle(item)}
                                                            className="p-1.5 bg-gray-800 hover:bg-blue-600 rounded-lg text-gray-400 hover:text-white transition-all flex items-center gap-1 px-3"
                                                            title="Add to Product Review Queue"
                                                        >
                                                            <Globe className="w-4 h-4" />
                                                            <span className="text-xs font-bold">Review</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleDirectPrint(item)}
                                                            className="p-1.5 bg-gray-800 hover:bg-purple-600 rounded-lg text-gray-400 hover:text-white transition-all flex items-center gap-1 px-3"
                                                            title="Direct Print Label"
                                                        >
                                                            <Printer className="w-4 h-4" />
                                                            <span className="text-xs font-bold">Print</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleDelete(item.id!)}
                                                            className="p-1.5 bg-gray-800 hover:bg-red-600 rounded-lg text-gray-400 hover:text-white transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Stats */}
                {!isLoading && queueItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dark-border text-sm text-gray-400 flex justify-between items-center">
                        <div>
                            Total: <span className="text-white font-bold">{queueItems.length}</span> product(s) in queue
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="text-blue-400 font-bold">
                                {selectedIds.size} selected
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
