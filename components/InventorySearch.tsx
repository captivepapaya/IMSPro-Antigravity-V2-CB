import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CsvFile, InventoryItem, FilterParams, WordPressConfig } from '../types';
import { Search, Download, ArrowUpDown, X, Play, Square, CheckSquare, Circle, CheckCircle, RotateCcw, PackageCheck, Settings, DollarSign, ArrowUp, ArrowDown, Filter, Plus, Minus, ChevronDown, Edit3, Image, Save, Layers, Eye, EyeOff, ScanBarcode, Keyboard, Globe, Wand2 } from 'lucide-react';
import { saveSetting, getSetting } from '../services/db';
import { processRawData, searchInventory } from '../services/dataProcessor';
import { fetchWpImage } from '../services/wpService';
import { AlphanumericKeypad } from './AlphanumericKeypad';
import { synonymService } from '../services/synonymService';
import { findClosestClusterColor } from '../services/colorUtils';
import { ppiService } from '../services/ppiService';
import { coreService } from '../services/coreService';

interface InventorySearchProps {
  files: CsvFile[];
  wpConfig: WordPressConfig;
  onUpdateItem: (item: InventoryItem) => void;
  onAddToBarcodeQueue: (items: InventoryItem[]) => void;
  onAddToWpQueue: (items: InventoryItem[]) => void;
  onOpenVCA?: (item: InventoryItem) => void;
}

// --- 1. HELPER: Generic Text Field (Defined Outside) ---
const Field = ({ label, value, onChange, type = "text", readOnly = false }: any) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      readOnly={readOnly}
      className={`w-full bg-dark-bg border ${readOnly ? 'border-transparent text-gray-500' : 'border-dark-border focus:border-gemini-500'} rounded-xl px-4 py-3 text-base text-white outline-none transition-colors shadow-sm`}
    />
  </div>
);

