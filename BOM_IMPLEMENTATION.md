# BOM (Bill of Materials) 实施方案

## 概述
为LL供应商的制造产品添加BOM（原材料清单）管理功能。

## 数据库设计

### Supabase表：`ppi`

```sql
CREATE TABLE ppi (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  bom TEXT NOT NULL,
  qty_bom INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ppi_code ON ppi(code);
CREATE INDEX idx_ppi_bom ON ppi(bom);
CREATE UNIQUE INDEX idx_ppi_code_bom ON ppi(code, bom);

ALTER TABLE ppi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON ppi
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ppi_updated_at
  BEFORE UPDATE ON ppi
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 业务规则

1. **适用范围**：仅供应商代码为"LL"的产品显示BOM字段
2. **字段关系**：
   - `Code`: 被制造产品的产品代码（来自Core数据库）
   - `Bom`: 原材料的产品代码（来自Core数据库，不包括自身）
   - `QtyBom`: 每个被制造产品需要的原材料数量（默认为1）

3. **验证规则**：
   - Bom和QtyBom必须同时有值才允许保存
   - 可以都没有值
   - 如果仅有Bom，QtyBom默认为1
   - 如果只有QtyBom，则放弃该值

## 文件修改清单

### 1. 类型定义 (`types.ts`)
- 添加`PPIRecord`接口

### 2. PPI服务 (`services/ppiService.ts`)
- 创建新服务文件
- 实现CRUD操作

### 3. AddProduct组件 (`components/AddProduct.tsx`)
- 添加Bom和QtyBom字段
- 仅当SU="LL"时显示
- 保存时同步到PPI表

### 4. EditItemModal组件 (`components/InventorySearch.tsx`)
- 在EditItemModal中添加Bom和QtyBom字段
- 仅当SU="LL"时显示
- 保存时同步到PPI表

## 实施步骤

1. ✅ 查看PPI.csv文件
2. ⏳ 创建Supabase表（用户手动执行SQL）
3. ⏳ 导入PPI.csv数据（用户手动执行SQL）
4. ⏳ 添加类型定义
5. ⏳ 创建ppiService
6. ⏳ 修改AddProduct组件
7. ⏳ 修改EditItemModal组件
8. ⏳ 测试功能

## SQL导入脚本

已生成在 `ppi_import.sql` 文件中，包含214条记录。
