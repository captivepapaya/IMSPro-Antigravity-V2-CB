# BOM (Bill of Materials) 功能使用指南

## 📋 概述

BOM（Bill of Materials，物料清单）功能用于管理公司内部制造产品的原材料关系。当某些产品是由其他产品制造而成时，此功能可以记录和管理这种制造关系。

## 🎯 适用范围

- **供应商代码**: LL
- **产品SKU**: 首字母为 L
- **原材料来源**: Core数据库中的产品代码（除产品本身外）

## 📊 数据结构

### PPI.csv 文件结构
- **Code**: 被制造产品的产品代码
- **Bom**: 原材料的产品代码
- **QtyBom**: 每个被制造产品需要的原材料数量

### Supabase `ppi` 表结构
```sql
- id: 主键（自增）
- code: 产品代码
- bom: 原材料代码
- qty_bom: 数量（默认1）
- created_at: 创建时间
- updated_at: 更新时间
```

## 🚀 安装步骤

### 步骤 1: 创建Supabase表

1. 登录您的Supabase控制台
2. 进入SQL Editor
3. 执行 `ppi_create_table.sql` 文件中的SQL语句

### 步骤 2: 导入初始数据

1. 在Supabase SQL Editor中
2. 执行 `ppi_import.sql` 文件中的SQL语句
3. 这将导入214条初始BOM记录

### 步骤 3: 验证安装

在Supabase SQL Editor中运行以下查询：

```sql
-- 检查表是否创建成功
SELECT COUNT(*) FROM ppi;

-- 查看前10条记录
SELECT * FROM ppi LIMIT 10;

-- 检查特定产品的BOM
SELECT * FROM ppi WHERE code = 'PH2630FB';
```

## 💡 使用方法

### 在 Add New Product 页面

1. 选择供应商为 **LL**
2. 自动显示 **Bill of Materials (BOM)** 部分
3. 填写两个字段：
   - **Raw Material Code (BOM)**: 原材料的产品代码（必须是Core数据库中的有效代码）
   - **Quantity Required**: 需要的数量（1-9之间的整数，默认为1）
4. 点击 **Create Product** 保存

### 在 Product List 编辑页面

1. 在Product List中找到供应商为LL的产品
2. 点击左侧的笔图标进入编辑模式
3. 如果该产品有BOM数据，会自动加载显示
4. 可以修改BOM和QtyBom字段
5. 点击 **Save Changes** 保存

## ✅ 业务规则

### 保存规则

1. **同时填写**: Bom和QtyBom必须同时有值才允许保存
2. **都为空**: 可以都没有值（删除BOM关系）
3. **仅有Bom**: 如果仅填写Bom，QtyBom自动设为1
4. **仅有QtyBom**: 如果只填写QtyBom，该值将被忽略

### 数据验证

- **Bom字段**: 必须是Core数据库中存在的产品代码
- **QtyBom字段**: 必须是1-9之间的正整数
- **唯一性**: 同一个产品的同一个BOM不会重复（通过数据库唯一索引保证）

## 🎨 UI特性

### 视觉标识

- **黄色边框**: BOM部分使用黄色边框和标题，便于识别
- **动态显示**: 仅当供应商为LL时显示
- **加载状态**: 编辑时显示"Loading BOM data..."加载提示
- **颜色编码**: 
  - 有BOM值时显示黄色文字
  - QtyBom > 1时显示黄色，= 1时显示绿色

### 字段提示

- Bom字段下方提示："Must be a valid product code from Core database"
- QtyBom字段下方提示："How many units of BOM needed per product (1-9)"

## 📝 示例

### 示例 1: 创建带BOM的新产品

```
Product Code: PH2630FB
Supplier: LL
BOM: H-2630
QtyBom: 1
```

含义：产品PH2630FB需要1个H-2630作为原材料

### 示例 2: 多数量BOM

```
Product Code: HBFB121627
Supplier: LL
BOM: DB0121627
QtyBom: 3
```

含义：产品HBFB121627需要3个DB0121627作为原材料

## 🔧 技术实现

### 文件结构

```
d:\Projects\IMSProV2\
├── types.ts                          # 添加了PPIRecord接口
├── services/
│   └── ppiService.ts                 # PPI数据库操作服务
├── components/
│   ├── AddProduct.tsx                # 新增产品页面（已添加BOM字段）
│   └── InventorySearch.tsx           # 产品列表和编辑（已添加BOM字段）
├── ppi_create_table.sql              # 创建表SQL脚本
├── ppi_import.sql                    # 导入数据SQL脚本
└── PPI.csv                           # 原始数据文件
```

### API方法

`ppiService` 提供以下方法：

- `fetchAll()`: 获取所有PPI记录
- `fetchByCode(code)`: 获取特定产品的BOM记录
- `fetchByCodeAndBom(code, bom)`: 获取特定的BOM关系
- `upsert(code, bom, qtyBom)`: 创建或更新BOM记录
- `delete(code, bom)`: 删除特定BOM记录
- `deleteByCode(code)`: 删除产品的所有BOM记录
- `syncProductBom(code, bom, qtyBom)`: 同步产品BOM（主要方法）

## 🐛 故障排除

### 问题：BOM字段不显示

**解决方案**: 确保产品的供应商代码为"LL"

### 问题：保存时没有同步到数据库

**解决方案**: 
1. 检查浏览器控制台是否有错误
2. 确认Supabase连接正常
3. 检查RLS策略是否正确配置

### 问题：无法加载现有BOM数据

**解决方案**:
1. 检查产品Code是否正确
2. 在Supabase中查询: `SELECT * FROM ppi WHERE code = 'YOUR_CODE'`
3. 检查浏览器控制台的网络请求

## 📞 支持

如有问题，请检查：
1. 浏览器控制台日志
2. Supabase日志
3. 网络请求状态

## 🎉 完成！

BOM功能现已完全集成到您的系统中。您可以开始管理制造产品的原材料关系了！