// --- 2. HELPER: Smart Number Input (Fixes "0" glitch & focus issues) ---
const SmartNumberInput = ({
  label,
  value,
  onChange,
  isFloat = false,
  center = false
}: {
  label: string,
  value: number,
  onChange: (val: number) => void,
  isFloat?: boolean,
  center?: boolean
}) => {
  // We keep a local string state to allow "empty" or "decimal ending" states while typing
  const [localStr, setLocalStr] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from parent ONLY if we are NOT focusing this input
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalStr(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalStr(v); // Update UI immediately so user sees what they typed (even "")

    if (v === '') {
      onChange(0); // Treat empty as 0 for logic, but keep UI empty
      return;
    }

    const num = parseFloat(v);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  const handleBlur = () => {
    // On blur, format cleanly
    let num = parseFloat(localStr);
    if (isNaN(num)) num = 0;
    setLocalStr(String(num)); // Remove trailing decimals or messy inputs
    onChange(num); // Ensure parent is synced
  };

  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-bold text-gray-500 uppercase ${center ? 'text-center' : ''}`}>{label}</label>
      <input
        ref={inputRef}
        type="number" // Uses browser number pad on mobile
        value={localStr}
        onChange={handleChange}
        onBlur={handleBlur}
        step={isFloat ? "0.01" : "1"}
        className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-xl px-4 py-3 text-lg font-bold text-white outline-none transition-colors shadow-sm ${center ? 'text-center' : 'text-left'}`}
        style={{ appearance: 'textfield' }} // CSS to help hide spinners
      />
      {/* Inline style to hide webkit spinners */}
      <style>{`
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
            `}</style>
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
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
        <span className="text-xs text-gray-600">{value || '-'}</span>
      </div>
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
          className={`w-full bg-dark-bg border border-dark-border focus:border-yellow-500 rounded-lg px-3 py-2 text-sm ${value ? 'text-yellow-400' : 'text-white'} font-mono uppercase font-bold outline-none transition-colors placeholder-gray-600`}
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

// --- 3. HELPER: Edit Modal Component (Full AddProduct-style Layout with Auto-Calculation) ---
const EditItemModal = ({ item, wpConfig, onClose, onSave }: { item: InventoryItem, wpConfig: WordPressConfig, onClose: () => void, onSave: (newItem: InventoryItem) => void }) => {
  // Store original values for comparison
  const originalItem = useMemo(() => ({ ...item }), []);

  // Extract Model from SKU if Model is empty
  const extractedModel = useMemo(() => {
    if (item.Model) return item.Model;
    if (item.SKU && item.SKU.length >= 5) {
      return item.SKU.slice(-5);
    }
    return '';
  }, [item.Model, item.SKU]);

  const [formData, setFormData] = useState<InventoryItem>({
    ...item,
    Model: item.Model || extractedModel
  });
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // BOM-related states (for LL supplier only)
  const [bom, setBom] = useState<string>('');
  const [qtyBom, setQtyBom] = useState<number>(1);
  const [bomLoading, setBomLoading] = useState<boolean>(false);

  // Get all product codes from Core database for BOM selection
  const allProductCodes = useMemo(() => {
    return coreService.getAllProductCodes();
  }, []);

  // Supplier mapping from AddProduct
  const SU_MAP: Record<string, string> = {
    'AB': 'A', 'EL': 'E', 'FB': 'B', 'FI': 'I', 'GF': 'G', 'HT': 'T', 'JM': 'M',
    'RE': 'R', 'WD': 'W', 'GR': 'P', 'ST': 'S', 'JN': 'P', 'LL': 'L', 'CN': 'C'
  };

  const SUPPLIERS = ['AB', 'EL', 'FB', 'FI', 'GF', 'HT', 'JM', 'RE', 'WD', 'GR', 'ST', 'JN', 'LL', 'CN'];

  useEffect(() => {
    let mounted = true;
    if (wpConfig.url && item.SKU) {
      fetchWpImage(item.SKU, wpConfig).then(u => { if (mounted) setImgUrl(u); });
    }
    return () => { mounted = false; };
  }, [item, wpConfig]);

  // Fetch BOM data if supplier is LL
  useEffect(() => {
    const fetchBomData = async () => {
      if (formData.SU === 'LL' && formData.Code) {
        setBomLoading(true);
        try {
          const ppiRecords = await ppiService.fetchByCode(formData.Code);
          if (ppiRecords && ppiRecords.length > 0) {
            // Take the first record (assuming one BOM per product for now)
            const firstRecord = ppiRecords[0];
            setBom(firstRecord.bom);
            setQtyBom(firstRecord.qty_bom);
          }
        } catch (error) {
          console.error('Error fetching BOM data:', error);
        } finally {
          setBomLoading(false);
        }
      }
    };
    fetchBomData();
  }, [formData.SU, formData.Code]);

  // Auto-calculate CatCode based on Category + SubCat
  const calculatedCatCode = useMemo(() => {
    if (formData.Category && formData.SubCat) {
      return synonymService.findCatCode(formData.Category, formData.SubCat);
    }
    return '';
  }, [formData.Category, formData.SubCat]);

  // Auto-calculate SKU based on SU + CatCode + Model
  const calculatedSKU = useMemo(() => {
    const suChar = SU_MAP[formData.SU] || '';
    const catCode = formData.CatCode || '';
    const model = formData.Model || '';

    if (suChar && catCode && model.length === 5) {
      return `${suChar}${catCode}${model}`;
    }
    return '';
  }, [formData.SU, formData.CatCode, formData.Model]);

  // Auto-calculate ClusterColor based on Color
  useEffect(() => {
    if (formData.Color) {
      const autoCluster = findClosestClusterColor(formData.Color);
      if (autoCluster) {
        setFormData(p => ({ ...p, ClusterColor: autoCluster }));
      }
    }
  }, [formData.Color]);

  // Update CatCode when calculated value changes
  useEffect(() => {
    if (calculatedCatCode) {
      setFormData(p => ({ ...p, CatCode: calculatedCatCode }));
    }
  }, [calculatedCatCode]);

  // Update SKU when calculated value changes
  useEffect(() => {
    if (calculatedSKU) {
      setFormData(p => ({ ...p, SKU: calculatedSKU }));
    }
  }, [calculatedSKU]);

  // Get available categories and subcategories
  const categories = useMemo(() => synonymService.getCategories(), []);
  const activeSubCats = useMemo(() => {
    if (!formData.Category) return [];
    return synonymService.getSubCategories(formData.Category);
  }, [formData.Category]);

  // Get all colors from data
  const allColors = useMemo(() => {
    const colors = new Set<string>();
    // This would ideally come from your data source
    // For now, return common colors
    return ['Red', 'Green', 'Blue', 'Yellow', 'Purple', 'Orange', 'Pink', 'White', 'Black', 'Brown', 'Grey', 'Variegated'];
  }, []);

  const handleChange = (field: keyof InventoryItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Inventory linkage: Qty = Stock + Sold
  const handleQtyChange = (newQty: number) => {
    const diff = newQty - formData.Qty;
    setFormData(p => ({
      ...p,
      Qty: newQty,
      Stock: p.Stock + diff  // Stock absorbs the change
    }));
  };

  const handleStockChange = (newStock: number) => {
    const diff = newStock - formData.Stock;
    setFormData(p => ({
      ...p,
      Stock: newStock,
      Sold: Math.max(0, p.Sold - diff)  // Sold adjusts inversely
    }));
  };

  const handleSoldChange = (newSold: number) => {
    const diff = newSold - formData.Sold;
    setFormData(p => ({
      ...p,
      Sold: newSold,
      Stock: Math.max(0, p.Stock - diff)  // Stock adjusts inversely
    }));
  };

  const handleSubmit = async () => {
    // Sync BOM data if supplier is LL
    if (formData.SU === 'LL') {
      try {
        if (bom && qtyBom >= 1) {
          await ppiService.syncProductBom(formData.Code, bom, qtyBom);
          console.log(`✅ BOM synced: ${formData.Code} -> ${bom} (${qtyBom})`);
        } else if (!bom && !qtyBom) {
          // Delete BOM if both fields are empty
          await ppiService.deleteByCode(formData.Code);
          console.log(`✅ BOM deleted for: ${formData.Code}`);
        }
      } catch (error) {
        console.error('Error syncing BOM:', error);
      }
    }

    onSave(formData);
  };

  // Helper to determine if value changed
  const isChanged = (field: keyof InventoryItem) => {
    return formData[field] !== originalItem[field];
  };

  // Helper to get color class
  const getColorClass = (field: keyof InventoryItem) => {
    return isChanged(field) ? 'text-red-400' : 'text-green-400';
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-dark-bg to-dark-surface border-b border-dark-border flex gap-4 items-center">
          <div className="w-20 h-20 bg-black rounded-xl border border-dark-border flex-shrink-0 overflow-hidden flex items-center justify-center shadow-inner">
            {imgUrl ? <img src={imgUrl} className="w-full h-full object-contain" /> : <Image className="w-8 h-8 text-gray-700" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white">Edit Product <span className="text-purple-400 text-lg">[DB Review & Edit]</span></h2>
            <div className="text-sm text-gray-400 font-mono mt-1">{originalItem.Code} / {originalItem.SKU}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

          {/* === ZONE 1: Identity & Classification === */}
          <div className="bg-dark-bg/30 p-4 rounded-xl border border-dark-border/50 space-y-4">
            <h3 className="text-sm font-bold text-gemini-400 uppercase flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-gemini-400"></span> Product Identity
            </h3>

            {/* ROW 1: Code (Read-only), Price, SU, Barcode */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Product Code</label>
                  <span className="text-xs text-gray-600 font-mono">{originalItem.Code}</span>
                </div>
                <input
                  type="text"
                  value={formData.Code}
                  readOnly
                  className="w-full bg-black/40 border border-dark-border rounded-lg px-3 py-2 text-sm text-gray-400 font-mono uppercase cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">List Price ($)</label>
                  <span className="text-xs text-gray-600">${originalItem.ListPrice.toFixed(2)}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ListPrice}
                  onChange={(e) => handleChange('ListPrice', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('ListPrice')} font-bold`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Supplier Code</label>
                  <span className="text-xs text-gray-600">{originalItem.SU}</span>
                </div>
                <select
                  value={formData.SU}
                  onChange={(e) => handleChange('SU', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('SU')} font-bold appearance-none`}
                >
                  <option value="">-- Select --</option>
                  {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Barcode</label>
                  <span className="text-xs text-gray-600">{originalItem.Barcode || '-'}</span>
                </div>
                <input
                  type="text"
                  value={formData.Barcode || ''}
                  onChange={(e) => handleChange('Barcode', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Barcode')} font-bold`}
                />
              </div>
            </div>

            {/* ROW 2: Description, PNDesc */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                  <span className="text-xs text-gray-600 truncate max-w-[200px]">{originalItem.Description}</span>
                </div>
                <input
                  type="text"
                  value={formData.Description}
                  onChange={(e) => handleChange('Description', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Description')} font-bold`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Barcode Name (PNDesc)</label>
                  <span className="text-xs text-gray-600 truncate max-w-[150px]">{originalItem.PNDesc || '-'}</span>
                </div>
                <input
                  type="text"
                  value={formData.PNDesc || ''}
                  onChange={(e) => handleChange('PNDesc', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('PNDesc')} font-bold`}
                />
              </div>
            </div>

            {/* ROW 3: Category, SubCat, Color, ClusterColor */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                  <span className="text-xs text-gray-600">{originalItem.Category}</span>
                </div>
                <select
                  value={formData.Category}
                  onChange={(e) => handleChange('Category', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Category')} font-bold appearance-none`}
                >
                  <option value="">-- Select --</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Sub Category</label>
                  <span className="text-xs text-gray-600">{originalItem.SubCat}</span>
                </div>
                <select
                  value={formData.SubCat}
                  onChange={(e) => handleChange('SubCat', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('SubCat')} font-bold appearance-none`}
                >
                  <option value="">-- Select --</option>
                  {activeSubCats.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Color</label>
                  <span className="text-xs text-gray-600">{originalItem.Color || '-'}</span>
                </div>
                <select
                  value={formData.Color || ''}
                  onChange={(e) => handleChange('Color', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Color')} font-bold appearance-none`}
                >
                  <option value="">-- Select --</option>
                  {allColors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Cluster Color</label>
                  <span className="text-xs text-gray-600">{originalItem.ClusterColor || '-'}</span>
                </div>
                <input
                  type="text"
                  value={formData.ClusterColor || ''}
                  readOnly
                  className="w-full bg-black/40 border border-purple-500/50 rounded-lg px-3 py-2 text-sm text-purple-300 font-bold cursor-not-allowed"
                  placeholder="Auto"
                />
              </div>
            </div>

            {/* ROW 4: CatCode, Model, SKU, Height */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Cat Code</label>
                  <span className="text-xs font-mono text-gray-600">
                    {originalItem.CatCode || '-'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.CatCode || ''}
                    onChange={(e) => handleChange('CatCode', e.target.value)}
                    className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('CatCode')} font-bold font-mono text-center`}
                  />
                  {calculatedCatCode && calculatedCatCode !== formData.CatCode && (
                    <span className="absolute right-2 top-2 text-xs text-yellow-400" title={`Suggested: ${calculatedCatCode}`}>⚠</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Model (5 Digits)</label>
                  <span className="text-xs font-mono text-gray-600">
                    {originalItem.Model || extractedModel || '-'}
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.Model || ''}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    if (clean.length <= 5) handleChange('Model', clean);
                  }}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Model')} font-bold font-mono text-center tracking-widest`}
                  maxLength={5}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">SKU</label>
                  <span className="text-xs font-mono text-gray-600">
                    {originalItem.SKU || '-'}
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.SKU}
                  readOnly
                  className={`w-full bg-purple-900/20 border border-purple-500/50 rounded-lg px-3 py-2 text-sm ${formData.SKU === originalItem.SKU ? 'text-green-400' : 'text-red-400'} font-bold font-mono text-center cursor-not-allowed`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Height (HL)</label>
                  <span className="text-xs text-gray-600">{originalItem.HL || 0}</span>
                </div>
                <input
                  type="number"
                  value={formData.HL || ''}
                  onChange={(e) => handleChange('HL', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-gemini-500 rounded-lg px-3 py-2 text-sm ${getColorClass('HL')} font-bold`}
                />
              </div>
            </div>
          </div>

          {/* === ZONE 2: Inventory === */}
          <div className="bg-dark-bg/30 p-4 rounded-xl border border-dark-border/50 space-y-4">
            <h3 className="text-sm font-bold text-purple-400 uppercase flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span> Inventory (Qty = Stock + Sold)
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Total Qty</label>
                  <span className="text-xs text-gray-600">{originalItem.Qty}</span>
                </div>
                <input
                  type="number"
                  value={formData.Qty}
                  onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-purple-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Qty')} font-bold text-center`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Stock</label>
                  <span className="text-xs text-gray-600">{originalItem.Stock}</span>
                </div>
                <input
                  type="number"
                  value={formData.Stock}
                  onChange={(e) => handleStockChange(parseInt(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-purple-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Stock')} font-bold text-center`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Sold</label>
                  <span className="text-xs text-gray-600">{originalItem.Sold}</span>
                </div>
                <input
                  type="number"
                  value={formData.Sold}
                  onChange={(e) => handleSoldChange(parseInt(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-purple-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Sold')} font-bold text-center`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Location</label>
                  <span className="text-xs text-gray-600">{originalItem.Location || '-'}</span>
                </div>
                <input
                  type="text"
                  value={formData.Location || ''}
                  onChange={(e) => handleChange('Location', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-purple-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Location')} font-bold`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Comment</label>
                  <span className="text-xs text-gray-600">{originalItem.Comment || '-'}</span>
                </div>
                <input
                  type="text"
                  value={formData.Comment || ''}
                  onChange={(e) => handleChange('Comment', e.target.value)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-purple-500 rounded-lg px-3 py-2 text-sm ${getColorClass('Comment')} font-bold`}
                />
              </div>
            </div>
          </div>

          {/* === ZONE 3: Pricing === */}
          <div className="bg-dark-bg/30 p-4 rounded-xl border border-dark-border/50 space-y-4">
            <h3 className="text-sm font-bold text-green-400 uppercase flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> Pricing Details
            </h3>

            {/* ROW 1: Net Cost, Disc Rate, Final Cost */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Net Cost ($)</label>
                  <span className="text-xs text-gray-600">${originalItem.NetCost.toFixed(2)}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.NetCost}
                  onChange={(e) => handleChange('NetCost', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm ${getColorClass('NetCost')} font-bold`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Disc Rate (%)</label>
                  <span className="text-xs text-gray-600">{originalItem.DiscRate}%</span>
                </div>
                <input
                  type="number"
                  value={formData.DiscRate}
                  onChange={(e) => handleChange('DiscRate', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm ${getColorClass('DiscRate')} font-bold`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Final Cost ($)</label>
                  <span className="text-xs text-gray-600">${originalItem.FinalCost.toFixed(2)}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.FinalCost}
                  onChange={(e) => handleChange('FinalCost', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm ${getColorClass('FinalCost')} font-bold`}
                />
              </div>
            </div>

            {/* ROW 2: Ref Price, List Price (read-only copy), Sale Price */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Ref Price ($)</label>
                  <span className="text-xs text-gray-600">${originalItem.RefPrice.toFixed(2)}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.RefPrice}
                  onChange={(e) => handleChange('RefPrice', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm ${getColorClass('RefPrice')} font-bold`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">List Price ($)</label>
                  <span className="text-xs text-gray-600">${originalItem.ListPrice.toFixed(2)}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ListPrice}
                  readOnly
                  className="w-full bg-black/40 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-green-300 font-bold cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Sale Price ($)</label>
                  <span className="text-xs text-gray-600">${originalItem.SalePrice.toFixed(2)}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.SalePrice}
                  onChange={(e) => handleChange('SalePrice', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-dark-bg border border-dark-border focus:border-green-500 rounded-lg px-3 py-2 text-sm ${getColorClass('SalePrice')} font-bold`}
                />
              </div>
            </div>
          </div>

          {/* === ZONE 4: BOM (Bill of Materials) - Only for LL Supplier === */}
          {formData.SU === 'LL' && (
            <div className="bg-dark-bg/30 p-4 rounded-xl border border-yellow-500/50 space-y-4">
              <h3 className="text-sm font-bold text-yellow-400 uppercase flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400"></span> Bill of Materials (BOM)
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Define the raw materials needed to manufacture this product. Both fields must be filled together.
              </p>

              {bomLoading ? (
                <div className="text-center text-gray-500 py-4">Loading BOM data...</div>
              ) : (
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
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-border bg-dark-bg flex gap-3 justify-end">
          <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-8 py-3 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg flex items-center gap-2 transition-transform active:scale-95">
            <Save className="w-5 h-5" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 4. HELPER: Advanced Stepper (Restored for Filters) ---
const AdvancedStepper: React.FC<{ value: number; onChange: (val: number) => void; min?: number; max?: number; prefix?: string; }> = ({ value, onChange, min = 0, max = 1000000, prefix }) => {
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const stopPress = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const handleUpdate = useCallback((direction: 1 | -1, step: number) => {
    const current = valueRef.current ?? 0;
    const next = current + (direction * step);
    const clamped = Math.max(min, Math.min(max, next));
    onChange(clamped);
  }, [min, max, onChange]);

  const startPress = (direction: 1 | -1) => {
    stopPress();
    isHoldingRef.current = false;
    timeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      handleUpdate(direction, 10);
      intervalRef.current = setInterval(() => {
        handleUpdate(direction, 10);
      }, 100);
    }, 500);
  };

  const endPress = (direction: 1 | -1) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isHoldingRef.current) {
      handleUpdate(direction, 1);
    }
    isHoldingRef.current = false;
  };

  useEffect(() => stopPress, [stopPress]);

  return (
    <div className="flex items-center gap-0">
      <div className="flex items-center bg-dark-bg p-0.5 rounded border border-dark-border">
        <button
          onMouseDown={() => startPress(-1)}
          onMouseUp={() => endPress(-1)}
          onMouseLeave={stopPress}
          onTouchStart={() => startPress(-1)}
          onTouchEnd={() => endPress(-1)}
          className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors active:bg-gray-600 border-r border-gray-700/50 mr-0.5"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="min-w-[40px] px-1 text-center text-sm font-mono text-white select-none font-bold leading-none">
          {prefix}{value}
        </div>
        <button
          onMouseDown={() => startPress(1)}
          onMouseUp={() => endPress(1)}
          onMouseLeave={stopPress}
          onTouchStart={() => startPress(1)}
          onTouchEnd={() => endPress(1)}
          className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors active:bg-gray-600 border-l border-gray-700/50 ml-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// --- Constants ---
const CATEGORY_ORDER = ['Trees', 'Plants', 'Flowers', 'Greenery', 'Arrangements', 'Baskets', 'Peripheral'];
const ROW_1_CATS = ['Trees', 'Plants', 'Flowers', 'Greenery'];
const ROW_2_CATS = ['Arrangements', 'Baskets', 'Peripheral'];
const SUPPLIER_ORDER = ['LL', 'FI', 'EL', 'FB', 'AB', 'CN', 'HT', 'GR', 'GF', 'RE', 'WD', 'JM', 'JN', 'OT', 'HN', 'ST'];

export const InventorySearch: React.FC<InventorySearchProps> = ({ files, wpConfig, onUpdateItem, onAddToBarcodeQueue, onAddToWpQueue, onOpenVCA }) => {
  const rawData = useMemo(() => {
    console.log('🔄 processRawData called, files.length:', files.length);
    const processed = processRawData(files);
    const testItem = processed.find(item => item.Code === 'FHPD22045');
    console.log('🔍 Test item FHPD22045 in rawData:', testItem?.SubCat, testItem?.SKU);
    return processed;
  }, [files]);
  const masterFile = files.find(f => f.name.toLowerCase().includes('lt')) || files[0];

  const defaultFilters: FilterParams = {
    keywords: '',
    suppliers: ['ALL'],
    category: 'ALL',
    subCats: ['', '', '', '', ''],
    minPrice: 0,
    maxPrice: 300,
    minHL: 0,
    maxHL: 210,
    inStockOnly: false
  };

  const [draftFilters, setDraftFilters] = useState<FilterParams>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterParams>(defaultFilters);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [keepSelection, setKeepSelection] = useState(false);
  const [viewSelected, setViewSelected] = useState(false);

  // NEW: Enable toggles for price and height filters
  const [priceFilterEnabled, setPriceFilterEnabled] = useState(false);
  const [heightFilterEnabled, setHeightFilterEnabled] = useState(false);

  // Batch Feedback Modal State
  const [batchModal, setBatchModal] = useState<{ show: boolean, phase: 'success' | 'info', title: string, message: string } | null>(null);

  // Virtual Keyboard State
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardInput, setKeyboardInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Separate search input state for instant UI updates (no lag)
  const [searchInput, setSearchInput] = useState('');

  const suppliers = useMemo(() => {
    const sups = new Set<string>(rawData.map(d => d.SU as string).filter(Boolean));
    const allAvailable = Array.from(sups).sort((a, b) => {
      const idxA = SUPPLIER_ORDER.indexOf(a);
      const idxB = SUPPLIER_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return allAvailable.slice(0, 15);
  }, [rawData]);

  const categories = useMemo(() => {
    const cats = new Set<string>(rawData.map(d => d.displayCategory as string).filter(Boolean));
    const availableCats = Array.from(cats);
    return availableCats.sort((a, b) => {
      const idxA = CATEGORY_ORDER.indexOf(a);
      const idxB = CATEGORY_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [rawData]);

  const availableSubCats = useMemo(() => {
    let filtered = rawData;
    if (draftFilters.category !== 'ALL') {
      filtered = filtered.filter(d => d.displayCategory === draftFilters.category);
    }
    const subs = new Set<string>(filtered.map(d => d.nSubCategory as string).filter(Boolean));
    return Array.from(subs).sort();
  }, [rawData, draftFilters.category]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsListRef = useRef<HTMLDivElement>(null);

  // Sync searchInput to draftFilters.keywords with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDraftFilters(p => ({ ...p, keywords: searchInput }));
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Debounced suggestions generation to improve input performance
  useEffect(() => {
    if (!draftFilters.keywords || draftFilters.keywords.length < 2) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    // Debounce: wait 150ms after user stops typing
    const timeoutId = setTimeout(() => {
      const lowerQ = (draftFilters.keywords || '').toLowerCase();

      // Filter rawData based on enabled filters before generating suggestions
      let filteredForSuggestions = rawData;

      // Apply price filter if enabled
      if (priceFilterEnabled) {
        filteredForSuggestions = filteredForSuggestions.filter(d => {
          const price = d.ListPrice || 0;
          return price >= (draftFilters.minPrice || 0) && price <= (draftFilters.maxPrice || Infinity);
        });
      }

      // Apply height filter if enabled
      if (heightFilterEnabled) {
        filteredForSuggestions = filteredForSuggestions.filter(d => {
          const height = d.HL || 0;
          return height >= (draftFilters.minHL || 0) && height <= (draftFilters.maxHL || Infinity);
        });
      }

      const matches = filteredForSuggestions
        .filter(d => (d.Description && d.Description.toLowerCase().includes(lowerQ)) || (d.SKU && d.SKU.toLowerCase().includes(lowerQ)))
        .slice(0, 50)
        .map(d => d.Description || d.SKU);
      setSuggestions(Array.from(new Set(matches)));
      setSelectedIndex(-1);
    }, 150); // 150ms debounce delay

    // Cleanup: cancel timeout if user types again
    return () => clearTimeout(timeoutId);
  }, [draftFilters.keywords, draftFilters.minPrice, draftFilters.maxPrice, draftFilters.minHL, draftFilters.maxHL, rawData, priceFilterEnabled, heightFilterEnabled]);

  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsListRef.current) {
      (suggestionsListRef.current.children[selectedIndex] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeSearch = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setIsSuggestionsOpen(false);
    setViewSelected(false);

    if (!keepSelection) {
      setSelectedRowIds(new Set());
    }
  }, [draftFilters, keepSelection]);

  const filteredData = useMemo(() => {
    if (viewSelected) {
      return rawData.filter(item => selectedRowIds.has(Number(item._id)));
    }

    // Create a modified filter that respects enable toggles
    const activeFilters = {
      ...appliedFilters,
      // Only apply price filter if enabled
      minPrice: priceFilterEnabled ? appliedFilters.minPrice : undefined,
      maxPrice: priceFilterEnabled ? appliedFilters.maxPrice : undefined,
      // Only apply height filter if enabled
      minHL: heightFilterEnabled ? appliedFilters.minHL : undefined,
      maxHL: heightFilterEnabled ? appliedFilters.maxHL : undefined,
    };

    const results = searchInventory(rawData, activeFilters);
    console.log('🔍 Search executed with filters:', activeFilters);
    console.log(`🎚️ Price filter: ${priceFilterEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📏 Height filter: ${heightFilterEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log('📊 Raw data count:', rawData.length);
    console.log('✅ Filtered results count:', results.length);
    if (results.length === 0 && appliedFilters.keywords) {
      console.log('❌ No results found. Checking first 10 items in rawData:');
      rawData.slice(0, 10).forEach((item, idx) => {
        console.log(`Item ${idx}:`, {
          Code: item.Code,
          SKU: item.SKU,
          Barcode: item.Barcode,
          Description: item.Description,
          nSubCategory: item.nSubCategory
        });
      });
      // Also search for the keyword manually to see if it exists anywhere
      console.log(`🔎 Manually searching for "${appliedFilters.keywords}" in all items...`);
      const manualMatch = rawData.find(item =>
        (item.Code && item.Code.includes(appliedFilters.keywords || '')) ||
        (item.SKU && item.SKU.includes(appliedFilters.keywords || '')) ||
        (item.Barcode && item.Barcode.includes(appliedFilters.keywords || '')) ||
        (item.Description && item.Description.toLowerCase().includes((appliedFilters.keywords || '').toLowerCase()))
      );
      if (manualMatch) {
        console.log('✅ Found manual match:', {
          Code: manualMatch.Code,
          SKU: manualMatch.SKU,
          Barcode: manualMatch.Barcode,
          Description: manualMatch.Description
        });
      } else {
        console.log('❌ No manual match found in entire dataset');
      }
    }
    return results;
  }, [rawData, appliedFilters, viewSelected, selectedRowIds, priceFilterEnabled, heightFilterEnabled]);

  // Virtual Keyboard Handlers
  const handleKeyboardToggle = () => {
    if (!showKeyboard) {
      setKeyboardInput(draftFilters.keywords || '');
    }
    setShowKeyboard(!showKeyboard);
  };

  const handleKeyboardInput = (char: string) => {
    setKeyboardInput(prev => prev + char);
  };

  const handleKeyboardDelete = () => {
    setKeyboardInput(prev => prev.slice(0, -1));
  };

  const handleKeyboardEnter = () => {
    // Update both draft and applied filters to trigger search
    const updatedFilters = { ...draftFilters, keywords: keyboardInput };
    setSearchInput(keyboardInput); // Sync searchInput
    setDraftFilters(updatedFilters);
    setAppliedFilters(updatedFilters);
    setShowKeyboard(false);
  };

  const handleClearInput = () => {
    setSearchInput('');
    setKeyboardInput('');
    setDraftFilters(p => ({ ...p, keywords: '' }));
    setIsSuggestionsOpen(false);
    setShowKeyboard(false);
    searchInputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Block physical keyboard when virtual keyboard is shown
    if (showKeyboard) {
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSuggestionsOpen && suggestions.length > 0) {
        setIsSuggestionsOpen(true);
        setSelectedIndex(0);
      } else if (suggestions.length > 0) {
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isSuggestionsOpen) {
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      }
    } else if (e.key === 'Enter') {
      if (e.ctrlKey) {
        executeSearch();
      } else {
        if (isSuggestionsOpen && selectedIndex >= 0) {
          e.preventDefault();
          setDraftFilters(p => ({ ...p, keywords: suggestions[selectedIndex] }));
          setIsSuggestionsOpen(false);
          setSelectedIndex(-1);
        } else {
          executeSearch();
        }
      }
    } else if (e.key === 'Escape') {
      setIsSuggestionsOpen(false);
    }
  };

  const toggleSupplier = (su: string) => {
    let newSet: string[];
    if (su === 'ALL') {
      newSet = ['ALL'];
    } else {
      newSet = draftFilters.suppliers?.includes('ALL') ? [] : [...(draftFilters.suppliers || [])];
      if (newSet.includes(su)) {
        newSet = newSet.filter(s => s !== su);
      } else {
        newSet.push(su);
        if (newSet.length > 4) {
          newSet.sort((a, b) => {
            const idxA = SUPPLIER_ORDER.indexOf(a);
            const idxB = SUPPLIER_ORDER.indexOf(b);
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
          });
          newSet = newSet.slice(0, 4);
        }
      }
      if (newSet.length === 0) newSet = ['ALL'];
    }
    setDraftFilters(prev => ({ ...prev, suppliers: newSet }));
  };

  const handleSubCatChange = (index: number, val: string) => {
    const newSelectors = [...(draftFilters.subCats || ['', '', '', '', ''])];
    newSelectors[index] = val;
    setDraftFilters(prev => ({ ...prev, subCats: newSelectors }));
  };

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    '__check__', '__action__', 'Code', 'SKU', 'Description', 'ListPrice', 'RefPrice', 'HL', 'Location', 'Qty', 'Stock', 'Sold', 'PostStatus', 'Comment', 'PNDesc'
  ]));

  const defaultWidths: Record<string, number> = {
    __check__: 40, __action__: 50, Code: 100, SU: 80, SKU: 120, Description: 248, ListPrice: 80, FinalCost: 80, RefPrice: 80, SalePrice: 80, HL: 60, Location: 80, Qty: 60, Stock: 60, Sold: 60, PostStatus: 90, Comment: 100, nSubCategory: 120, PNDesc: 150, StockStatus: 90, ModelCode: 80, Cluster: 80, AttColor: 80, CatCode: 60
  };
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultWidths);

  useEffect(() => {
    const loadSettings = async () => {
      const saved = await getSetting('inventory_column_widths_v3');
      if (saved) setColumnWidths(prev => ({ ...prev, ...saved }));
    };
    loadSettings();
  }, []);

  const columnDefs = [
    { key: '__check__', label: '', fixed: true, sortable: false },
    { key: '__action__', label: 'Act', fixed: true, sortable: false },
    { key: 'Code', label: 'Code', sortable: true },
    { key: 'SU', label: 'SU', sortable: false },
    { key: 'SKU', label: 'SKU', sortable: true },
    { key: 'Description', label: 'Description', align: 'left', sortable: false },
    { key: 'ListPrice', label: 'Price', format: (v: any) => `$${Number(v).toFixed(2)}`, sortable: true },
    { key: 'FinalCost', label: 'Final Cost', format: (v: any) => `$${Number(v).toFixed(2)}`, sortable: true }, // Added Final Cost
    { key: 'RefPrice', label: 'Ref Price', format: (v: any) => `$${Number(v).toFixed(2)}`, sortable: true },
    { key: 'SalePrice', label: 'Sale $', format: (v: any) => `$${Number(v).toFixed(2)}`, sortable: true },
    { key: 'HL', label: 'HL', sortable: true },
    { key: 'Location', label: 'Loc', sortable: false },
    { key: 'Qty', label: 'Total', sortable: false },
    { key: 'Stock', label: 'Stock', sortable: false },
    { key: 'Sold', label: 'Sold', sortable: false },
    { key: 'PostStatus', label: 'Status', sortable: true },
    { key: 'Comment', label: 'Comment', sortable: true },
    { key: 'nSubCategory', label: 'SubCat', sortable: true },
    { key: 'PNDesc', label: 'Barcode Name', sortable: false },
    { key: 'ModelCode', label: 'Model', sortable: true },
    { key: 'Cluster', label: 'Cluster', sortable: true },
    { key: 'AttColor', label: 'AttColor', sortable: true },
    { key: 'CatCode', label: 'CatCode', sortable: true },
  ];

  const resizingRef = useRef<{ key: string, startX: number, startWidth: number } | null>(null);

  const startResize = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[key] || defaultWidths[key] || 100;
    resizingRef.current = { key, startX: e.clientX, startWidth };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    const newWidth = Math.max(30, startWidth + diff);
    setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
  }, []);

  const onMouseUp = useCallback(() => {
    if (resizingRef.current) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      resizingRef.current = null;
      setColumnWidths(prev => {
        saveSetting('inventory_column_widths_v3', prev);
        return prev;
      });
    }
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (sortConfig.key === 'ListPrice' || sortConfig.key === 'HL') {
        return sortConfig.direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(curr => (curr?.key === key && curr.direction === 'asc') ? { key, direction: 'desc' } : { key, direction: 'asc' });
  };

  const toggleRow = (id: number) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const allVisibleSelected = sortedData.every(row => selectedRowIds.has(Number(row._id)));
    if (allVisibleSelected) {
      const next = new Set(selectedRowIds);
      sortedData.forEach(row => next.delete(Number(row._id)));
      setSelectedRowIds(next);
    } else {
      const next = new Set(selectedRowIds);
      sortedData.forEach(row => next.add(Number(row._id)));
      setSelectedRowIds(next);
    }
  };

  const handleDownload = () => {
    let rowsToExport = sortedData;
    if (selectedRowIds.size > 0 && !viewSelected) {
      rowsToExport = rawData.filter(r => selectedRowIds.has(Number(r._id)));
    }

    const validCols = columnDefs.filter(c => visibleColumns.has(c.key) && c.key !== '__check__' && c.key !== '__action__');
    const headers = validCols.map(c => c.label);
    const csvContent = [
      headers.join(','),
      ...rowsToExport.map(row =>
        validCols.map(c => {
          let val = row[c.key] || '';
          if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
          return val;
        })
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `processed_${masterFile?.name || 'data'}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (!masterFile) return <div className="p-10 text-center text-gray-500">No Data Found</div>;

  return (
    <div className="flex flex-col h-full space-y-4 relative">

      {batchModal && batchModal.show && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setBatchModal(null)}>
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-8 shadow-2xl w-full max-w-md text-center transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <div className={`w-20 h-20 ${batchModal.phase === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-gemini-500/20 text-gemini-500'} rounded-full flex items-center justify-center mx-auto mb-6`}>
              {batchModal.phase === 'success' ? <CheckCircle className="w-10 h-10" /> : <Layers className="w-10 h-10" />}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{batchModal.title}</h3>
            <p className="text-gray-400 mb-8">{batchModal.message}</p>
            <button
              onClick={() => setBatchModal(null)}
              className="w-full py-3 bg-gemini-600 hover:bg-gemini-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          wpConfig={wpConfig}
          onClose={() => setEditingItem(null)}
          onSave={(newItem) => { onUpdateItem(newItem); setEditingItem(null); }}
        />
      )}

      {/* --- Search Panel --- */}
      <div className="bg-dark-surface border border-dark-border rounded-2xl p-5 shadow-xl space-y-6 flex-shrink-0 z-30 relative">
        <div className="relative z-40">
          <div className="flex gap-4 items-center">

            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                inputMode="none"
                value={showKeyboard ? keyboardInput : searchInput}
                onChange={(e) => {
                  if (!showKeyboard) {
                    setSearchInput(e.target.value);
                    setIsSuggestionsOpen(true);
                    setSelectedIndex(-1);
                  }
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  if (!showKeyboard && searchInput && searchInput.length >= 2) setIsSuggestionsOpen(true);
                }}
                readOnly={showKeyboard}
                autoFocus
                placeholder="Search Code, SKU, Description... (Ctrl+Enter to search)"
                className="w-full bg-dark-bg border border-dark-border rounded-xl pl-12 pr-28 py-3.5 text-base text-gray-200 focus:border-gemini-500 focus:ring-1 focus:ring-gemini-500 focus:outline-none transition-all placeholder-gray-500"
              />
              <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />

              {/* Clear Button */}
              {(searchInput || keyboardInput) && (
                <button
                  onClick={handleClearInput}
                  className="absolute right-16 top-4 text-gray-400 hover:text-white transition-colors"
                  title="Clear input"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Keyboard Toggle Button */}
              <button
                onClick={handleKeyboardToggle}
                className={`absolute right-4 top-4 transition-colors ${showKeyboard ? 'text-gemini-400' : 'text-gray-400 hover:text-white'
                  }`}
                title="Toggle virtual keyboard"
              >
                <Keyboard className="w-5 h-5" />
              </button>

              {/* Virtual Keyboard */}
              {showKeyboard && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50">
                  <AlphanumericKeypad
                    onInput={handleKeyboardInput}
                    onDelete={handleKeyboardDelete}
                    onEnter={handleKeyboardEnter}
                    onClose={() => setShowKeyboard(false)}
                  />
                </div>
              )}

              {!showKeyboard && isSuggestionsOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                  <div
                    ref={suggestionsListRef}
                    className="max-h-[250px] overflow-y-auto custom-scrollbar overscroll-contain"
                  >
                    {suggestions.map((s, i) => (
                      <div key={i}
                        onClick={() => {
                          // When clicking a suggestion, we want to find products that match this description
                          // Extract the first few meaningful words (e.g., "BBQ Table" from "BBQ Table Classic Black Set 80*80*75cm")
                          // This makes the search more flexible
                          const words = s.split(/\s+/).filter(w => w.length > 0);
                          // Use first 2-3 words as the search term for better matching
                          const searchTerm = words.slice(0, Math.min(3, words.length)).join(' ');

                          const newFilters = { ...draftFilters, keywords: searchTerm };
                          console.log('Suggestion clicked:', s);
                          console.log('Search term extracted:', searchTerm);
                          console.log('New filters:', newFilters);
                          setDraftFilters(newFilters);
                          setAppliedFilters(newFilters);
                          setIsSuggestionsOpen(false);
                          setSelectedIndex(-1);
                          setViewSelected(false);
                          if (!keepSelection) {
                            setSelectedRowIds(new Set());
                          }
                        }}
                        className={`px-5 py-3 cursor-pointer text-base border-b border-dark-border/30 last:border-0 transition-colors ${i === selectedIndex
                          ? 'bg-gemini-600 text-white'
                          : 'text-gray-300 hover:bg-gemini-600/50 hover:text-white'
                          }`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                  <div className="bg-dark-bg/80 p-1.5 text-center text-xs text-gray-400 uppercase tracking-wide">
                    Use Arrows to Navigate • Enter to Select • ESC to close
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setDraftFilters(p => ({ ...p, inStockOnly: !p.inStockOnly }))}
              className={`flex items-center gap-2 px-5 py-3.5 rounded-xl font-medium transition-all whitespace-nowrap border text-sm ${draftFilters.inStockOnly
                ? 'bg-green-600/20 border-green-500/50 text-green-300 shadow-sm shadow-green-500/10'
                : 'bg-dark-bg border-dark-border text-gray-300 hover:border-gray-500 hover:text-gray-200'
                }`}
              title="Toggle Stock Filter"
            >
              <PackageCheck className={`w-5 h-5 ${draftFilters.inStockOnly ? 'text-green-400' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">{draftFilters.inStockOnly ? 'In-Stock Only' : 'Show All Stock'}</span>
            </button>

            <button
              onClick={executeSearch}
              className="bg-gemini-600 hover:bg-gemini-500 text-white px-8 py-3.5 rounded-xl font-semibold text-base shadow-lg shadow-gemini-600/20 flex items-center gap-2 active:transform active:scale-95 transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              Search
            </button>

            {/* Results Count Display */}
            <div className="flex flex-col items-center gap-1 px-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Results</div>
              <div className="text-2xl font-bold text-gemini-400">
                {filteredData.length.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-600">
                of {rawData.length.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-1 lg:items-center items-start">

          {/* COLUMN 1: Categories */}
          <div className="w-full lg:w-[40%] xl:w-[35%] flex flex-col gap-2 flex-shrink-0">
            <div className="flex gap-2 items-stretch w-full">
              <button
                onClick={() => setDraftFilters(p => ({ ...p, category: 'ALL' }))}
                className={`flex flex-col items-center justify-center px-4 rounded-lg border transition-all flex-shrink-0 w-16 ${draftFilters.category === 'ALL'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_8px_rgba(147,51,234,0.3)]'
                  : 'bg-dark-bg border-dark-border text-gray-300 hover:border-gray-500 hover:text-gray-100'
                  }`}
                title="All Categories"
              >
                {draftFilters.category === 'ALL' ? <CheckCircle className="w-5 h-5 mb-1" /> : <Circle className="w-5 h-5 mb-1" />}
                <span className="font-bold text-xs">ALL</span>
              </button>

              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2">
                  {ROW_1_CATS.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setDraftFilters(p => ({ ...p, category: cat }))}
                      className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all whitespace-nowrap ${draftFilters.category === cat
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-dark-bg border-dark-border text-gray-300 hover:border-gray-500 hover:text-gray-100'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {ROW_2_CATS.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setDraftFilters(p => ({ ...p, category: cat }))}
                      className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all whitespace-nowrap ${draftFilters.category === cat
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-dark-bg border-dark-border text-gray-300 hover:border-gray-500 hover:text-gray-100'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 w-full">
              {draftFilters.subCats?.slice(0, 4).map((val, idx) => (
                <select
                  key={idx}
                  value={val}
                  onChange={(e) => handleSubCatChange(idx, e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border text-gray-200 text-xs rounded-lg p-1.5 focus:ring-1 focus:ring-purple-500 outline-none hover:border-gray-500 transition-colors"
                >
                  <option value="">-- Sub --</option>
                  {availableSubCats.map(sc => (
                    <option key={sc} value={sc}>{sc}</option>
                  ))}
                </select>
              ))}
            </div>
          </div>

          {/* COLUMN 2: Suppliers & Price/HL */}
          <div className="flex-1 flex flex-row gap-4 items-center w-full">

            {/* 2A: Supplier Selector */}
            <div className="w-40 flex-shrink-0 flex flex-col gap-2 relative z-30">
              <div className="flex flex-wrap gap-1 min-h-[24px]">
                {(!draftFilters.suppliers || draftFilters.suppliers.includes('ALL')) ? (
                  <span className="text-[10px] font-bold bg-gemini-600 text-white px-2 py-0.5 rounded border border-gemini-500">ALL</span>
                ) : (
                  draftFilters.suppliers.slice(0, 4).map(s => (
                    <span key={s} className="text-[10px] font-bold bg-gemini-600 text-white px-2 py-0.5 rounded border border-gemini-500">{s}</span>
                  ))
                )}
              </div>

              <button
                onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                className={`w-full bg-dark-bg border border-dark-border hover:border-gemini-500 rounded px-3 py-1.5 text-xs text-gray-300 flex justify-between items-center transition-colors ${isSupplierDropdownOpen ? 'border-gemini-500 ring-1 ring-gemini-500/50' : ''}`}
              >
                <span>Select...</span> <ChevronDown className="w-3 h-3" />
              </button>

              {isSupplierDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-[280px] bg-dark-surface border border-dark-border rounded-xl shadow-2xl p-2 grid grid-cols-5 gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => toggleSupplier('ALL')}
                    className={`col-span-1 px-1 py-2 rounded text-[10px] font-bold border transition-all ${draftFilters.suppliers?.includes('ALL')
                      ? 'bg-gemini-600 border-gemini-500 text-white'
                      : 'bg-dark-bg border-dark-border text-gray-400 hover:bg-gray-700'
                      }`}
                  >
                    ALL
                  </button>
                  {suppliers.map(su => (
                    <button
                      key={su}
                      onClick={() => toggleSupplier(su)}
                      className={`px-1 py-2 rounded text-[10px] font-bold border transition-all ${draftFilters.suppliers?.includes(su)
                        ? 'bg-gemini-600 border-gemini-500 text-white'
                        : 'bg-dark-bg border-dark-border text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                      {su}
                    </button>
                  ))}
                  <div className="col-span-5 flex justify-end mt-1 pt-2 border-t border-dark-border">
                    <button onClick={() => setIsSupplierDropdownOpen(false)} className="text-xs text-gemini-400 hover:text-white px-2">Close</button>
                  </div>
                </div>
              )}
            </div>

            {/* 2B: Price ($) & HL Controls */}
            <div className="flex-1 flex flex-col gap-2">
              {/* Price Row */}
              <div className="flex items-center gap-3">
                {/* Enable Toggle */}
                <button
                  onClick={() => setPriceFilterEnabled(!priceFilterEnabled)}
                  className={`w-8 h-8 flex-shrink-0 rounded border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${priceFilterEnabled
                    ? 'bg-green-600/30 border-green-500 text-green-300'
                    : 'bg-dark-bg border-dark-border text-gray-600 hover:border-gray-500'
                    }`}
                  title={priceFilterEnabled ? 'Price Filter: ENABLED' : 'Price Filter: DISABLED'}
                >
                  {priceFilterEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                {/* Reset Button */}
                <div
                  onClick={() => setDraftFilters(p => ({ ...p, minPrice: 0, maxPrice: 300 }))}
                  className="w-8 h-8 flex-shrink-0 rounded bg-green-900/20 border border-green-500/30 flex items-center justify-center text-green-400 cursor-pointer hover:bg-green-500/20 transition-all active:scale-95"
                  title="Reset Price"
                >
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <AdvancedStepper
                    value={draftFilters.minPrice || 0}
                    onChange={(v) => setDraftFilters(p => ({ ...p, minPrice: v, maxPrice: Math.max(p.maxPrice || 0, v) }))}
                    min={0}
                    max={2000}
                  />
                  <span className="text-gray-500">-</span>
                  <AdvancedStepper
                    value={draftFilters.maxPrice ?? 300}
                    onChange={(v) => setDraftFilters(p => ({ ...p, maxPrice: v, minPrice: Math.min(p.minPrice || 0, v) }))}
                    min={0}
                    max={2000}
                  />
                </div>
              </div>

              {/* HL Row */}
              <div className="flex items-center gap-3">
                {/* Enable Toggle */}
                <button
                  onClick={() => setHeightFilterEnabled(!heightFilterEnabled)}
                  className={`w-8 h-8 flex-shrink-0 rounded border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${heightFilterEnabled
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-dark-bg border-dark-border text-gray-600 hover:border-gray-500'
                    }`}
                  title={heightFilterEnabled ? 'Height Filter: ENABLED' : 'Height Filter: DISABLED'}
                >
                  {heightFilterEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                {/* Reset Button */}
                <div
                  onClick={() => setDraftFilters(p => ({ ...p, minHL: 0, maxHL: 210 }))}
                  className="w-8 h-8 flex-shrink-0 rounded bg-purple-900/20 border border-purple-500/30 flex items-center justify-center cursor-pointer hover:bg-purple-500/20 transition-all active:scale-95"
                  title="Reset HL"
                >
                  <span className="text-[10px] font-bold text-purple-300 font-mono">HL</span>
                </div>
                <div className="flex items-center gap-2">
                  <AdvancedStepper
                    value={draftFilters.minHL || 0}
                    onChange={(v) => setDraftFilters(p => ({ ...p, minHL: v, maxHL: Math.max(p.maxHL || 0, v) }))}
                    min={0}
                    max={500}
                  />
                  <span className="text-gray-500">-</span>
                  <AdvancedStepper
                    value={draftFilters.maxHL ?? 210}
                    onChange={(v) => setDraftFilters(p => ({ ...p, maxHL: v, minHL: Math.min(p.minHL || 0, v) }))}
                    min={0}
                    max={500}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons Stack - Right of Filters */}
            <div className="flex flex-col gap-2 justify-center items-center ml-4">
              {/* Export Button */}
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gemini-600 hover:bg-gemini-500 text-white transition-colors text-xs font-bold min-w-[120px] justify-center"
                title="Export filtered data to CSV"
              >
                <Download className="w-3 h-3" /> Export
              </button>

              {/* Keep Select Button */}
              <button
                onClick={() => setKeepSelection(!keepSelection)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-colors text-xs font-bold min-w-[120px] justify-center ${keepSelection
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'border-dark-border text-gray-400 hover:text-white hover:border-gray-500 bg-dark-bg'
                  }`}
                title="Keep selection across searches"
              >
                {keepSelection ? <Layers className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                Keep Select
              </button>

              {/* Review Button */}
              <button
                onClick={() => setViewSelected(!viewSelected)}
                disabled={selectedRowIds.size === 0 && !viewSelected}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-colors text-xs font-bold min-w-[120px] justify-center ${viewSelected
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-dark-border text-gray-400 hover:text-white hover:border-gray-500 bg-dark-bg disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                title="Show only selected items"
              >
                {viewSelected ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                Review ({selectedRowIds.size})
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* --- Results Stats & Actions Bar --- */}
      <div className="flex items-center justify-center px-2 text-sm flex-shrink-0 h-16 -mt-5">
        {/* MIDDLE: Batch Buttons (Restored Row of 6) */}
        <div className="flex-1 flex justify-center gap-2 overflow-x-auto px-4">
          {
            [1, 2, 3, 4, 5, 6].map((idx) => {
              // BATCH 1: BARCODE ACTION
              if (idx === 1) {
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      const selectedItems = rawData.filter(r => selectedRowIds.has(Number(r._id)));
                      onAddToBarcodeQueue(selectedItems);
                      setBatchModal({
                        show: true,
                        phase: 'success',
                        title: 'Queue Updated',
                        message: `Successfully added ${selectedItems.length} items to Barcode Queue.`
                      });
                    }}
                    disabled={selectedRowIds.size === 0}
                    className="bg-gemini-600 hover:bg-gemini-500 border border-gemini-500 text-white disabled:opacity-50 disabled:bg-dark-surface disabled:border-dark-border disabled:text-gray-500 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:transform active:scale-95 whitespace-nowrap h-10 self-center flex items-center gap-2"
                    title="Add Selected to Barcode Queue"
                  >
                    <ScanBarcode className="w-4 h-4" /> Label Print
                  </button>
                );
              }
              // BATCH 2: WORDPRESS ACTION
              if (idx === 2) {
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      const selectedItems = rawData.filter(r => selectedRowIds.has(Number(r._id)));
                      onAddToWpQueue(selectedItems);
                      setBatchModal({
                        show: true,
                        phase: 'success',
                        title: 'Queue Updated',
                        message: `Successfully added ${selectedItems.length} items to Product Review Queue.`
                      });
                    }}
                    disabled={selectedRowIds.size === 0}
                    className="bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white disabled:opacity-50 disabled:bg-dark-surface disabled:border-dark-border disabled:text-gray-500 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:transform active:scale-95 whitespace-nowrap h-10 self-center flex items-center gap-2"
                    title="Add Selected to WordPress Queue"
                  >
                    <Globe className="w-4 h-4" /> Product Review
                  </button>
                );
              }
              // BATCH 3-6: Generic Placeholders
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setBatchModal({
                      show: true,
                      phase: 'info',
                      title: `Batch Action ${idx}`,
                      message: "This batch action placeholder is currently being developed. Stay tuned!"
                    });
                  }}
                  disabled={selectedRowIds.size === 0}
                  className="bg-dark-surface hover:bg-gemini-600 border border-dark-border hover:border-gemini-500 text-gray-300 hover:text-white disabled:opacity-50 disabled:border-dark-border disabled:text-gray-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:transform active:scale-95 whitespace-nowrap h-10 self-center"
                >
                  Batch {idx}
                </button>
              );
            })
          }
        </div>
      </div>

      {/* --- Data Table --- */}
      <div className="flex-1 overflow-auto rounded-2xl border border-dark-border bg-dark-surface shadow-2xl relative -mt-10">
        <div className="absolute inset-0 overflow-auto custom-scrollbar">
          <div className="min-w-max">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-dark-surface border-b border-dark-border shadow-sm flex font-semibold text-gray-300 text-sm select-none whitespace-nowrap">
              {columnDefs.filter(c => visibleColumns.has(c.key)).map((col, idx) => (
                <div
                  key={col.key}
                  className={`relative p-3 flex items-center whitespace-nowrap group hover:bg-dark-bg transition-colors border-r border-dark-border/30 last:border-0 ${col.fixed ? 'sticky z-30 bg-dark-surface' : ''}`}
                  style={{
                    width: columnWidths[col.key],
                    minWidth: columnWidths[col.key],
                    left: col.fixed ? (col.key === '__check__' ? 0 : columnWidths['__check__']) : undefined,
                    justifyContent: col.align === 'left' ? 'flex-start' : 'center'
                  }}
                >
                  {col.key === '__check__' ? (
                    <div onClick={toggleAllVisible} className="cursor-pointer">
                      {selectedRowIds.size > 0 ? <CheckSquare className="w-4 h-4 text-gemini-400" /> : <Square className="w-4 h-4 text-gray-600" />}
                    </div>
                  ) : col.key === '__action__' ? (
                    <span className="text-center w-full"><Settings className="w-4 h-4 inline" /></span>
                  ) : (
                    <>
                      <div
                        className={`flex items-center gap-1.5 select-none whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-white' : 'cursor-default'}`}
                        onClick={() => handleSort(col.key)}
                        title={col.sortable ? "Click to sort: Asc -> Desc -> Reset" : ""}
                      >
                        {col.label}
                        {col.sortable && (
                          <div className="flex flex-col items-center justify-center h-4 w-4">
                            {sortConfig?.key === col.key ? (
                              sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-gemini-400" /> : <ArrowDown className="w-3.5 h-3.5 text-gemini-400" />
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-gray-600 opacity-30 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        )}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gemini-500/50 z-40"
                        onMouseDown={(e) => startResize(e, col.key)}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="divide-y divide-dark-border/50 text-sm text-gray-300">
              {sortedData.length === 0 ? (
                <div className="p-10 text-center text-gray-500 flex flex-col items-center">
                  <Search className="w-10 h-10 mb-2 opacity-50" />
                  {viewSelected ? "No selected items." : "No products found matching your filters."}
                </div>
              ) : (
                sortedData.slice(0, viewSelected ? sortedData.length : 10000).map((row) => {
                  const isSelected = selectedRowIds.has(Number(row._id));
                  return (
                    <div
                      key={row._id}
                      onClick={() => toggleRow(Number(row._id))}
                      className={`flex transition-colors cursor-pointer active:bg-blue-900/10 ${isSelected ? 'bg-gemini-900/20 hover:bg-gemini-900/30' : 'hover:bg-dark-bg/50 odd:bg-dark-bg/20'}`}
                    >
                      {columnDefs.filter(c => visibleColumns.has(c.key)).map((col) => (
                        <div
                          key={col.key}
                          className={`p-2.5 flex items-center border-r border-dark-border/30 last:border-0 truncate ${col.fixed ? 'sticky z-10 ' + (isSelected ? 'bg-[#152035]' : 'bg-[#131d30]') : ''}`}
                          style={{
                            width: columnWidths[col.key],
                            minWidth: columnWidths[col.key],
                            left: col.fixed ? (col.key === '__check__' ? 0 : columnWidths['__check__']) : undefined,
                            justifyContent: col.align === 'left' ? 'flex-start' : 'center'
                          }}
                        >
                          {col.key === '__check__' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(Number(row._id));
                              }}
                              className="text-gray-500 hover:text-white p-2 -m-2"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4 text-gemini-400" /> : <Square className="w-4 h-4" />}
                            </button>
                          ) : col.key === '__action__' ? (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(row);
                                }}
                                className="p-1 hover:bg-gemini-600 rounded text-gray-400 hover:text-white transition-colors"
                                title="Edit Item Details"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {onOpenVCA && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenVCA(row);
                                  }}
                                  className="p-1 hover:bg-pink-600 rounded text-gray-400 hover:text-white transition-colors"
                                  title="Quick VCA / Staging"
                                >
                                  <Wand2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span title={String(row[col.key])}>
                              {col.format ? col.format(row[col.key]) : row[col.key]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
              {sortedData.length > 10000 && !viewSelected && (
                <div className="p-4 text-center text-gray-500 text-xs italic bg-dark-bg/30">
                  Showing first 10000 of {sortedData.length} results. Use filters to narrow down.
                </div>
              )}
            </div>
          </div>
        </div>
      </div >
    </div >
  );
};