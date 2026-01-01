# Product List 数据流向说明

## 📊 当前数据流

### 1. Product List 显示的数据来源

```
App.tsx 初始化时:
1. 尝试从 Supabase Core 表加载数据
2. 如果成功 → 使用 Supabase 数据
3. 如果失败 → 回退到 CSV 文件
```

**代码位置**: `App.tsx` 第386-407行

```typescript
const sbItems = await coreService.fetchCoreFromSupabase();
if (sbItems.length > 0) {
    setFiles([sbFile]); // 使用 Supabase 数据
    loadedFromSupabase = true;
}
```

### 2. Edit Modal 显示的数据来源

```
打开 Edit Modal 时:
1. 使用传入的 item 参数（来自 Product List 的内存数据）
2. BOM 数据从 PPI Supabase 表重新加载
3. 其他字段（包括 Comment）不会重新加载
```

**代码位置**: `InventorySearch.tsx` 第232行

```typescript
const [formData, setFormData] = useState<InventoryItem>({
    ...item,  // ← 使用传入的 item，不重新从数据库加载
    Model: item.Model || extractedModel
});
```

## ⚠️ 问题分析

### 您遇到的问题

```
Google Sheet: Comment = "2025-11-05;251222-005S"
Product List Edit: Comment = "2025-11-05"
```

**原因**:
1. Product List 在页面加载时从 Supabase 加载数据
2. 如果 Supabase 中的数据是旧的，Product List 就会显示旧数据
3. Edit Modal 使用 Product List 的内存数据，所以也显示旧数据

## 🔄 数据同步流程

### 完整的数据流

```
Google Sheet (源数据)
    ↓
Core Database (Supabase) ← 需要手动同步
    ↓
Product List (内存) ← App 启动时加载
    ↓
Edit Modal (内存) ← 打开 Edit 时传入
```

### 同步点

1. **Google Sheet → Supabase**: 
   - 需要手动触发同步
   - 或者使用 Google Apps Script 自动同步

2. **Supabase → Product List**:
   - App 启动时自动加载
   - 刷新页面会重新加载

3. **Product List → Edit Modal**:
   - 打开 Edit 时传入
   - 不会重新从数据库加载

## ✅ 解决方案

### 方案1: 刷新页面（临时）
```
刷新浏览器 → 重新从 Supabase 加载 → 获取最新数据
```

### 方案2: 添加"刷新"按钮（推荐）
在 Product List 添加一个刷新按钮，重新从 Supabase 加载数据

### 方案3: Edit Modal 打开时重新加载（最准确）
修改 Edit Modal，打开时从 Supabase 重新加载该产品的完整数据

### 方案4: 自动同步 Google Sheet → Supabase
设置定时任务或触发器，自动同步 Google Sheet 到 Supabase

## 🔍 检查数据是否最新

### 1. 检查 Supabase 数据
```sql
SELECT "Comment" FROM core WHERE "Code" = 'YOUR_PRODUCT_CODE';
```

### 2. 检查 Google Sheet
直接查看 Google Sheet 中的数据

### 3. 对比
如果 Supabase 和 Google Sheet 不一致，说明需要同步

## 📝 建议

1. **确认数据源**: 确定 Google Sheet 是否是唯一的真实数据源
2. **设置同步**: 如果 Google Sheet 是主数据源，需要设置自动同步到 Supabase
3. **添加刷新功能**: 在 Product List 添加手动刷新按钮
4. **考虑实时性**: 如果需要实时数据，Edit Modal 应该在打开时重新加载

## 🎯 当前状态总结

| 数据 | 来源 | 更新时机 |
|------|------|---------|
| Product List | Supabase Core 表 | App 启动时 |
| Edit Modal (基本信息) | Product List 内存 | 打开 Edit 时 |
| Edit Modal (BOM) | Supabase PPI 表 | 打开 Edit 时 |
| Google Sheet | 手动编辑 | 实时 |

**结论**: Product List 显示的是 Supabase 的数据，但 Supabase 可能不是最新的（需要从 Google Sheet 同步）。
