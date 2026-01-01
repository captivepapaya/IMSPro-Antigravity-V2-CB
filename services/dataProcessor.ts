

import { InventoryItem, FilterParams, CsvFile, AiAnalysisResult } from '../types';
import { synonymService } from './synonymService';
import { getRgbFromColorName, calculateColorDistance } from './colorUtils';

// ROBUST MAPPING: Raw CSV Value (UpperCased) -> Display Name
export const RAW_TO_DISPLAY_MAP: Record<string, string> = {
  "ARTIFICIAL FLOWER ARRANGEMENTS": "Arrangements",
  "ARTIFICIAL FLOWERS": "Flowers",
  "ARTIFICIAL PLANTER PLANTS": "Plants",
  "ARTIFICIAL PLANTS": "Greenery",
  "ARTIFICIAL TREES": "Trees",
  "HANGING BASKET": "Baskets",
  "PERIPHERAL": "Peripheral"
};

// Categories valid for AI Camera Search
export const VALID_AI_CATEGORIES = ['Flowers', 'Greenery'];

// Helper to safely parse currency strings (e.g. "$1,200.50" -> 1200.5)
export const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove everything except numbers, dots, and minus signs
  const cleanStr = String(val).replace(/[^0-9.-]+/g, "");
  return parseFloat(cleanStr) || 0;
};

// Helper to find value by fuzzy key match (case-insensitive, ignore spaces)
const findValueByFuzzyKey = (row: any, candidates: string[]): any => {
  const rowKeys = Object.keys(row);
  // 1. Exact/Close Match
  for (const candidate of candidates) {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const cleanCandidate = normalize(candidate);

    // Try to find a matching key in the row
    const match = rowKeys.find(k => normalize(k) === cleanCandidate);
    if (match) return row[match];
  }
  return undefined;
};

// Normalize Data: Converts raw CSV rows into standard InventoryItems
export const processRawData = (files: CsvFile[]): InventoryItem[] => {
  // Determine master file: Try to find 'lt', otherwise use the first file
  const masterFile = files.find(f => f.name.toLowerCase().includes('lt')) || files[0];

  if (!masterFile || !masterFile.data) return [];

  return masterFile.data.map((row, index) => {
    // Detect if row is array (header: false) or object (header: true)
    const isArrayRow = Array.isArray(row);

    if (isArrayRow) {
      // ===== ARRAY MODE: Strict Index-Based Mapping =====
      // Direct column mapping: A=0, B=1, C=2, ... V=21, W=22, etc.

      const finalCost = parseCurrency(row[20]); // U: FinalCost (index 20 = column U)
      const rawCat = String(row[16] || '').trim(); // Q: Category (index 16 = column Q)
      const rawCatUpper = rawCat.toUpperCase();
      const displayCat = RAW_TO_DISPLAY_MAP[rawCatUpper] || rawCat;
      const rawSub = String(row[17] || '').trim(); // R: SubCat (index 17 = column R)

      return {
        _id: index,
        // Core Identity (A-E = 0-4)
        Code: String(row[0] || ''),           // A: Code
        SU: String(row[1] || ''),             // B: SU
        SKU: String(row[2] || ''),            // C: SKU
        Barcode: String(row[3] || ''),        // D: Barcode
        Description: String(row[4] || ''),    // E: Description

        // Measurements & Inventory (F-I = 5-8)
        HL: parseCurrency(row[5]),            // F: HL
        Qty: parseCurrency(row[6]),           // G: Qty
        Stock: parseCurrency(row[7]),         // H: Stock
        Sold: parseCurrency(row[8]),          // I: Sold

        // Product Attributes (J-N = 9-13)
        Color: String(row[9] || ''),          // J: Color
        Cluster: String(row[10] || ''),       // K: Cluster
        AttColor: String(row[11] || ''),      // L: AttColor
        Location: String(row[12] || ''),      // M: Location
        Comment: String(row[13] || ''),       // N: Comment

        // Codes & Categories (O-R = 14-17)
        CatCode: String(row[14] || ''),       // O: CatCode
        ModelCode: String(row[15] || ''),     // P: ModelCode
        Category: rawCat,                      // Q: Category
        SubCat: rawSub,                        // R: SubCat

        // Pricing (S-X = 18-23)
        NetCost: parseCurrency(row[18]),      // S: NetCost
        DiscRate: parseCurrency(row[19]),     // T: DiscRate
        FinalCost: finalCost,                  // U: FinalCost
        RefPrice: parseCurrency(row[21]),     // V: RefPrice (index 21 = $29.23)
        ListPrice: parseCurrency(row[22]),    // W: ListPrice
        SalePrice: parseCurrency(row[23]),    // X: SalePrice

        // WordPress Fields (Y-AT = 24-45)
        PostID: String(row[24] || ''),        // Y: PostID
        PostStatus: String(row[25] || ''),    // Z: PostStatus
        StockStatus: String(row[26] || ''),   // AA: StockStatus
        nCategory: String(row[27] || ''),     // AB: nCategory
        nSubCategory: String(row[28] || ''),  // AC: nSubCategory
        ProductTag: String(row[29] || ''),    // AD: ProductTag
        ProductStyle: String(row[30] || ''),  // AE: ProductStyle
        PostTitle: String(row[31] || ''),     // AF: PostTitle
        PostSlug: String(row[32] || ''),      // AG: PostSlug
        PostContent: String(row[33] || ''),   // AH: PostContent
        PostShortDesc: String(row[34] || ''), // AI: PostShortDesc
        ProductCat: String(row[35] || ''),    // AJ: ProductCat
        FocusKW: String(row[36] || ''),       // AK: FocusKW
        MetaTitle: String(row[37] || ''),     // AL: MetaTitle
        MetaDesc: String(row[38] || ''),      // AM: MetaDesc
        ProductPage: String(row[39] || ''),   // AN: ProductPage

        // Additional fields (AO-AT = 40-45)
        Images: String(row[40] || ''),        // AO: Images
        Image: String(row[41] || ''),         // AP: Image
        TapPrtName: String(row[42] || ''),    // AQ: TapPrtName
        PNDesc: String(row[43] || ''),        // AR: PNDesc
        PNLen: parseCurrency(row[44]),        // AS: PNLen
        Per: parseCurrency(row[45]),          // AT: Per

        // Display fields
        displayCategory: displayCat,
      };
    } else {
      // ===== OBJECT MODE: Direct Field Access (Supabase data) =====
      // Supabase data already has correct field names and types, just add display fields
      const rawCat = String(row.nCategory || row.Category || '').trim();
      const rawCatUpper = rawCat.toUpperCase();
      const displayCat = RAW_TO_DISPLAY_MAP[rawCatUpper] || rawCat;

      return {
        ...row,
        _id: index,
        displayCategory: displayCat,
      };
    }
  });
};

