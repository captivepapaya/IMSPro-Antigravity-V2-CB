# Manufacture Hub 调试指南

## 🔍 问题：下拉框不显示产品代码

### 步骤1: 检查浏览器控制台

1. 打开浏览器（Chrome/Edge）
2. 按 `F12` 打开开发者工具
3. 点击 `Console` 标签
4. 进入 Manufacture Hub 页面
5. 点击 "Add First Item"
6. 点击 Product Code 输入框

### 应该看到的日志：

#### 正常情况：
```
🔍 Loading product codes from PPI table...
📊 Fetched 214 PPI records
✅ Loaded 156 unique product codes: ["PH2029FB", "PH2602GR", ...]
📦 ProductCodeSelector received 156 codes
🎯 Input focused, opening dropdown
📋 No filter - showing 50 codes from 156 total
```

#### PPI表为空：
```
🔍 Loading product codes from PPI table...
📊 Fetched 0 PPI records
⚠️ PPI table is empty! No products available for manufacturing.
```

#### 加载错误：
```
🔍 Loading product codes from PPI table...
❌ Error loading product codes from PPI: [错误信息]
```

---

## 🛠️ 故障排除

### 情况1: 看到 "Fetched 0 PPI records"

**原因**: PPI表是空的

**解决方案**:
1. 检查Supabase中的PPI表
2. 确认已执行 `ppi_create_table.sql`
3. 确认已导入PPI数据（214条记录）

**验证SQL**:
```sql
-- 在Supabase SQL Editor中执行
SELECT COUNT(*) FROM ppi;
-- 应该返回 214

SELECT * FROM ppi LIMIT 10;
-- 应该显示产品数据
```

---

### 情况2: 看到错误信息

**可能的错误**:

#### 错误A: "relation 'ppi' does not exist"
**原因**: PPI表未创建
**解决**: 执行 `ppi_create_table.sql`

#### 错误B: "permission denied"
**原因**: RLS策略问题
**解决**: 检查RLS策略是否正确设置

#### 错误C: "Failed to fetch"
**原因**: Supabase连接问题
**解决**: 检查网络连接和Supabase配置

---

### 情况3: 日志显示加载成功但下拉框不显示

**检查点**:

1. **确认看到这些日志**:
```
📦 ProductCodeSelector received 156 codes  ← 重要！
🎯 Input focused, opening dropdown
📋 No filter - showing 50 codes from 156 total
```

2. **检查React DevTools**:
   - 安装 React Developer Tools 浏览器扩展
   - 查看 ManufactureHub 组件
   - 检查 `availableProductCodes` 状态

3. **检查CSS/Z-index**:
   - 下拉框可能被其他元素遮挡
   - 检查 `z-50` 是否足够高

---

## 🧪 手动测试PPI连接

在浏览器控制台中执行：

```javascript
// 测试1: 检查Supabase客户端
const { getSupabase } = await import('./services/supabaseClient.js');
const supabase = getSupabase();
console.log('Supabase client:', supabase);

// 测试2: 直接查询PPI表
const { data, error } = await supabase.from('ppi').select('*').limit(10);
console.log('PPI data:', data);
console.log('PPI error:', error);

// 测试3: 获取唯一代码
const { data: allData } = await supabase.from('ppi').select('code');
const uniqueCodes = [...new Set(allData.map(r => r.code))];
console.log('Unique codes:', uniqueCodes);
```

---

## 📊 Supabase检查清单

### 1. 检查表是否存在
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'ppi';
```

### 2. 检查数据
```sql
SELECT COUNT(*) as total_records FROM ppi;
SELECT COUNT(DISTINCT code) as unique_codes FROM ppi;
```

### 3. 检查示例数据
```sql
SELECT code, bom, qty_bom 
FROM ppi 
ORDER BY code 
LIMIT 10;
```

### 4. 检查RLS策略
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'ppi';
```

---

## 🎯 快速诊断命令

在浏览器控制台粘贴并执行：

```javascript
// 一键诊断
(async () => {
  console.log('=== Manufacture Hub 诊断 ===');
  
  try {
    const { ppiService } = await import('./services/ppiService.js');
    const records = await ppiService.fetchAll();
    
    console.log(`✅ PPI Records: ${records.length}`);
    
    if (records.length > 0) {
      const codes = [...new Set(records.map(r => r.code))];
      console.log(`✅ Unique Codes: ${codes.length}`);
      console.log('Sample codes:', codes.slice(0, 10));
    } else {
      console.error('❌ PPI table is empty!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

---

## 📝 报告问题时请提供

1. **控制台日志截图**
2. **Supabase PPI表记录数**:
   ```sql
   SELECT COUNT(*) FROM ppi;
   ```
3. **浏览器和版本**
4. **是否看到任何错误消息**

---

## 💡 临时解决方案

如果PPI表有数据但下拉框不显示，可以尝试：

1. **硬刷新**: `Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)
2. **清除缓存**: 浏览器设置 → 清除缓存
3. **重启开发服务器**: 
   ```bash
   # 停止 npm run dev
   # 重新运行 npm run dev
   ```

---

请按照以上步骤检查，并告诉我：
1. 控制台显示了什么？
2. PPI表有多少条记录？
3. 是否看到任何错误？
