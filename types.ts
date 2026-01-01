
export interface CsvFile {
  id: string;
  name: string;
  size: number;
  rowCount: number;
  headers: string[];
  data: any[];
  preview: any[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
}

export enum AppView {
  DATA_SOURCES = 'DATA_SOURCES',
  INVENTORY = 'INVENTORY',
  ADD_PRODUCT = 'ADD_PRODUCT',
  PRODUCT_DETAILS = 'PRODUCT_DETAILS',
  AI_TERMINAL = 'AI_TERMINAL',
  VCA_AGENT = 'VCA_AGENT', // NEW VCA MODULE
  ORDERS = 'ORDERS',
  SEO = 'SEO',
  BARCODE_PRINT = 'BARCODE_PRINT',
  CAMERA_LAB = 'CAMERA_LAB',
  IMAGE_CHECK = 'IMAGE_CHECK',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  WORDPRESS = 'WORDPRESS', // Legacy - now used as PRODUCT_REVIEW_QUEUE
  PRODUCT_REVIEW_QUEUE = 'PRODUCT_REVIEW_QUEUE',
  ADD_PRODUCT_QUEUE = 'ADD_PRODUCT_QUEUE',
  SETTINGS = 'SETTINGS',
  AI_SETTINGS = 'AI_SETTINGS', // NEW AI SETTINGS
  VENDOR_REVIEW = 'VENDOR_REVIEW',
  MANUFACTURING = 'MANUFACTURING',
  PO_IMPORT = 'PO_IMPORT'
}

export interface AnalysisContext {
  files: CsvFile[];
  apiKey: string;
}

export interface InventoryItem {
  Code: string;
  SU: string;
  SKU: string;
  Barcode: string;
  Description: string;
  HL: number;
  Qty: number;
  Stock: number;
  Sold: number;
  Color?: string;
  Cluster?: string; // K
  AttColor?: string; // L
  Location: string;
  Comment: string; // N
  CatCode?: string; // O
  ModelCode?: string; // P
  Category: string; // Q
  SubCat: string; // R
  NetCost: number; // S
  DiscRate: number; // T
  FinalCost: number; // U
  RefPrice: number; // V
  ListPrice: number; // W
  SalePrice: number; // X
  PostID?: string; // Y
  PostStatus?: string; // Z
  StockStatus: string; // AA
  nCategory?: string; // AB
  nSubCategory?: string; // AC
  ProductTag?: string; // AD
  ProductStyle?: string; // AE
  PostTitle?: string; // AF
  PostSlug?: string; // AG
  PostContent?: string; // AH
  PostShortDesc?: string; // AI
  ProductCat?: string; // AJ
  FocusKW?: string; // AK
  MetaTitle?: string; // AL
  MetaDesc?: string; // AM
  ProductPage?: string; // AN
  Images?: string; // AO
  Image?: string; // AP
  TapPrtName?: string; // AQ
  PNDesc?: string; // AR
  PNLen?: number; // AS
  Per?: number; // AT
  [key: string]: any;
}

export interface FilterParams {
  keywords?: string;
  minPrice?: number;
  maxPrice?: number;
  minHL?: number;
  maxHL?: number;
  suppliers?: string[];
  category?: string;
  subCats?: string[];
  inStockOnly?: boolean;
}

export interface WordPressConfig {
  url: string;
  username?: string;
  appPassword?: string;
}

export type ScanMode = 'idle' | 'gun' | 'camera' | 'ai' | 'ip' | 'general';

export interface AiAnalysisResult {
  simpleName: string;
  matchedSubCategories: string[];
  inferredSubCategory: string;
  color: string;
  description: string;
}

export interface SynonymRecord {
  CatCode: string;
  nCategory: string;
  nSubCategory: string;
  Singular: string;
  Synonyms: string[];
}

export type OrderStatus = 'Completed' | 'Hold' | 'Cancelled' | 'Void';
export type AppMode = 'Normal' | 'Test';

export interface OrderHeader {
  INDEX: string;
  TIME: string;
  ID: string;
  REFTOTAL: number;
  ALLDISC: number;
  NEEDTOPAY: number;
  PAIDBY: 'Cash' | 'Card' | 'Online';
  PERCENT_DISC: number;
  DOLLAR_DISC: number;
  FINALSET: number;
  OSTATUS: OrderStatus;
  UUID: string;
  OTN: AppMode;
  IS_SYNCED?: boolean;
  created_at?: string;
}

export interface OrderItem {
  INDEX: string;
  TIME: string;
  CODE: string;
  SKU: string;
  GNINDEX: string;
  QTY: number;
  PRICE: number;
  ITEMDISC: number;
  SUBTOTAL: number;
  UUID: string;
  DESC?: string; // Optional description for printing (not saved to DB)
}

export interface CartItem extends InventoryItem {
  cartId: string;
  quantity: number;
  discountType: 'percent' | 'amount' | null;
  discountValue: number;
  imageUrl?: string | null;
  isGeneralProduct?: boolean;
  gnIndexLetter?: string;
}

export interface OrderState {
  uuid: string;
  orderId: string;
  items: CartItem[];
  sysPercent: number;
  sysAmount: number;
  finalPriceOverride: number | null;
  customerId: string;
  paymentMethod: 'Cash' | 'Card' | 'Online';
}

export interface ProductImageRecord {
  id: string;
  sku: string;
  image_url: string;
  wp_id?: number;
  variant_type: 'main' | 'variant';
  sort_order: number;
  created_at: string;
}

export interface PrinterConfig {
  receiptPrinter: string;
  labelPrinter: string;
  waybillPrinter: string;
}

export interface OrderMedia {
  id?: number;
  orderId: string;
  type: 'image' | 'video';
  blob: Blob;
  timestamp: number;
}

export interface LoginConfig {
  isEnabled: boolean;
  password: string;
}

export interface AddProductQueueItem {
  id?: number;
  sequence_number: number;
  code: string;
  sku: string;
  description: string;
  created_at?: string;
}

export interface ProductReviewQueueItem {
  id?: number;
  sequence_number: number;
  code: string;
  sku: string;
  description: string;
  created_at?: string;
}

export interface PPIRecord {
  id?: number;
  code: string;
  bom: string;
  qty_bom: number;
  created_at?: string;
  updated_at?: string;
}

export interface ManufactureOrderItem {
  id?: number;
  order_id: string;
  product_code: string;
  bom_code: string;
  qty_bom: number;
  quantity_produced: number;
  created_at?: string;
}

export interface ManufactureOrder {
  order_id: string;
  created_at?: string;
  items?: ManufactureOrderItem[];
}


