import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Plus, Trash2, Save, RefreshCcw, Package, AlertCircle, TestTube } from 'lucide-react';
import { ManufactureOrder, ManufactureOrderItem, InventoryItem, AppMode } from '../types';
import { manufactureOrderService } from '../services/manufactureOrderService';
import { ppiService } from '../services/ppiService';
import { coreService } from '../services/coreService';
import { useToast } from '../hooks/useToast';

interface ManufactureHubProps {
    googleScriptUrl: string;
    appMode: AppMode;
}

interface OrderRow {
    id: string;
    productCode: string;
    bomCode: string;
    qtyBom: number;
    quantityProduced: number;
}

// Product Code Selector Component
const ProductCodeSelector = ({
    value,
    onChange,
    allCodes,
    ppiData,
    placeholder
}: {
    value: string;
    onChange: (val: string) => void;
    allCodes: string[];
    ppiData: Array<{ code: string; bom: string }>;
    placeholder?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        if (!isOpen) setFilter(value || '');
    }, [value, isOpen]);

    // Update dropdown position when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            const dropdownHeight = 300; // Approximate max height of dropdown
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            // Show above if not enough space below
            const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

            setDropdownPosition({
                top: showAbove
                    ? rect.top + window.scrollY - dropdownHeight - 2
                    : rect.bottom + window.scrollY + 2,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    const normalizeString = (str: string): string => {
        return str.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const filteredOptions = useMemo(() => {
        if (!isOpen) return [];

        // If no filter, show first 50 codes
        if (!filter) {
            const result = allCodes.slice(0, 50);
            console.log(`📋 No filter - showing ${result.length} codes from ${allCodes.length} total`);
            return result;
        }

        const normalizedFilter = normalizeString(filter);

        // Search in both code and bom columns, use Set to avoid duplicates
        const matchingCodes = new Set<string>();

        ppiData.forEach(item => {
            const normalizedCode = normalizeString(item.code);
            const normalizedBom = normalizeString(item.bom);

            // Match either code or bom
            if (normalizedCode.includes(normalizedFilter) || normalizedBom.includes(normalizedFilter)) {
                matchingCodes.add(item.code);
            }
        });

        // Convert Set to Array, sort, and limit to 50
        const result = Array.from(matchingCodes).sort().slice(0, 50);

        console.log(`🔍 Filter "${filter}" - found ${result.length} matches (searched in Code & BOM)`);
        return result;
    }, [allCodes, filter, isOpen]);

    // Debug: Log when allCodes changes
    useEffect(() => {
        console.log(`📦 ProductCodeSelector received ${allCodes.length} codes`);
    }, [allCodes]);

    // Dropdown content to be rendered via Portal
    const dropdownContent = isOpen && (
        <>
            {filteredOptions.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                        maxWidth: '400px',
                        zIndex: 99999
                    }}
                    className="bg-dark-surface border-2 border-blue-500 rounded-lg shadow-2xl max-h-60 overflow-y-auto custom-scrollbar"
                >
                    <div className="sticky top-0 bg-dark-bg border-b-2 border-blue-500/50 px-3 py-2 text-xs text-blue-400 font-bold">
                        {filteredOptions.length} matches {allCodes.length > 0 && `(${allCodes.length} total)`}
                    </div>
                    {filteredOptions.map(code => (
                        <div
                            key={code}
                            onClick={() => {
                                console.log(`✅ Selected: ${code}`);
                                onChange(code);
                                setFilter(code);
                                setIsOpen(false);
                            }}
                            className="px-4 py-2 text-sm text-white hover:bg-blue-600 cursor-pointer transition-colors font-mono bg-dark-surface"
                        >
                            {code}
                        </div>
                    ))}
                </div>
            )}

            {allCodes.length === 0 && (
                <div
                    style={{
                        position: 'fixed',
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                        zIndex: 99999
                    }}
                    className="bg-dark-surface border-2 border-orange-500 rounded-lg shadow-2xl px-4 py-3 text-sm text-orange-400 text-center font-bold"
                >
                    ⚠️ No product codes available.
                </div>
            )}

            {filter && filteredOptions.length === 0 && allCodes.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                        zIndex: 99999
                    }}
                    className="bg-dark-surface border-2 border-blue-500 rounded-lg shadow-2xl px-4 py-3 text-sm text-gray-400 text-center"
                >
                    No matching codes for "{filter}"
                </div>
            )}
        </>
    );

    return (
        <div className="relative" ref={containerRef}>
            <input
                ref={inputRef}
                type="text"
                value={isOpen ? filter : value}
                onChange={(e) => {
                    setFilter(e.target.value);
                    onChange(e.target.value.toUpperCase());
                    if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => {
                    console.log('🎯 Input focused, opening dropdown');
                    setFilter('');
                    setIsOpen(true);
                }}
                className="w-full bg-dark-bg border border-dark-border focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase outline-none"
                placeholder={placeholder}
            />
            <ChevronDown className={`absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />

            {/* Render dropdown using Portal */}
            {typeof document !== 'undefined' && ReactDOM.createPortal(
                dropdownContent,
                document.body
            )}
        </div>
    );
};

export const ManufactureHub: React.FC<ManufactureHubProps> = ({ googleScriptUrl, appMode }) => {
    const toast = useToast();

    const [selectedOrderId, setSelectedOrderId] = useState<string>('NEW');
    const [currentOrderId, setCurrentOrderId] = useState<string>('');
    const [orders, setOrders] = useState<ManufactureOrder[]>([]);
    const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [availableProductCodes, setAvailableProductCodes] = useState<string[]>([]);
    const [ppiData, setPpiData] = useState<Array<{ code: string; bom: string }>>([]);

    // LocalStorage keys
    const STORAGE_KEY_ORDER_ROWS = 'manufacture_hub_order_rows';
    const STORAGE_KEY_ORDER_ID = 'manufacture_hub_current_order_id';

    // Load available product codes from PPI table
    useEffect(() => {
        loadAvailableProductCodes();
    }, []);

    const loadAvailableProductCodes = async () => {
        try {
            console.log('🔍 Loading product codes from PPI table...');
            const ppiRecords = await ppiService.fetchAll();
            console.log(`📊 Fetched ${ppiRecords.length} PPI records`);

            if (ppiRecords.length === 0) {
                console.warn('⚠️ PPI table is empty! No products available for manufacturing.');
                toast.error('PPI table is empty. Please add BOM data first.');
                setAvailableProductCodes([]);
                setPpiData([]);
                return;
            }

            // Store full PPI data for searching (code and bom)
            const fullData = ppiRecords.map(r => ({
                code: r.code,
                bom: r.bom
            }));
            setPpiData(fullData);

            // Get unique product codes from PPI table
            const uniqueCodes = Array.from(new Set(ppiRecords.map(record => record.code)))
                .filter(code => code && code.trim() !== '')
                .sort();

            console.log(`✅ Loaded ${uniqueCodes.length} unique product codes:`, uniqueCodes.slice(0, 10));
            setAvailableProductCodes(uniqueCodes);

            if (uniqueCodes.length === 0) {
                toast.error('No valid product codes found in PPI table');
            }
        } catch (error) {
            console.error('❌ Error loading product codes from PPI:', error);
            toast.error('Failed to load product codes from PPI table');
            setAvailableProductCodes([]);
            setPpiData([]);
        }
    };

    // Generate order ID on mount and restore from localStorage
    useEffect(() => {
        console.log('🔄 Initializing Manufacture Hub...');
        // Try to restore from localStorage first
        const savedOrderId = localStorage.getItem(STORAGE_KEY_ORDER_ID);
        const savedRows = localStorage.getItem(STORAGE_KEY_ORDER_ROWS);

        console.log('📂 Checking localStorage:', { savedOrderId, savedRowsLength: savedRows?.length });

        if (savedOrderId && savedRows) {
            // Restore saved state
            setCurrentOrderId(savedOrderId);
            try {
                const parsedRows = JSON.parse(savedRows);
                setOrderRows(parsedRows);
                console.log(`✅ Restored ${parsedRows.length} rows from localStorage`);
            } catch (error) {
                console.error('❌ Failed to parse saved rows:', error);
                // Generate new order ID if restore fails
                const orderId = manufactureOrderService.generateOrderId();
                setCurrentOrderId(orderId);
            }
        } else {
            // Generate new order ID
            console.log('🆕 No saved data, generating new order ID');
            const orderId = manufactureOrderService.generateOrderId();
            setCurrentOrderId(orderId);
        }
    }, []);

    // Save orderRows to localStorage whenever they change
    useEffect(() => {
        if (currentOrderId) { // Only save if we have an order ID
            console.log(`💾 Saving ${orderRows.length} rows to localStorage`);
            localStorage.setItem(STORAGE_KEY_ORDER_ROWS, JSON.stringify(orderRows));
            localStorage.setItem(STORAGE_KEY_ORDER_ID, currentOrderId);
        }
    }, [orderRows, currentOrderId]);

    // Load all orders
    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        setIsLoading(true);
        try {
            const fetchedOrders = await manufactureOrderService.fetchAllOrders();
            setOrders(fetchedOrders);
        } catch (error) {
            console.error('Error loading orders:', error);
            toast.error('Failed to load manufacture orders');
        } finally {
            setIsLoading(false);
        }
    };

    // Load order details when selecting an existing order
    const previousOrderIdRef = useRef<string | null>(null);
    useEffect(() => {
        // Skip if this is the first time (previousOrderIdRef is null)
        if (previousOrderIdRef.current === null) {
            console.log('🆕 First mount, skipping order change logic');
            previousOrderIdRef.current = selectedOrderId;
            return;
        }

        // Only clear/load if the order ID actually changed
        if (previousOrderIdRef.current !== selectedOrderId) {
            console.log(`🔄 Order changed from ${previousOrderIdRef.current} to ${selectedOrderId}`);
            previousOrderIdRef.current = selectedOrderId;

            if (selectedOrderId === 'NEW') {
                console.log('🔄 Switched to NEW order, clearing rows');
                setOrderRows([]);
            } else {
                console.log(`🔄 Loading order: ${selectedOrderId}`);
                loadOrderDetails(selectedOrderId);
            }
        }
    }, [selectedOrderId]);

    const loadOrderDetails = async (orderId: string) => {
        setIsLoading(true);
        try {
            const order = await manufactureOrderService.fetchOrderById(orderId);
            if (order && order.items) {
                const rows: OrderRow[] = order.items.map((item, index) => ({
                    id: `${item.id || index}`,
                    productCode: item.product_code,
                    bomCode: item.bom_code,
                    qtyBom: item.qty_bom,
                    quantityProduced: item.quantity_produced
                }));
                setOrderRows(rows);
            }
        } catch (error) {
            console.error('Error loading order details:', error);
            toast.error('Failed to load order details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProductCodeChange = async (rowId: string, code: string) => {
        setOrderRows(prev => prev.map(row => {
            if (row.id === rowId) {
                return { ...row, productCode: code };
            }
            return row;
        }));

        // Fetch BOM data from PPI
        if (code) {
            try {
                const ppiRecords = await ppiService.fetchByCode(code);
                if (ppiRecords && ppiRecords.length > 0) {
                    const firstRecord = ppiRecords[0];
                    setOrderRows(prev => prev.map(row => {
                        if (row.id === rowId) {
                            return {
                                ...row,
                                bomCode: firstRecord.bom,
                                qtyBom: firstRecord.qty_bom
                            };
                        }
                        return row;
                    }));
                } else {
                    // Clear BOM if no record found
                    setOrderRows(prev => prev.map(row => {
                        if (row.id === rowId) {
                            return { ...row, bomCode: '', qtyBom: 1 };
                        }
                        return row;
                    }));
                }
            } catch (error) {
                console.error('Error fetching BOM data:', error);
            }
        }
    };

    const handleAddRow = () => {
        const newRow: OrderRow = {
            id: `new-${Date.now()}`,
            productCode: '',
            bomCode: '',
            qtyBom: 1,
            quantityProduced: 1
        };
        setOrderRows(prev => [...prev, newRow]);
    };

    const handleDeleteRow = (rowId: string) => {
        setOrderRows(prev => prev.filter(row => row.id !== rowId));
    };

    const handleQuantityChange = (rowId: string, quantity: number) => {
        setOrderRows(prev => prev.map(row => {
            if (row.id === rowId) {
                // Allow 0-99, no minimum of 1
                return { ...row, quantityProduced: Math.max(0, Math.min(99, quantity)) };
            }
            return row;
        }));
    };

    const handleSaveOrder = async () => {
        // Filter out empty rows and rows with quantity = 0
        const validRows = orderRows.filter(row =>
            row.productCode &&
            row.productCode.trim() !== '' &&
            row.quantityProduced > 0
        );

        // Validation
        if (validRows.length === 0) {
            toast.error('Please add at least one product with valid Product Code and Quantity > 0');
            return;
        }

        // Check if all valid rows have BOM data
        const invalidRows = validRows.filter(row => !row.bomCode);
        if (invalidRows.length > 0) {
            toast.error(`${invalidRows.length} product(s) missing BOM data. Please select valid products.`);
            return;
        }

        // Show info if we filtered out rows
        const emptyRows = orderRows.filter(row => !row.productCode || row.productCode.trim() === '');
        const zeroQtyRows = orderRows.filter(row => row.productCode && row.quantityProduced === 0);

        if (emptyRows.length > 0 || zeroQtyRows.length > 0) {
            const messages = [];
            if (emptyRows.length > 0) messages.push(`${emptyRows.length} empty row(s)`);
            if (zeroQtyRows.length > 0) messages.push(`${zeroQtyRows.length} row(s) with quantity 0`);
            toast.info(`Skipped ${messages.join(' and ')}`);
        }

        setIsSaving(true);
        try {
            // 1. Save to Supabase manufacture_orders table
            const items = validRows.map(row => ({
                product_code: row.productCode,
                bom_code: row.bomCode,
                qty_bom: row.qtyBom,
                quantity_produced: row.quantityProduced
            }));

            await manufactureOrderService.createOrder(currentOrderId, items);

            // 2. Update Core database inventory (ONLY in Normal mode)
            if (appMode === 'Normal') {
                for (const row of validRows) {
                    await updateInventory(row);
                }
                toast.success(`Manufacture order ${currentOrderId} completed successfully!`);
            } else {
                toast.success(`🧪 TEST MODE: Order ${currentOrderId} saved to database only (inventory not updated)`);
            }

            // Reset and reload
            setOrderRows([]);
            // Clear localStorage
            localStorage.removeItem(STORAGE_KEY_ORDER_ROWS);
            localStorage.removeItem(STORAGE_KEY_ORDER_ID);
            await loadOrders();

            // Generate new order ID
            const newOrderId = manufactureOrderService.generateOrderId();
            setCurrentOrderId(newOrderId);
            setSelectedOrderId('NEW');

        } catch (error) {
            console.error('Error saving manufacture order:', error);
            toast.error('Failed to save manufacture order');
        } finally {
            setIsSaving(false);
        }
    };

    const updateInventory = async (row: OrderRow) => {
        try {
            const cachedData = (window as any).__CORE_DATA_CACHE__ || [];

            // Update manufactured product (increase stock)
            const productItem = cachedData.find((item: InventoryItem) => item.Code === row.productCode);
            if (productItem) {
                const updatedProduct = {
                    ...productItem,
                    Qty: productItem.Qty + row.quantityProduced,
                    Stock: productItem.Stock + row.quantityProduced,
                    Comment: manufactureOrderService.updateComment(productItem.Comment || '', currentOrderId)
                };
                await coreService.updateProductWithSync(updatedProduct, googleScriptUrl);
                console.log(`✅ Updated product ${row.productCode}: +${row.quantityProduced} stock`);
            }

            // Update BOM material (decrease stock, increase sold)
            const bomItem = cachedData.find((item: InventoryItem) => item.Code === row.bomCode);
            if (bomItem) {
                const totalUsed = row.qtyBom * row.quantityProduced;
                const updatedBom = {
                    ...bomItem,
                    Stock: bomItem.Stock - totalUsed,
                    Sold: bomItem.Sold + totalUsed,
                    Comment: manufactureOrderService.updateComment(bomItem.Comment || '', currentOrderId)
                };
                await coreService.updateProductWithSync(updatedBom, googleScriptUrl);
                console.log(`✅ Updated BOM ${row.bomCode}: -${totalUsed} stock, +${totalUsed} sold`);
            }
        } catch (error) {
            console.error(`Error updating inventory for ${row.productCode}:`, error);
            throw error;
        }
    };

    return (
        <div className="h-full flex flex-col bg-dark-bg">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-b border-dark-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Package className="w-8 h-8 text-blue-400" />
                        <div>
                            <h1 className="text-2xl font-bold text-white">Manufacture Hub</h1>
                            <p className="text-sm text-gray-400">Manage manufacturing orders and inventory</p>
                        </div>
                    </div>

                    {/* Order Selector */}
                    <div className="flex items-center gap-4">
                        {/* Test Mode Indicator */}
                        {appMode === 'Test' && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg">
                                <TestTube className="w-4 h-4 text-orange-400" />
                                <span className="text-xs font-bold text-orange-400 uppercase">Test Mode</span>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-400 uppercase">Order</label>
                            <select
                                value={selectedOrderId}
                                onChange={(e) => setSelectedOrderId(e.target.value)}
                                className="bg-dark-surface border border-dark-border rounded-lg px-4 py-2 text-sm text-white focus:border-blue-500 outline-none min-w-[200px]"
                                disabled={isLoading}
                            >
                                <option value="NEW">🆕 New Manufacture Order</option>
                                {orders.map(order => (
                                    <option key={order.order_id} value={order.order_id}>
                                        {order.order_id} ({order.items?.length || 0} items)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedOrderId === 'NEW' && (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-400 uppercase">Order ID</label>
                                <div className="bg-dark-surface border border-blue-500 rounded-lg px-4 py-2 text-sm text-blue-400 font-mono font-bold">
                                    {currentOrderId}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col p-6" style={{ overflowY: 'hidden', overflowX: 'hidden' }}>
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-3 text-gray-400">Loading...</span>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-dark-surface rounded-xl border border-dark-border" style={{ overflow: 'visible' }}>
                        {/* Table */}
                        <div className="flex-1" style={{ overflowX: 'auto', overflowY: 'auto' }}>
                            <table className="w-full">
                                <thead className="bg-dark-bg border-b border-dark-border sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Product Code</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">BOM Code</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Qty/Unit</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Qty Produced</th>
                                        {selectedOrderId === 'NEW' && (
                                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase w-20">Action</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={selectedOrderId === 'NEW' ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                                                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p>No items in this order</p>
                                                {selectedOrderId === 'NEW' && (
                                                    <button
                                                        onClick={handleAddRow}
                                                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 mx-auto"
                                                    >
                                                        <Plus className="w-4 h-4" /> Add First Item
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        orderRows.map((row, index) => (
                                            <tr key={row.id} className="border-b border-dark-border hover:bg-dark-bg/50">
                                                <td className="px-4 py-3 relative align-top">
                                                    {selectedOrderId === 'NEW' ? (
                                                        <ProductCodeSelector
                                                            value={row.productCode}
                                                            onChange={(code) => handleProductCodeChange(row.id, code)}
                                                            allCodes={availableProductCodes}
                                                            ppiData={ppiData}
                                                            placeholder="Search product..."
                                                        />
                                                    ) : (
                                                        <span className="text-white font-mono">{row.productCode}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-yellow-400 font-mono">{row.bomCode || '-'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-green-400 font-bold">{row.qtyBom}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {selectedOrderId === 'NEW' ? (
                                                        <div className="flex justify-center items-center gap-1">
                                                            {/* Minus Button */}
                                                            <button
                                                                onClick={() => {
                                                                    const newVal = Math.max(0, row.quantityProduced - 1);
                                                                    handleQuantityChange(row.id, newVal);
                                                                }}
                                                                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold flex items-center justify-center transition-colors"
                                                                title="Decrease"
                                                            >
                                                                −
                                                            </button>

                                                            {/* Input Field */}
                                                            <input
                                                                type="text"
                                                                value={row.quantityProduced}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    // Allow empty or valid numbers (including 0)
                                                                    if (val === '' || /^\d+$/.test(val)) {
                                                                        const num = val === '' ? 0 : parseInt(val);
                                                                        if (num <= 99) {
                                                                            handleQuantityChange(row.id, num);
                                                                        }
                                                                    }
                                                                }}
                                                                onFocus={(e) => {
                                                                    // Select all text on focus for easy replacement
                                                                    e.target.select();
                                                                }}
                                                                onBlur={(e) => {
                                                                    // If empty on blur, set to 0
                                                                    if (e.target.value === '') {
                                                                        handleQuantityChange(row.id, 0);
                                                                    }
                                                                }}
                                                                className={`w-16 border rounded-lg px-2 py-1 text-sm text-center outline-none font-bold ${row.quantityProduced === 0
                                                                    ? 'bg-red-900/30 border-red-500 text-red-400'
                                                                    : 'bg-dark-bg border-dark-border text-white focus:border-blue-500'
                                                                    }`}
                                                                placeholder="0"
                                                            />

                                                            {/* Plus Button */}
                                                            <button
                                                                onClick={() => {
                                                                    const newVal = Math.min(99, row.quantityProduced + 1);
                                                                    handleQuantityChange(row.id, newVal);
                                                                }}
                                                                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold flex items-center justify-center transition-colors"
                                                                title="Increase"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-white font-bold">{row.quantityProduced}</span>
                                                    )}
                                                </td>
                                                {selectedOrderId === 'NEW' && (
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleDeleteRow(row.id)}
                                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Delete row"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            {selectedOrderId === 'NEW' && orderRows.length > 0 && (
                <div className="p-6 border-t border-dark-border bg-dark-surface flex justify-between items-center gap-3">
                    <button
                        onClick={handleAddRow}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                    >
                        <Plus className="w-5 h-5" /> Add Another Product
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setOrderRows([]);
                                localStorage.removeItem(STORAGE_KEY_ORDER_ROWS);
                                localStorage.removeItem(STORAGE_KEY_ORDER_ID);
                            }}
                            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
                            disabled={isSaving}
                        >
                            Clear All
                        </button>
                        <button
                            onClick={handleSaveOrder}
                            disabled={isSaving}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCcw className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Complete Order
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )
            }
        </div >
    );
};