// The Core Logic Engine: Used by both UI and AI
export const searchInventory = (data: InventoryItem[], filters: FilterParams): InventoryItem[] => {
  return data.filter(item => {
    // 1. Stock Filter
    if (filters.inStockOnly && item.Stock <= 0) return false;

    // 2. Price Filter (check if defined)
    if (filters.minPrice !== undefined && item.ListPrice < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && item.ListPrice > filters.maxPrice) return false;

    // 3. HL (Height) Filter
    if (filters.minHL !== undefined && item.HL < filters.minHL) return false;
    if (filters.maxHL !== undefined && item.HL > filters.maxHL) return false;

    // 4. Supplier Filter
    if (filters.suppliers && filters.suppliers.length > 0 && !filters.suppliers.includes('ALL')) {
      if (!filters.suppliers.includes(item.SU)) return false;
    }

    // 5. Category Filter
    if (filters.category && filters.category !== 'ALL') {
      if (item.displayCategory !== filters.category) return false;
    }

    // 6. SubCategory Filter (UI specific array check, or AI simple check)
    if (filters.subCats && filters.subCats.length > 0) {
      // Remove empty strings from filter array
      const activeSubCats = filters.subCats.filter(Boolean);
      if (activeSubCats.length > 0) {
        if (!activeSubCats.includes(item.nSubCategory || '')) return false; // Fix lint
      }
    }

    // 7. Keyword Search (The robust "OR" logic from UI)
    if (filters.keywords && filters.keywords.trim().length > 0) {
      const query = filters.keywords;
      const orGroups = query.split(/\s+OR\s+/i);

      const matchesOr = orGroups.some(group => {
        const terms = group.trim().split(/[\s+]+/);
        return terms.every(term => {
          if (!term) return true;
          const isNegative = term.startsWith('-') && term.length > 1;
          const cleanTerm = isNegative ? term.substring(1).toLowerCase() : term.toLowerCase();

          // Fuzzy search across key fields
          const isMatch = (
            (item.Code && item.Code.toLowerCase().includes(cleanTerm)) ||
            (item.SKU && item.SKU.toLowerCase().includes(cleanTerm)) ||
            (item.Description && item.Description.toLowerCase().includes(cleanTerm)) ||
            (item.nSubCategory && item.nSubCategory.toLowerCase().includes(cleanTerm))
          );
          return isNegative ? !isMatch : isMatch;
        });
      });
      if (!matchesOr) return false;
    }

    return true;
  });
};

