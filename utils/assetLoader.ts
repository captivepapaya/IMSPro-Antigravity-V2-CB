
type AssetMap = Record<string, string>;

export const GENERAL_PRODUCT_NAMES = [
  "Bouquet", "Branch", "Flower", "Spray", "Leaves", "Succulent",
  "Bush", "Garland", "Hanging", "Tree", "HPot", "Pot", "Arrangement", 
  "Basket", "Other", "Grass", "Mat", "Moss", "Fruit", "Foam", "Gift", "Freight"
];

export const GENERAL_PRODUCT_MAPPING: Record<string, { Code: string, SKU: string }> = {
  "Bouquet": { Code: "GNBOUQUET", SKU: "L50059715" },
  "Branch": { Code: "GNBRANCH", SKU: "L50054166" },
  "Flower": { Code: "GNFLOWER", SKU: "L50049923" },
  "Spray": { Code: "GNSPRAY", SKU: "L50020416" },
  "Leaves": { Code: "GNLEAVES", SKU: "L50093133" },
  "Succulent": { Code: "GNSCULT", SKU: "L50023795" },
  "Bush": { Code: "GNBUSH", SKU: "L70057260" },
  "Garland": { Code: "GNGARLAND", SKU: "L70051963" },
  "Hanging": { Code: "GNHANGING", SKU: "L70061658" },
  "Tree": { Code: "GNTREE", SKU: "L90055433" },
  "Grass": { Code: "GNGRASS", SKU: "L70054122" },
  "Mat": { Code: "GNMAT", SKU: "L70071500" },
  "Moss": { Code: "GNMOSS", SKU: "L70079220" },
  "HPot": { Code: "GNHPOT", SKU: "L80060950" },
  "Pot": { Code: "GNPOT", SKU: "L80056095" },
  "Arrangement": { Code: "GNARMT", SKU: "L10056175" },
  "Basket": { Code: "GNBASKET", SKU: "L20356782" },
  "Fruit": { Code: "GNFRUIT", SKU: "L00544785" },
  "Other": { Code: "GNOTHER", SKU: "L80095634" },
  "Gift": { Code: "GNGIFT", SKU: "L80058450" },
  "Foam": { Code: "GNFOAM", SKU: "L80049170" },
  "Freight": { Code: "GNFREIGHT", SKU: "L80044355" }
};

// Global cache for pre-loaded images
const ICON_CACHE: Record<string, string> = {};

export const setGeneralProductIconCache = (name: string, url: string) => {
  ICON_CACHE[name] = url;
};

export const getGeneralProductIcon = (name: string): string | undefined => {
  if (!name) return undefined;
  // 1. Check Cache (Populated by App.tsx from WordPress)
  if (ICON_CACHE[name]) return ICON_CACHE[name];
  
  // 2. No local fallback anymore, must come from WP or Cache
  return undefined;
};

export const CATEGORY_ICONS: AssetMap = {};
export const SUPPLIER_ICONS: AssetMap = {};
export const GENERAL_PRODUCT_ICONS: AssetMap = {};
