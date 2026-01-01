
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem, CsvFile } from '../types';
import { processRawData } from '../services/dataProcessor';
import { CLUSTER_COLORS, findClosestClusterColor } from '../services/colorUtils';
import { synonymService } from '../services/synonymService';
import { Save, PlusCircle, RotateCcw, ChevronDown } from 'lucide-react';
import { coreService } from '../services/coreService';
import * as db from '../services/db';
import { useToast } from '../hooks/useToast';
import { ppiService } from '../services/ppiService';

interface AddProductProps {
    files?: CsvFile[];
    onSave: (item: InventoryItem) => Promise<void>;
}

// Supplier List
const SUPPLIERS = ['AB', 'EL', 'FB', 'FI', 'GF', 'HT', 'JM', 'RE', 'WD', 'GR', 'ST', 'JN', 'LL', 'CN'];

// Supplier Char Mapping for SKU
const SU_MAP: Record<string, string> = {
    'AB': 'A', 'EL': 'E', 'FB': 'B', 'FI': 'I', 'GF': 'G', 'HT': 'T', 'JM': 'M',
    'RE': 'R', 'WD': 'W', 'GR': 'P', 'ST': 'S', 'JN': 'P', 'LL': 'L', 'CN': 'C'
};

const CATEGORIES = ['Trees', 'Plants', 'Flowers', 'Greenery', 'Arrangements', 'Baskets', 'Peripheral'];

