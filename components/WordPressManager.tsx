import React, { useState, useEffect } from 'react';
import { InventoryItem, WordPressConfig } from '../types';
import { Globe, Trash2, Edit3, Image as ImageIcon, Box, RefreshCcw } from 'lucide-react';
import { fetchWpProductStatus, fetchWpProductBySku } from '../services/wpService';
import { ProductEditModal } from './ProductEditModal';
import * as db from '../services/db';
import { coreService } from '../services/coreService';

interface WordPressManagerProps {
    queue: InventoryItem[];
    setQueue: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    wpConfig: WordPressConfig;
}

const DbStatusDisplay = ({ item }: { item: InventoryItem }) => {
    const [dbStatus, setDbStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDbStatus = async () => {
            setLoading(true);
            try {
                // Fetch from Supabase
                const supabaseItems = await coreService.fetchCoreFromSupabase();
                const foundItem = supabaseItems.find((i: InventoryItem) => i.Code === item.Code);
                setDbStatus(foundItem?.PostStatus || null);
            } catch (error) {
                console.error('Error fetching DB status:', error);
                setDbStatus(null);
            } finally {
                setLoading(false);
            }
        };

        if (item.Code) {
            fetchDbStatus();
        }
    }, [item.Code]);

    if (loading) return <RefreshCcw className="w-4 h-4 animate-spin text-gray-500" />;

    return (
        <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${dbStatus === 'publish' ? 'bg-green-900/20 text-green-400' :
                dbStatus === 'draft' ? 'bg-yellow-900/20 text-yellow-400' :
                    'bg-gray-800 text-gray-500'
                }`}>
                {dbStatus || 'Not Set'}
            </div>
        </div>
    );
};

export const WordPressManager: React.FC<WordPressManagerProps> = ({ queue, setQueue, wpConfig }) => {
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isLoadingQueue, setIsLoadingQueue] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Load queue from Supabase
    const loadQueueFromSupabase = async () => {
        console.log('🔵 WordPressManager: Loading queue from Supabase');
        setIsLoadingQueue(true);
        try {
            const queueItems = await db.getProductReviewQueue();
            console.log('🔵 WordPressManager: Loaded queue items:', queueItems);

            // Fetch WordPress info for each item
            const inventoryItems: InventoryItem[] = await Promise.all(
                queueItems.map(async (item) => {
                    // Try to fetch WordPress product info by SKU
                    const wpProduct = await fetchWpProductBySku(item.sku, wpConfig);

                    if (wpProduct) {
                        console.log(`🔵 Found WP product for ${item.sku}:`, wpProduct);
                        return {
                            Code: item.code,
                            SKU: item.sku,
                            Description: item.description,
                            PostID: wpProduct.id.toString(),
                            PostStatus: wpProduct.status,
                            ProductPage: wpProduct.permalink,
                            // Add default values for other required fields
                            SU: '',
                            Barcode: '',
                            HL: 0,
                            Qty: 0,
                            Stock: 0,
                            Sold: 0,
                            Location: '',
                            Comment: '',
                            Category: '',
                            SubCat: '',
                            NetCost: 0,
                            DiscRate: 0,
                            FinalCost: 0,
                            RefPrice: 0,
                            ListPrice: 0,
                            SalePrice: 0,
                            StockStatus: ''
                        };
                    } else {
                        console.log(`🔵 No WP product found for ${item.sku}`);
                        return {
                            Code: item.code,
                            SKU: item.sku,
                            Description: item.description,
                            SU: '',
                            Barcode: '',
                            HL: 0,
                            Qty: 0,
                            Stock: 0,
                            Sold: 0,
                            Location: '',
                            Comment: '',
                            Category: '',
                            SubCat: '',
                            NetCost: 0,
                            DiscRate: 0,
                            FinalCost: 0,
                            RefPrice: 0,
                            ListPrice: 0,
                            SalePrice: 0,
                            StockStatus: ''
                        };
                    }
                })
            );

            setQueue(inventoryItems);
            console.log('🔵 WordPressManager: Queue loaded successfully, count:', inventoryItems.length);
        } catch (e) {
            console.error('❌ WordPressManager: Failed to load queue:', e);
        } finally {
            setIsLoadingQueue(false);
        }
    };

    // Load on mount
    useEffect(() => {
        loadQueueFromSupabase();
    }, []); // Only run on mount

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;

        if (window.confirm(`Are you sure you want to delete ${selectedIds.size} selected item(s) from the queue?`)) {
            try {
                // Get all queue items from Supabase
                const queueItems = await db.getProductReviewQueue();

                // Delete selected items from Supabase
                for (const code of selectedIds) {
                    const queueItem = queueItems.find(qi => qi.code === code);
                    if (queueItem && queueItem.id) {
                        await db.removeFromProductReviewQueue(queueItem.id);
                    }
                }

                // Update local state - remove selected items
                const newQueue = queue.filter(item => !selectedIds.has(item.Code));
                setQueue(newQueue);
                setSelectedIds(new Set()); // Clear selection
                console.log(`✅ Deleted ${selectedIds.size} items from queue`);
            } catch (e) {
                console.error('❌ Failed to delete selected items:', e);
                alert('Failed to delete items from database');
            }
        }
    };

    const handleRemoveItem = async (index: number) => {
        const item = queue[index];
        if (!item || !item.SKU) {
            console.error('❌ Cannot remove item: missing SKU');
            return;
        }

        try {
            console.log('🗑️ Removing item from queue:', item.SKU);

            // Get queue items to find the ID by SKU
            const queueItems = await db.getProductReviewQueue();
            const queueItem = queueItems.find(qi => qi.sku === item.SKU);

            if (queueItem && queueItem.id) {
                // Delete from Supabase
                const success = await db.removeFromProductReviewQueue(queueItem.id);

                if (success) {
                    // Remove from local state
                    setQueue(prev => prev.filter((_, i) => i !== index));
                    console.log('✅ Item removed from queue:', item.SKU);
                } else {
                    console.error('❌ Failed to remove from Supabase');
                    alert('Failed to remove item from database');
                }
            } else {
                console.warn('⚠️ Item not found in Supabase, removing from local state only');
                setQueue(prev => prev.filter((_, i) => i !== index));
            }
        } catch (e) {
            console.error('❌ Error removing item:', e);
            alert('Failed to remove item');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === queue.length && queue.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(queue.map(item => item.Code)));
        }
    };

    const toggleSelectRow = (code: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(code)) {
            newSet.delete(code);
        } else {
            newSet.add(code);
        }
        setSelectedIds(newSet);
    };

    const handleBatchPublish = () => {
        // TODO: Implement batch publish to WordPress
        console.log('Publishing selected items:', Array.from(selectedIds));
        alert(`Publishing ${selectedIds.size} items to WordPress (功能待实现)`);
    };

    const handlePublishSingle = (item: InventoryItem) => {
        // TODO: Implement single publish to WordPress
        console.log('Publishing item:', item.Code);
        alert(`Publishing ${item.Code} to WordPress (功能待实现)`);
    };

    return (
        <div className="h-full flex flex-col p-8 space-y-6 max-w-7xl mx-auto">

            {editingItem && (
                <ProductEditModal
                    item={editingItem}
                    wpConfig={wpConfig}
                    onClose={() => setEditingItem(null)}
                />
            )}

            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Globe className="w-8 h-8 text-blue-400" />
                            Product Review Queue
                        </h1>
                        <p className="text-gray-400 mt-1">Manage and sync products to your WooCommerce store.</p>
                    </div>
                    <button
                        onClick={loadQueueFromSupabase}
                        disabled={isLoadingQueue}
                        className="px-5 py-2.5 bg-dark-surface border border-dark-border hover:bg-blue-900/20 hover:border-blue-800 text-gray-300 hover:text-blue-400 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <RefreshCcw className={`w-4 h-4 ${isLoadingQueue ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleBatchPublish}
                        disabled={selectedIds.size === 0}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl font-bold transition-all disabled:cursor-not-allowed flex items-center gap-2"
                        title="Publish selected items to WordPress"
                    >
                        <Globe className="w-4 h-4" /> Publish ({selectedIds.size})
                    </button>
                    <button
                        onClick={handleDeleteSelected}
                        disabled={selectedIds.size === 0}
                        className="px-5 py-2.5 bg-dark-surface border border-dark-border hover:bg-red-900/20 hover:border-red-800 text-gray-300 hover:text-red-400 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title="Delete selected items from queue"
                    >
                        <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="flex-1 bg-dark-surface border border-dark-border rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-dark-bg text-gray-500 text-xs uppercase sticky top-0 z-10 shadow-sm border-b border-dark-border">
                            <tr>
                                <th className="p-4 font-bold w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === queue.length && queue.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                    />
                                </th>
                                <th className="p-4 font-bold w-12 text-center">#</th>
                                <th className="p-4 font-bold w-24">Post ID</th>
                                <th className="p-4 font-bold w-32">Post Status</th>
                                <th className="p-4 font-bold w-40">DB Status</th>
                                <th className="p-4 font-bold w-28">Code</th>
                                <th className="p-4 font-bold w-32">SKU</th>
                                <th className="p-4 font-bold">Description</th>
                                <th className="p-4 font-bold w-48 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/30 text-sm text-gray-300">
                            {isLoadingQueue ? (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                            <RefreshCcw className="w-12 h-12 mb-4 animate-spin text-blue-400" />
                                            <p className="text-lg font-medium">Loading queue from database...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : queue.length === 0 ? (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                            <Box className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-lg font-medium">WordPress queue is empty</p>
                                            <p className="text-xs mt-1">Add items from the IMS Inventory page</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                queue.map((item, idx) => (
                                    <tr key={`${item.Code}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item.Code)}
                                                onChange={() => toggleSelectRow(item.Code)}
                                                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-4 text-center font-mono text-gray-500">{idx + 1}</td>
                                        <td className="p-4 font-mono text-gray-400">{item.PostID || '-'}</td>
                                        <td className="p-4">
                                            <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.PostStatus === 'publish' ? 'bg-green-900/20 text-green-400' :
                                                item.PostStatus === 'draft' ? 'bg-yellow-900/20 text-yellow-400' :
                                                    'bg-gray-800 text-gray-500'
                                                }`}>
                                                {item.PostStatus || 'Not Published'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <DbStatusDisplay item={item} />
                                        </td>
                                        <td className="p-4 font-bold text-white">{item.Code}</td>
                                        <td className="p-4 font-mono text-gemini-400">{item.SKU}</td>
                                        <td className="p-4 text-gray-400 leading-relaxed max-w-sm truncate">{item.Description}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="p-2 bg-gray-800 hover:bg-red-600 rounded-lg text-gray-400 hover:text-white transition-all flex items-center gap-1 text-xs"
                                                    title="Remove from queue"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                                </button>
                                                <button
                                                    onClick={() => setEditingItem(item)}
                                                    className="p-2 bg-gray-800 hover:bg-gemini-600 rounded-lg text-gray-400 hover:text-white transition-all flex items-center gap-1 text-xs"
                                                    title="Edit and sync"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handlePublishSingle(item)}
                                                    className="p-2 bg-gray-800 hover:bg-green-600 rounded-lg text-gray-400 hover:text-white transition-all flex items-center gap-1 text-xs"
                                                    title="Publish to WordPress"
                                                >
                                                    <Globe className="w-3.5 h-3.5" /> Publish
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
                    Total Pending: <span className="font-bold text-white">{queue.length}</span>
                </div>
                <div className="text-xs">
                    Target Site: <span className="text-blue-400 font-bold">{wpConfig.url}</span>
                </div>
            </div>
        </div >
    );
};
