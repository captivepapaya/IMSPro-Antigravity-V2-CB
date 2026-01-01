-- ========================================
-- PPI (Product-Parts-Inventory) Table Creation
-- Bill of Materials (BOM) Management for Manufactured Products
-- ========================================

-- Step 1: Create the ppi table
CREATE TABLE IF NOT EXISTS ppi (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  bom TEXT NOT NULL,
  qty_bom INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ppi_code ON ppi(code);
CREATE INDEX IF NOT EXISTS idx_ppi_bom ON ppi(bom);

-- Step 3: Create unique constraint to prevent duplicate code-bom pairs
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppi_code_bom ON ppi(code, bom);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE ppi ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policy to allow all operations
-- Note: Adjust this policy based on your security requirements
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON ppi;
CREATE POLICY "Enable all access for authenticated users" ON ppi
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 6: Create function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to call the function before updates
DROP TRIGGER IF EXISTS update_ppi_updated_at ON ppi;
CREATE TRIGGER update_ppi_updated_at
  BEFORE UPDATE ON ppi
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Verification Queries
-- ========================================

-- Check if table was created successfully
SELECT 
  table_name, 
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'ppi';

-- Check indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'ppi';

-- Check RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'ppi';

-- ========================================
-- Ready to import data!
-- After running this script, execute ppi_import.sql
-- to load the initial 214 records from PPI.csv
-- ========================================
