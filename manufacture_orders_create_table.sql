-- ========================================
-- Manufacture Orders Table Creation
-- Manufacturing Order Management System
-- ========================================

-- Step 1: Create the manufacture_orders table
CREATE TABLE IF NOT EXISTS manufacture_orders (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  bom_code TEXT NOT NULL,
  qty_bom INTEGER NOT NULL,
  quantity_produced INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_manufacture_orders_order_id ON manufacture_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_manufacture_orders_product_code ON manufacture_orders(product_code);
CREATE INDEX IF NOT EXISTS idx_manufacture_orders_created_at ON manufacture_orders(created_at DESC);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE manufacture_orders ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policy to allow all operations
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON manufacture_orders;
CREATE POLICY "Enable all access for authenticated users" ON manufacture_orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========================================
-- Verification Queries
-- ========================================

-- Check if table was created successfully
SELECT 
  table_name, 
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'manufacture_orders';

-- Check columns
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'manufacture_orders'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'manufacture_orders';

-- Check RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'manufacture_orders';

-- ========================================
-- Sample Data (Optional - for testing)
-- ========================================

-- Example: Insert a sample manufacture order
-- INSERT INTO manufacture_orders (order_id, product_code, bom_code, qty_bom, quantity_produced) VALUES
-- ('20251224M', 'PH2630FB', 'H-2630', 1, 10),
-- ('20251224M', 'PH2602GR', 'H-2602Gr', 1, 5);

-- ========================================
-- Query Examples
-- ========================================

-- Get all orders
-- SELECT DISTINCT order_id, created_at 
-- FROM manufacture_orders 
-- ORDER BY created_at DESC;

-- Get specific order details
-- SELECT * FROM manufacture_orders 
-- WHERE order_id = '20251224M' 
-- ORDER BY created_at;

-- Get orders by date
-- SELECT * FROM manufacture_orders 
-- WHERE created_at::date = '2025-12-24'
-- ORDER BY created_at DESC;

-- ========================================
-- Ready to use!
-- The manufacture_orders table is now ready for the Manufacture Hub feature
-- ========================================