// Helper: Get unique subcategories for Flowers and Greenery to pass as context
export const getAiContextSubCategories = (data: InventoryItem[]): string[] => {
  const valid = new Set<string>();
  data.forEach(item => {
    if (VALID_AI_CATEGORIES.includes(item.displayCategory) && item.nSubCategory) {
      valid.add(item.nSubCategory);
    }
  });
  return Array.from(valid).sort();
};

// --- AI Weighted Search Logic (60/40 Split with Relative Distance) ---
export const searchInventoryByAi = (data: InventoryItem[], analysis: AiAnalysisResult): (InventoryItem & { matchScore: number, matchReason: string, nameScore: number, colorScore: number })[] => {
  const { simpleName, color } = analysis;

  const aiColorRgb = getRgbFromColorName(color);
  const hasAiColor = aiColorRgb !== null;

  // 1. Resolve Search Terms
  const searchTerms = synonymService.expandTerm(simpleName);
  const isFallback = synonymService.isFallback(simpleName);

  // 2. Pre-filter candidates based on Category/Name Logic ONLY
  const candidates = data.filter(item => {
    // Rule 1: Category Filtering
    if (!VALID_AI_CATEGORIES.includes(item.displayCategory)) return false;

    // Rule 2: Price Filtering (Strict <= $30)
    if (item.ListPrice > 30) return false;

    // Rule 3: Term Filtering
    if (isFallback) {
      return (item.nSubCategory || '').toLowerCase() === simpleName.toLowerCase(); // Fix lint
    } else {
      const desc = (item.Description || '').toLowerCase();
      const sub = (item.nSubCategory || '').toLowerCase();
      // Must match at least one term in Description or SubCategory
      return searchTerms.some(term => {
        const t = term.toLowerCase();
        return desc.includes(t) || sub.includes(t);
      });
    }
  });

  if (candidates.length === 0) return [];

  // 3. Calculate Raw Color Distances & Name Scores
  // We need to calculate distances first to find the Max Distance (L) for normalization
  const scoredCandidates = candidates.map(item => {
    let rawNameScore = 0;
    const sub = (item.nSubCategory || '').toLowerCase();

    // Name Logic: 60% if SubCat matches any term, or if Fallback matches exactly
    if (isFallback) {
      rawNameScore = 60;
    } else {
      const isSubMatch = searchTerms.some(t => sub === t.toLowerCase() || sub.includes(t.toLowerCase()));
      if (isSubMatch) rawNameScore = 60;
      else rawNameScore = 0; // User spec: "only 0 or 60%" for category, synonyms get same treatment
    }

    // Color Logic: Calculate Raw Euclidean Distance
    const itemColorRgb = getRgbFromColorName(item.Color || '');
    const distance = hasAiColor && itemColorRgb
      ? calculateColorDistance(aiColorRgb, itemColorRgb)
      : -1; // -1 means unknown/invalid color comparison

    return { item, rawNameScore, distance };
  });

  // 4. Find Max Distance (L) in the current set for Normalization
  let maxDistanceL = 0;
  scoredCandidates.forEach(c => {
    if (c.distance > maxDistanceL) maxDistanceL = c.distance;
  });

  // 5. Final Scoring with Relative Color Normalization
  const finalResults = scoredCandidates.map(({ item, rawNameScore, distance }) => {
    let colorScore = 0;

    if (distance !== -1 && maxDistanceL > 0) {
      // Formula: 40 - ((d / L) * 40)
      // Distance 0 (Same color) -> 40 - 0 = 40%
      // Distance L (Farthest) -> 40 - 40 = 0%
      const normalized = (distance / maxDistanceL) * 40;
      colorScore = 40 - normalized;
    } else if (distance === 0) {
      // Edge case: L=0 (all items have same color as AI) or only 1 item
      colorScore = 40;
    } else {
      // Invalid color comparison
      colorScore = 0;
    }

    // Round scores
    rawNameScore = Math.round(rawNameScore);
    colorScore = Math.round(colorScore);
    const totalScore = rawNameScore + colorScore;

    return {
      ...item,
      matchScore: totalScore,
      nameScore: rawNameScore,
      colorScore: colorScore,
      matchReason: `Total: ${totalScore}% (Name: ${rawNameScore}%, Color: ${colorScore}%)`
    };
  });

  // 6. Sorting Logic
  // Priority 1: Name Score (Desc) -> "按照类别匹配分优先"
  // Priority 2: Color Score (Desc) -> "颜色匹配分是第二排序"
  // Priority 3: Price (Asc)
  return finalResults
    .filter(i => i.matchScore > 10) // Basic noise filter
    .sort((a, b) => {
      if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
      if (b.colorScore !== a.colorScore) return b.colorScore - a.colorScore;
      return a.ListPrice - b.ListPrice;
    })
    .slice(0, 50);
};