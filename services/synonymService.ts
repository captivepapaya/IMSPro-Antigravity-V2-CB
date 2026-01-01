
import Papa from 'papaparse';
import { SynonymRecord } from '../types';

const CATCODE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3NaYNHTQcbfWB-vlIDYO60xpgXu4S8dLj_wI2sZ9JC9NDI0kLNECVjRvlh3zfacEwLCKlP3ZL6ARF/pub?gid=404331006&single=true&output=csv';

class SynonymService {
  private records: SynonymRecord[] = [];
  private termMap: Map<string, string> = new Map();
  private familyMap: Map<string, string[]> = new Map();
  private specificTerms: string[] = [];
  private fallbackTerms: string[] = ['Other Greenery', 'Other Leaf', 'Other Spray', 'Other Flower'];

  // New Map for CatCodes: Key = "category|subcategory" (lowercase), Value = "000" (3 digit code)
  private catCodeMap: Map<string, string> = new Map();

  // Category and SubCategory lists from CatCode CSV
  private categoryList: string[] = [];
  private categorySubMap: Map<string, string[]> = new Map(); // Category -> [SubCategories]

  public async loadSynonyms(csvUrl: string) {
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error("Failed to fetch synonym CSV");
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          this.processData(results.data);
        }
      });
    } catch (e) {
      console.error("SynonymService Error:", e);
    }
  }

  // --- New Method for CatCode CSV ---
  public async loadCatCodeRules(customUrl?: string) {
    try {
      const response = await fetch(customUrl || CATCODE_SHEET_URL);
      if (!response.ok) throw new Error("Failed to fetch CatCode CSV");
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          this.processCatCodes(results.data, results.meta.fields || []);
        }
      });
    } catch (e) {
      console.error("CatCode Load Error:", e);
    }
  }

  private processCatCodes(data: any[], headers: string[]) {
    this.catCodeMap.clear();
    this.categoryList = [];
    this.categorySubMap.clear();

    // EXPLICIT COLUMN MAPPING (to avoid B/C confusion)
    // Column A (index 0) = Code
    // Column B (index 1) =      // Robust Header Detection
    // Goal: A=Code, C=Category, D=SubCategory

    // 1. Find Code (Column A)
    const codeHeader = headers.find(h => h.toLowerCase().includes('code')) || headers[0];

    // 2. Find Category (Column C) - Prioritize exact match for "Category" to avoid picking "nCategory"
    // First try exact match (case-insensitive)
    let catHeader = headers.find(h => h.toLowerCase().trim() === 'category');
    // If not found, fall back to loose match excluding 'n' prefix and 'sub'
    if (!catHeader) {
      catHeader = headers.find(h => {
        const lower = h.toLowerCase();
        return lower.includes('category') && !lower.includes('sub') && !lower.startsWith('n');
      }) || headers[2]; // Final fallback to index 2
    }

    // 3. Find SubCategory (Column D) - Must include 'Sub'
    const subHeader = headers.find(h => h.toLowerCase().includes('sub')) || headers[3]; // Fallback to index 3

    console.log('CatCode CSV Headers:', headers);

    // Use explicit indices to avoid confusion
    // const codeHeader = headers[0];      // A: Code
    // const catHeader = headers[2];       // C: Category (NOT B!)
    // const subHeader = headers[3];       // D: nSubCategory

    if (!codeHeader || !catHeader || !subHeader) {
      console.error('Missing required columns in CatCode CSV. Headers:', headers);
      return;
    }

    console.log(`Using columns: Code="${codeHeader}", Category="${catHeader}", SubCategory="${subHeader}"`);

    const categorySet = new Set<string>();
    const tempCatSubMap: Map<string, Set<string>> = new Map();

    data.forEach(row => {
      const codeRaw = row[codeHeader];
      const catRaw = row[catHeader];
      const subRaw = row[subHeader];

      if (codeRaw && catRaw && subRaw) {
        // Preserve Category format: Keep original case (e.g. "Plants" stays "Plants")
        // Only remove "ARTIFICIAL " or "Artificial " prefix if present
        let cleanCat = String(catRaw).trim();
        cleanCat = cleanCat.replace(/^ARTIFICIAL\s+/i, '');  // Case-insensitive removal

        // Normalize SubCategory: Keep original case for display
        const cleanSub = String(subRaw).trim();
        const cleanSubLower = cleanSub.toLowerCase();

        const key = `${cleanCat.toLowerCase()}|${cleanSubLower}`;

        // Pad Code to 3 digits (e.g. "1" -> "001")
        let cleanCode = String(codeRaw).trim();
        // Only pad if it looks like a number
        if (/^\d+$/.test(cleanCode)) {
          cleanCode = cleanCode.padStart(3, '0');
        }

        this.catCodeMap.set(key, cleanCode);

        // Build category list and category->subcategory mapping
        categorySet.add(cleanCat);
        if (!tempCatSubMap.has(cleanCat)) {
          tempCatSubMap.set(cleanCat, new Set<string>());
        }
        tempCatSubMap.get(cleanCat)!.add(cleanSub);
      }
    });

    // Convert sets to sorted arrays
    this.categoryList = Array.from(categorySet).sort();
    tempCatSubMap.forEach((subSet, cat) => {
      this.categorySubMap.set(cat, Array.from(subSet).sort());
    });

    console.log(`Loaded ${this.catCodeMap.size} CatCode rules, ${this.categoryList.length} categories from CatCode CSV`);
  }

  private processData(data: any[]) {
    this.records = [];
    this.termMap.clear();
    this.familyMap.clear();
    this.specificTerms = [];

    data.forEach(row => {
      if (!row.nSubCategory) return;

      const record: SynonymRecord = {
        CatCode: row.CatCode ? String(row.CatCode).trim() : '',
        nCategory: row.nCategory ? String(row.nCategory).trim() : '',
        nSubCategory: row.nSubCategory ? String(row.nSubCategory).trim() : '',
        Singular: row.Singular ? row.Singular.trim() : '',
        Synonyms: row.Synonyms ? row.Synonyms.split(/[,/]+/).map((s: string) => s.trim()).filter(Boolean) : []
      };

      if (this.fallbackTerms.some(fb => fb.toLowerCase() === record.nSubCategory.toLowerCase())) return;

      this.records.push(record);

      const officialSubCat = record.nSubCategory.trim();
      const lowerOfficial = officialSubCat.toLowerCase();

      const familySet = new Set<string>();

      familySet.add(officialSubCat);
      this.termMap.set(lowerOfficial, officialSubCat);

      if (record.Singular) {
        this.termMap.set(record.Singular.toLowerCase(), officialSubCat);
        this.specificTerms.push(record.Singular);
        familySet.add(record.Singular);
      }

      record.Synonyms.forEach(syn => {
        this.termMap.set(syn.toLowerCase(), officialSubCat);
        if (!this.specificTerms.includes(syn)) {
          this.specificTerms.push(syn);
        }
        familySet.add(syn);
      });

      this.familyMap.set(lowerOfficial, Array.from(familySet));
    });
  }

  public getAiVocabulary(): string[] { return this.specificTerms; }
  public getFallbackCategories(): string[] { return this.fallbackTerms; }

  public expandTerm(term: string): string[] {
    if (!term) return [];
    const cleanTerm = term.trim();
    const lower = cleanTerm.toLowerCase();

    if (this.fallbackTerms.some(f => f.toLowerCase() === lower)) return [cleanTerm];

    const officialSubCat = this.termMap.get(lower);

    if (officialSubCat) {
      const family = this.familyMap.get(officialSubCat.toLowerCase());
      if (family && family.length > 0) return family;
    }

    return [cleanTerm];
  }

  public isFallback(term: string): boolean {
    return this.fallbackTerms.some(f => f.toLowerCase() === term.trim().toLowerCase());
  }

  /**
   * Finds the 3-digit CatCode based on Category and SubCategory match from the loaded CSV.
   */
  public findCatCode(category: string, subCategory: string): string {
    const key = `${category.trim().toLowerCase()}|${subCategory.trim().toLowerCase()}`;
    const found = this.catCodeMap.get(key);

    if (!found) {
      console.warn(`CatCode not found for Category="${category}", SubCategory="${subCategory}"`);
      console.warn(`Lookup key: [${key}]`);
    }
    return found || '';
  }

  /**
   * Get list of unique Categories from CatCode CSV (C column)
   */
  public getCategories(): string[] {
    return this.categoryList;
  }

  /**
   * Get list of SubCategories for a given Category from CatCode CSV (D column)
   */
  public getSubCategories(category: string): string[] {
    return this.categorySubMap.get(category.trim()) || [];
  }
}

export const synonymService = new SynonymService();
