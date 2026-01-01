
import Papa from 'papaparse';
import { GENERAL_PRODUCT_MAPPING } from '../utils/assetLoader';

export interface GeneralOption {
  name: string;
  letter: string;
  freq: number;
}

// Group 2: Show options only if freq > 1 (DEPRECATED: Now all groups behave the same)
const GROUP_2_CATEGORIES = ['Flower', 'Spray', 'Leaves', 'Bush', 'Hanging', 'Hpot', 'Pot'];

class GeneralConfigService {
  private configUrl: string | null = null;
  // Map<SKU, OptionsList>
  private data: Map<string, GeneralOption[]> = new Map();
  // Map<SKU, CategoryName> for Group logic lookup
  public skuToCategory: Map<string, string> = new Map();
  public isLoaded: boolean = false;

  public async loadConfig(url: string) {
    this.configUrl = url;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch general config CSV");
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          this.processData(results.data, results.meta.fields || []);
          this.isLoaded = true;
          console.log("GeneralConfigService Loaded. Available SKUs:", Array.from(this.data.keys()));
        }
      });
    } catch (e) {
      console.error("GeneralConfigService Error:", e);
    }
  }

  private findHeader(headers: string[], target: string): string | null {
    const t = target.toLowerCase().trim();
    const found = headers.find(h => h.toLowerCase().trim() === t);
    if (found) return found;
    // Loose match for potential hidden chars or extra naming
    const loose = headers.find(h => h.toLowerCase().trim().includes(t));
    return loose || null;
  }

  private processData(rows: any[], headers: string[]) {
    this.data.clear();
    this.skuToCategory.clear();

    // Iterate through the static mapping to find columns in the CSV
    Object.entries(GENERAL_PRODUCT_MAPPING).forEach(([catName, mapping]) => {
      const targetSku = mapping.SKU; // e.g. L50059715 (Bouquet), L50049923 (Flower)
      this.skuToCategory.set(targetSku, catName);

      // Mapping Rules:
      // Main SKU Column (e.g. L50059715) -> Name
      // Suffix 'a' (e.g. L50059715a) -> Frequency

      const nameKey = this.findHeader(headers, targetSku);
      const freqKey = this.findHeader(headers, targetSku + 'a');

      // Need at least the Name column
      if (!nameKey) {
        console.log(`[General Config] Skipping ${catName} - column not found (Expected: ${targetSku})`);
        return;
      }

      const options: GeneralOption[] = [];

      rows.forEach(row => {
        const nameRaw = row[nameKey];
        if (!nameRaw || !String(nameRaw).trim()) return;
        const name = String(nameRaw).trim();

        const freqVal = freqKey ? row[freqKey] : '0';
        const freq = parseInt(freqVal || '0', 10);

        // Logic Update: No longer filtering based on Freq for Group 2.
        // All items are processed regardless of frequency value.

        // Derive letter from Name for consistency (User reported disordered relationship with column b)
        // We use the first letter of the Name.
        const derivedLetter = name.charAt(0).toUpperCase();

        options.push({
          name: name,
          freq: freq,
          letter: derivedLetter
        });
      });

      if (options.length > 0) {
        // Sort alphabetically by name
        options.sort((a, b) => a.name.localeCompare(b.name));
        this.data.set(targetSku, options);
      }
    });
  }

  public hasConfig(sku: string): boolean {
    return this.data.has(sku);
  }

  public getOptions(sku: string, filterMode: 'ALL' | string): GeneralOption[] {
    const options = this.data.get(sku) || [];

    if (filterMode === 'ALL') {
      return options;
    }

    if (filterMode === 'GN') return [];

    // Filter by Derived Letter (Name Start)
    return options.filter(o => o.name.toUpperCase().startsWith(filterMode));
  }

  public getUniqueLetters(sku: string): string[] {
    const options = this.data.get(sku) || [];
    // Calculate available letters from the valid (filtered) items
    const letters = new Set<string>();
    options.forEach(o => {
      const firstChar = o.name.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar);
      }
    });
    return Array.from(letters).sort();
  }
}

export const generalConfigService = new GeneralConfigService();