// --- HELPER: Searchable Dropdown (Used for SubCat & Color) ---
const SearchableSelect = ({
    label,
    value,
    onChange,
    options,
    placeholder,
    required = false
}: {
    label: string,
    value: string,
    onChange: (val: string) => void,
    options: string[],
    placeholder?: string,
    required?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

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

    const filteredOptions = useMemo(() => {
        if (!filter || !isOpen) return options;
        return options.filter(o => o.toLowerCase().includes(filter.toLowerCase()));
    }, [options, filter, isOpen]);

    return (
        <div className="flex flex-col gap-1 relative" ref={containerRef}>
            <label className="text-xs font-bold text-gray-500 uppercase">{label} {required && <span className="text-red-500">*</span>}</label>
            <div className="relative">
                <input
                    type="text"
                    value={isOpen ? filter : value}
                    onChange={(e) => {
                        setFilter(e.target.value);
                        onChange(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => {
                        setFilter('');
                        setIsOpen(true);
                    }}
                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors placeholder-gray-600"
                    placeholder={placeholder}
                />
                <ChevronDown className={`absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && filteredOptions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredOptions.map(opt => (
                        <div
                            key={opt}
                            onClick={() => {
                                onChange(opt);
                                setFilter(opt);
                                setIsOpen(false);
                            }}
                            className="px-4 py-2 text-sm text-gray-300 hover:bg-gemini-600 hover:text-white cursor-pointer transition-colors"
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- HELPER: BOM Code Selector with Smart Search from Core Database ---
const BomCodeSelector = ({
    label,
    value,
    onChange,
    allCodes,
    placeholder,
    currentProductCode
}: {
    label: string,
    value: string,
    onChange: (val: string) => void,
    allCodes: string[],
    placeholder?: string,
    currentProductCode?: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Normalize string for comparison (remove punctuation, lowercase)
    const normalizeString = (str: string): string => {
        return str.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const filteredOptions = useMemo(() => {
        if (!filter || !isOpen) return allCodes.slice(0, 50); // Show first 50 if no filter

        const normalizedFilter = normalizeString(filter);

        return allCodes
            .filter(code => {
                // Exclude current product code
                if (currentProductCode && code === currentProductCode) return false;

                const normalizedCode = normalizeString(code);
                return normalizedCode.includes(normalizedFilter);
            })
            .slice(0, 50); // Limit to 50 results for performance
    }, [allCodes, filter, isOpen, currentProductCode]);

    return (
        <div className="flex flex-col gap-1 relative" ref={containerRef}>
            <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    value={isOpen ? filter : value}
                    onChange={(e) => {
                        setFilter(e.target.value);
                        onChange(e.target.value.toUpperCase());
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => {
                        setFilter('');
                        setIsOpen(true);
                    }}
                    className="w-full bg-dark-bg border border-dark-border focus:border-yellow-500 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase outline-none transition-colors placeholder-gray-600"
                    placeholder={placeholder}
                />
                <ChevronDown className={`absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && filteredOptions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-dark-surface border border-yellow-500/50 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    <div className="sticky top-0 bg-dark-surface border-b border-dark-border px-3 py-2 text-xs text-gray-400">
                        {filteredOptions.length} matches found {filter && `for "${filter}"`}
                    </div>
                    {filteredOptions.map(code => (
                        <div
                            key={code}
                            onClick={() => {
                                onChange(code);
                                setFilter(code);
                                setIsOpen(false);
                            }}
                            className="px-4 py-2 text-sm text-gray-300 hover:bg-yellow-600 hover:text-white cursor-pointer transition-colors font-mono"
                        >
                            {code}
                        </div>
                    ))}
                </div>
            )}

            {isOpen && filter && filteredOptions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-yellow-500/50 rounded-lg shadow-2xl z-50 px-4 py-3 text-sm text-gray-500 text-center">
                    No matching codes found
                </div>
            )}
        </div>
    );
};

export const AddProduct: React.FC<AddProductProps> = ({ files = [], onSave }) => {
    const toast = useToast();  // Toast hook

    const emptyItem: InventoryItem = {
        Code: '', SU: '', SKU: '', Barcode: '', Description: '',
        NetCost: 0, DiscRate: 0, FinalCost: 0, RefPrice: 0, ListPrice: 0, SalePrice: 0,
        Stock: 0, Sold: 0, Qty: 0, HL: 0, Category: '', SubCat: '', StockStatus: '',
        Location: '', Color: '', ClusterColor: '', Model: '', PNDesc: '', Comment: '',
        CatCode: '',
        _id: 0
    };

    const [formData, setFormData] = useState<InventoryItem>(emptyItem);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Price-related states
    const [netCost, setNetCost] = useState<number>(0);
    const [discRate, setDiscRate] = useState<number>(0);
    const [finalCost, setFinalCost] = useState<number>(0);
    const [refPrice, setRefPrice] = useState<number>(0);
    const [salePrice, setSalePrice] = useState<number | null>(null); // null when no special price
    const [per, setPer] = useState<number>(1);

    // BOM-related states (for LL supplier only)
    const [bom, setBom] = useState<string>('');
    const [qtyBom, setQtyBom] = useState<number>(1);

    // Get all product codes from Core database for BOM selection
    const allProductCodes = useMemo(() => {
        return coreService.getAllProductCodes();
    }, []);

    // --- Derived Data from CatCode CSV (not Core files) ---
    const allColors = useMemo(() => {
        const data = processRawData(files);
        const colors = new Set<string>();
        data.forEach(item => {
            if (item.Color) colors.add(item.Color);
        });
        return Array.from(colors).sort();
    }, [files]);

    // Get Categories from CatCode CSV
    const categories = useMemo(() => {
        return synonymService.getCategories();
    }, []);

    // Get SubCategories for selected Category from CatCode CSV
    const activeSubCats = useMemo(() => {
        if (!formData.Category) return [];
        return synonymService.getSubCategories(formData.Category);
    }, [formData.Category]);

    // --- Logic 1: Auto-Cluster Color ---
    useEffect(() => {
        if (formData.Color) {
            const autoCluster = findClosestClusterColor(formData.Color);
            if (autoCluster) {
                setFormData(p => ({ ...p, ClusterColor: autoCluster }));
            }
        }
    }, [formData.Color]);

    // --- Logic 2: CATCODE Lookup ---
    useEffect(() => {
        if (formData.Category && formData.SubCat) {
            // Use the NEW dedicated CatCode lookup logic
            const code = synonymService.findCatCode(formData.Category, formData.SubCat);
            setFormData(p => ({ ...p, CatCode: code }));
        }
    }, [formData.Category, formData.SubCat]);

    // --- Logic 3: SKU Generation ---
    useEffect(() => {
        const suChar = SU_MAP[formData.SU] || '';
        const catCode = formData.CatCode || '';
        const model = formData.Model || '';

        // Strict check: SU valid, CatCode present, Model exactly 5 digits
        if (suChar && catCode && model.length === 5) {
            setFormData(p => ({ ...p, SKU: `${suChar}${catCode}${model}` }));
        } else {
            // Clear SKU if invalid to avoid confusion
            setFormData(p => ({ ...p, SKU: '' }));
        }
    }, [formData.SU, formData.CatCode, formData.Model]);

    // --- Logic 4: Price Calculations ---
    useEffect(() => {
        if (netCost >= 0 && discRate >= 0) {
            const calculated = netCost * (1 - discRate / 100);
            setFinalCost(Number(calculated.toFixed(2)));
        }
    }, [netCost, discRate]);

    useEffect(() => {
        if (finalCost >= 0) {
            const calculated = finalCost * 2.5;
            setRefPrice(Number(calculated.toFixed(2)));
        }
    }, [finalCost]);


    const handleChange = (field: keyof InventoryItem, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleProductCodeChange = (val: string) => {
        // Allow A-Z, 0-9, -, . and convert to Upper
        const clean = val.toUpperCase().replace(/[^A-Z0-9.-]/g, '');
        handleChange('Code', clean);
    };

    const handlePriceChange = (val: string) => {
        // Regex for currency (max 2 decimals)
        if (/^\d*\.?\d{0,2}$/.test(val)) {
            handleChange('ListPrice', val); // Store as string momentarily for input, but type is number in state usually
        }
    };

    const handleModelChange = (val: string) => {
        // Max 5 digits, numbers only
        const clean = val.replace(/[^0-9]/g, '');
        if (clean.length <= 5) {
            handleChange('Model', clean);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalPrice = parseFloat(String(formData.ListPrice));

        // Validate required fields
        const requiredFields: (keyof InventoryItem)[] = [
            'Code', 'Description', 'SU', 'PNDesc',
            'Category', 'SubCat', 'Color', 'ClusterColor',
            'Model', 'HL'
        ];

        const missing = requiredFields.filter(field => !formData[field]);
        if (isNaN(finalPrice) || finalPrice <= 0) missing.push('ListPrice' as any);

        if (missing.length > 0) {
            toast.warning(`Missing required fields: ${missing.join(', ')}`);
            return;
        }

        setIsSubmitting(true);
        try {
            // Prepare complete product data
            // Generate Comment with current date + A
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const autoComment = `${year}-${month}-${day}A`;

            const productData: InventoryItem = {
                ...formData,
                ListPrice: finalPrice,
                NetCost: netCost,
                DiscRate: discRate,
                FinalCost: finalCost,
                RefPrice: refPrice,
                SalePrice: salePrice || 0,
                PNLen: (formData.PNDesc || '').length,
                Per: per,
                Qty: 0,
                Stock: 0,
                Sold: 0,
                AttColor: formData.Color,
                Cluster: formData.ClusterColor,  // Map ClusterColor to Cluster
                ModelCode: formData.Model,
                Location: '',
                Comment: autoComment  // Auto-generated date + A
            };

            // Call the onSave prop which should handle the full workflow
            await onSave(productData);

            // Sync BOM data if supplier is LL and BOM fields are filled
            if (formData.SU === 'LL' && bom) {
                const bomQty = qtyBom || 1;
                await ppiService.syncProductBom(formData.Code, bom, bomQty);
                console.log(`✅ BOM synced: ${formData.Code} -> ${bom} (${bomQty})`);
            }

            // Reset form
            setFormData(emptyItem);
            setNetCost(0);
            setDiscRate(0);
            setFinalCost(0);
            setRefPrice(0);
            setSalePrice(null); // Reset to null
            setPer(1);
            setBom('');
            setQtyBom(1);

            toast.success('Product created successfully!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to create product');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto h-full p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <div className="glass-panel border border-dark-border rounded-2xl p-6 shadow-2xl relative">

                {/* Header & Create Button */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gemini-600/20 rounded-xl flex items-center justify-center text-gemini-400">
                            <PlusCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Add New Product</h1>
                            <p className="text-sm text-gray-400">Manually add item to master inventory.</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setFormData(emptyItem)}
                            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors px-4"
                        >
                            <RotateCcw className="w-3 h-3" /> Reset Form
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-gemini-600 hover:bg-gemini-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-5 h-5" />
                            {isSubmitting ? 'Saving...' : 'Create Product'}
                        </button>
                    </div>
                </div>

                <form className="space-y-4">

                    {/* === ZONE 1: Identity & Classification === */}
                    <div className="bg-dark-bg/30 p-4 rounded-xl border border-dark-border/50 space-y-4">
                        <h3 className="text-sm font-bold text-gemini-400 uppercase flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-gemini-400"></span> Product Identity
                        </h3>

                        {/* ROW 1: Code, Price, SU, Barcode */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Product Code <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.Code}
                                    onChange={(e) => handleProductCodeChange(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase"
                                    placeholder="e.g. 30.123.45"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">List Price ($) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    value={formData.ListPrice === 0 ? '' : formData.ListPrice}
                                    onChange={(e) => handlePriceChange(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white appearance-none"
                                    placeholder="0.00"
                                />
                                <style>{`input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }`}</style>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Supplier Code <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <select
                                        value={formData.SU}
                                        onChange={(e) => handleChange('SU', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white appearance-none"
                                    >
                                        <option value="">-- Select --</option>
                                        {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Barcode (EAN/UPC)</label>
                                <input
                                    type="text"
                                    value={formData.Barcode}
                                    onChange={(e) => handleChange('Barcode', e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Scan..."
                                />
                            </div>
                        </div>

                        {/* ROW 2: Description, Barcode Name, Per */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="md:w-1/2 flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Description <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.Description}
                                    onChange={(e) => handleChange('Description', e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Full product description..."
                                />
                            </div>
                            <div className="md:w-1/3 flex flex-col gap-1">
                                <div className="flex justify-between">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Barcode Name <span className="text-red-500">*</span></label>
                                    <span className={`text-[10px] ${String(formData.PNDesc || '').length > 30 ? 'text-red-400' : 'text-gray-600'}`}>
                                        {String(formData.PNDesc || '').length} chars
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={formData.PNDesc || ''}
                                    onChange={(e) => handleChange('PNDesc', e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Short name for label..."
                                />
                            </div>
                            <div className="md:w-1/6 flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Per</label>
                                <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={per}
                                    onChange={(e) => setPer(parseInt(e.target.value) || 1)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="1"
                                />
                            </div>
                        </div>

                        {/* ROW 3: Category, Sub, Color, Cluster */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Category <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <select
                                        value={formData.Category}
                                        onChange={(e) => handleChange('Category', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white appearance-none"
                                    >
                                        <option value="">-- Select --</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            <SearchableSelect
                                label="Sub Category"
                                value={formData.SubCat}
                                onChange={(v) => handleChange('SubCat', v)}
                                options={activeSubCats}
                                placeholder="Filter..."
                                required={true}
                            />

                            <SearchableSelect
                                label="Color"
                                value={formData.Color || ''}
                                onChange={(v) => handleChange('Color', v)}
                                options={allColors}
                                placeholder="Detail Color"
                                required={true}
                            />

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Cluster Color <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <select
                                        value={formData.ClusterColor}
                                        onChange={(e) => handleChange('ClusterColor', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border focus:border-purple-500 rounded-lg px-3 py-2 text-sm text-purple-300 font-bold appearance-none"
                                    >
                                        <option value="">-- Auto --</option>
                                        {CLUSTER_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* ROW 4: CatCode, Model, SKU, Height */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Cat Code</label>
                                <input
                                    type="text"
                                    value={formData.CatCode || ''}
                                    readOnly
                                    className="w-full bg-black/40 border border-dark-border rounded-lg px-3 py-2 text-sm text-gray-400 font-mono text-center cursor-not-allowed"
                                    placeholder="Auto"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Model (5 Digits) <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.Model || ''}
                                    onChange={(e) => handleModelChange(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white font-mono text-center tracking-widest"
                                    placeholder="00000"
                                    maxLength={5}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">SKU (Auto)</label>
                                <input
                                    type="text"
                                    value={formData.SKU}
                                    readOnly
                                    className="w-full bg-purple-900/20 border border-purple-500/50 rounded-lg px-3 py-2 text-sm text-purple-300 font-bold font-mono text-center"
                                    placeholder="Generated..."
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Height (HL) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    value={formData.HL || ''}
                                    onChange={(e) => handleChange('HL', parseFloat(e.target.value))}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="cm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* === ZONE 2: PRICING === */}
                    <div className="bg-dark-bg/30 p-4 rounded-xl border border-dark-border/50 space-y-4">
                        <h3 className="text-sm font-bold text-green-400 uppercase flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-green-400"></span> Pricing Details
                        </h3>

                        {/* ROW 1: Net Cost, Disc Rate, Final Cost */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Net Cost ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={netCost === 0 ? '' : netCost}
                                    onChange={(e) => setNetCost(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Disc Rate (%)</label>
                                <input
                                    type="number"
                                    step="1"
                                    value={discRate === 0 ? '' : discRate}
                                    onChange={(e) => setDiscRate(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="0"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Final Cost (Calc)</label>
                                <input
                                    type="number"
                                    value={finalCost}
                                    readOnly
                                    className="w-full bg-black/40 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-green-300 font-bold cursor-not-allowed"
                                    placeholder="Auto"
                                />
                            </div>
                        </div>

                        {/* ROW 2: Ref Price, List Price, Sale Price */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Ref Price (Calc)</label>
                                <input
                                    type="number"
                                    value={refPrice}
                                    readOnly
                                    className="w-full bg-black/40 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-green-300 font-bold cursor-not-allowed"
                                    placeholder="Auto"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">List Price ($) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.ListPrice === 0 ? '' : formData.ListPrice}
                                    onChange={(e) => handlePriceChange(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Sale Price ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={salePrice === null ? '' : salePrice}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSalePrice(val === '' ? null : parseFloat(val) || null);
                                    }}
                                    className="w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="Leave empty if no sale"
                                />
                            </div>
                        </div>


                    </div>

                    {/* === ZONE 3: BOM (Bill of Materials) - Only for LL Supplier === */}
                    {formData.SU === 'LL' && (
                        <div className="bg-dark-bg/30 p-4 rounded-xl border border-yellow-500/50 space-y-4">
                            <h3 className="text-sm font-bold text-yellow-400 uppercase flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-yellow-400"></span> Bill of Materials (BOM)
                            </h3>
                            <p className="text-xs text-gray-400 mb-3">
                                Define the raw materials needed to manufacture this product. Both fields must be filled together.
                            </p>

                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <BomCodeSelector
                                        label="Raw Material Code (BOM)"
                                        value={bom}
                                        onChange={setBom}
                                        allCodes={allProductCodes}
                                        placeholder="Type to search..."
                                        currentProductCode={formData.Code}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Quantity Required</label>
                                    <div className="flex items-center gap-2">
                                        {/* Minus Button */}
                                        <button
                                            type="button"
                                            onClick={() => setQtyBom(Math.max(1, qtyBom - 1))}
                                            className="w-12 h-12 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-2xl flex items-center justify-center transition-colors"
                                            title="Decrease"
                                        >
                                            −
                                        </button>

                                        {/* Number Display */}
                                        <div className="w-20 h-12 bg-dark-bg border-2 border-yellow-500 rounded-lg flex items-center justify-center">
                                            <span className="text-2xl font-bold text-yellow-400">{qtyBom}</span>
                                        </div>

                                        {/* Plus Button */}
                                        <button
                                            type="button"
                                            onClick={() => setQtyBom(Math.min(9, qtyBom + 1))}
                                            className="w-12 h-12 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-2xl flex items-center justify-center transition-colors"
                                            title="Increase"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </form>
            </div>
        </div>
    );
};
