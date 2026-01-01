# Manufacture Hub 集成指南

## 📋 已完成的工作

### 1. 类型定义 ✅
- 在 `types.ts` 中添加了 `ManufactureOrderItem` 和 `ManufactureOrder` 接口
- 支持制造订单的完整数据结构

### 2. 服务层 ✅
- 创建了 `services/manufactureOrderService.ts`
- 提供完整的CRUD操作
- 自动生成订单号（格式：YYYYMMDDM）
- Comment字段管理（最多3条记录）

### 3. Supabase数据库 ✅
- 创建了 `manufacture_orders_create_table.sql`
- 包含表结构、索引、RLS策略
- 准备好执行

### 4. UI组件 ✅
- 创建了 `components/ManufactureHub.tsx`
- 完整的制造订单管理界面
- 智能产品代码搜索
- 自动BOM数据加载
- 库存自动更新

## 🚀 集成步骤

### 步骤1: 创建Supabase表

在Supabase SQL Editor中执行：
```sql
-- 执行 manufacture_orders_create_table.sql 中的所有SQL
```

### 步骤2: 在App.tsx中集成ManufactureHub

ManufactureHub组件已经创建并导入到App.tsx中（第33行）。

现在需要在主渲染区域添加视图渲染。由于App.tsx文件结构复杂，请按以下方式手动添加：

#### 方法A: 如果使用条件渲染

在App.tsx的主内容区域找到类似这样的代码：

```typescript
{currentView === AppView.INVENTORY && (
  <Suspense fallback={<LoadingFallback />}>
    <InventorySearch ... />
  </Suspense>
)}
```

在适当位置添加：

```typescript
{currentView === AppView.MANUFACTURING && (
  <Suspense fallback={<LoadingFallback />}>
    <ManufactureHub 
      googleScriptUrl={googleScriptUrl} 
      appMode={appMode}
    />
  </Suspense>
)}
```

#### 方法B: 如果使用switch语句

```typescript
case AppView.MANUFACTURING:
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ManufactureHub 
        googleScriptUrl={googleScriptUrl} 
        appMode={appMode}
      />
    </Suspense>
  );
```

## 🧪 Test模式功能

### 新增功能：Test模式支持

ManufactureHub现在支持Test模式！

#### Test模式行为
- **Normal模式**: 
  - 保存订单到Supabase
  - 更新Core数据库库存
  - 同步到Google Sheet
  
- **Test模式**: 
  - ✅ 保存订单到Supabase
  - ❌ **不更新**Core数据库
  - ❌ **不同步**到Google Sheet
  - 🧪 显示Test模式标识

#### 视觉标识
在Test模式下，页面右上角会显示橙色的"TEST MODE"标识：
```
🧪 TEST MODE
```

#### 成功消息
- **Normal模式**: "Manufacture order 20251224M completed successfully!"
- **Test模式**: "🧪 TEST MODE: Order 20251224M saved to database only (inventory not updated)"

#### 使用场景
1. **测试订单流程**: 不影响实际库存
2. **培训新员工**: 安全的练习环境
3. **验证BOM数据**: 检查产品和原材料关系
4. **调试问题**: 不会造成数据混乱

## 📖 功能说明

### 订单号生成
- 格式：`YYYYMMDDM`
- 示例：`20251224M` (2025年12月24日的制造订单)
- 自动基于当前日期生成

### 产品列表

每行包含：
1. **Product Code**: 智能搜索选择器（大小写和标点符号不敏感）
2. **BOM Code**: 自动从PPI数据库加载
3. **Qty/Unit**: 每个产品需要的BOM数量
4. **Qty Produced**: 生产数量（1-99）
5. **Action**: 删除按钮（仅新订单）

### 数据流程

#### 创建新订单
1. 选择 "New Manufacture Order"
2. 添加产品行
3. 输入Product Code（自动加载BOM）
4. 设置生产数量
5. 点击 "Complete Order"

#### 数据保存
1. **Supabase `manufacture_orders` 表**
   - 保存每行产品记录
   - 包含订单号、产品代码、BOM代码、数量

2. **Core数据库更新**
   - **制造产品**: Total +N, Stock +N
   - **原材料**: Stock -(QtyBom × N), Sold +(QtyBom × N)
   - **Comment**: 添加订单号记录

3. **Google Sheet同步**
   - 通过googleScriptUrl同步更新

### 查看历史订单
1. 在订单选择器中选择已有订单
2. 显示订单详情（只读）
3. 无删除按钮

## 🎨 UI特性

### 智能搜索
- 大小写不敏感
- 标点符号不敏感
- 实时过滤
- 最多显示50个结果

### 视觉设计
- 蓝色/紫色主题
- 清晰的表格布局
- 响应式设计
- 加载状态提示

### 用户体验
- 自动BOM数据加载
- 输入验证
- 错误提示
- 成功反馈

## 📝 示例

### 示例数据

假设：
- Product Code: `A`
- BOM Code: `X` (从PPI自动加载)
- QtyBom: `2` (从PPI自动加载)
- Quantity Produced: `5`

结果：
- 产品A: Total +5, Stock +5
- 原材料X: Stock -10, Sold +10
- 两者Comment都添加订单号

## 🔧 技术细节

### 依赖项
- `ppiService`: BOM数据查询
- `coreService`: 库存更新
- `manufactureOrderService`: 订单管理
- `useToast`: 用户反馈

### 状态管理
- `selectedOrderId`: 当前选择的订单
- `currentOrderId`: 新订单的ID
- `orderRows`: 产品列表
- `isLoading`: 加载状态
- `isSaving`: 保存状态

### API调用
1. `fetchAllOrders()`: 加载所有订单
2. `fetchOrderById()`: 加载订单详情
3. `fetchByCode()`: 加载BOM数据
4. `createOrder()`: 创建新订单
5. `updateProductWithSync()`: 更新库存

## ⚠️ 注意事项

1. **Supabase表必须先创建**
   - 执行 `manufacture_orders_create_table.sql`

2. **PPI数据必须存在**
   - 产品的BOM关系必须在PPI表中

3. **Google Script URL**
   - 必须配置才能同步到Google Sheet

4. **库存验证**
   - 确保原材料库存足够
   - 系统不会自动检查库存是否充足

## 🎯 下一步

1. 在Supabase中执行SQL创建表
2. 在App.tsx中添加ManufactureHub渲染
3. 测试功能
4. 验证库存更新
5. 检查Google Sheet同步

## 📚 相关文件

- `types.ts`: 类型定义
- `services/manufactureOrderService.ts`: 订单服务
- `services/ppiService.ts`: BOM服务
- `services/coreService.ts`: 库存服务
- `components/ManufactureHub.tsx`: UI组件
- `manufacture_orders_create_table.sql`: 数据库脚本

---

所有代码已准备就绪！只需完成Supabase表创建和App.tsx集成即可使用。
