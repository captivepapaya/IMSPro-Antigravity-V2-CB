# Manufacture Hub 更新说明

## 🔄 最新更新 (2025-12-25)

### Product Code选择器数据源修正

#### 问题
之前Product Code选择器从Core数据库加载所有产品代码，但这不合理，因为：
- 不是所有产品都有BOM数据
- 用户可能选择无法制造的产品

#### 解决方案
✅ **现在从PPI表加载产品代码**

Product Code选择器现在只显示PPI表中有BOM数据的产品：

```typescript
// 从PPI表加载可用的产品代码
const loadAvailableProductCodes = async () => {
    const ppiRecords = await ppiService.fetchAll();
    // 获取唯一的产品代码
    const uniqueCodes = Array.from(new Set(ppiRecords.map(record => record.code)))
        .filter(code => code && code.trim() !== '')
        .sort();
    setAvailableProductCodes(uniqueCodes);
};
```

#### 优势

1. **准确性**: 只显示可以制造的产品
2. **数据一致性**: 选择的产品必然有BOM数据
3. **用户体验**: 避免选择后发现没有BOM数据的尴尬

#### 搜索功能

搜索功能保持不变：
- ✅ 大小写不敏感
- ✅ 标点符号不敏感
- ✅ 实时过滤
- ✅ 最多显示50个结果

#### 示例

假设PPI表有以下数据：
```
Code        | BOM      | QtyBom
------------|----------|--------
PH2630FB    | H-2630   | 1
PH2602GR    | H-2602Gr | 1
PH2029FB    | H-2029   | 1
```

Product Code选择器将只显示：
- PH2630FB
- PH2602GR
- PH2029FB

而不会显示Core数据库中没有BOM数据的其他产品。

#### 数据流程

```
用户点击Product Code输入框
         ↓
显示PPI表中的所有产品代码（去重）
         ↓
用户输入搜索词（大小写/标点不敏感）
         ↓
实时过滤匹配的代码
         ↓
用户选择产品
         ↓
自动从PPI加载该产品的BOM数据
```

## 📝 技术细节

### 修改的代码

**ManufactureHub.tsx**:
```typescript
// 之前：从Core数据库加载
const allProductCodes = useMemo(() => {
    return coreService.getAllProductCodes();
}, []);

// 现在：从PPI表加载
const [availableProductCodes, setAvailableProductCodes] = useState<string[]>([]);

useEffect(() => {
    loadAvailableProductCodes();
}, []);

const loadAvailableProductCodes = async () => {
    const ppiRecords = await ppiService.fetchAll();
    const uniqueCodes = Array.from(new Set(ppiRecords.map(record => record.code)))
        .filter(code => code && code.trim() !== '')
        .sort();
    setAvailableProductCodes(uniqueCodes);
};
```

### 依赖的服务方法

**ppiService.fetchAll()**:
- 从Supabase PPI表获取所有记录
- 按code字段排序
- 返回PPIRecord数组

## ✅ 测试建议

1. **验证数据源**:
   - 打开Manufacture Hub
   - 点击Product Code输入框
   - 确认只显示PPI表中的产品

2. **测试搜索**:
   - 输入产品代码的部分字符
   - 验证大小写不敏感（输入"ph"能找到"PH2630FB"）
   - 验证标点不敏感（输入"ph2630"能找到"PH-2630FB"）

3. **验证BOM加载**:
   - 选择一个产品代码
   - 确认BOM Code和Qty/Unit自动填充
   - 验证数据来自PPI表

## 🎯 用户影响

### 正面影响
- ✅ 更准确的产品选择
- ✅ 避免选择无BOM数据的产品
- ✅ 更快的搜索速度（PPI表数据量小于Core）

### 注意事项
- ⚠️ 如果PPI表为空，Product Code选择器将为空
- ⚠️ 新产品需要先在PPI表中添加BOM数据才能在此选择

## 📊 数据关系

```
PPI表 (214条记录)
├─ Code列 → Product Code选择器的数据源
├─ BOM列 → 自动填充到BOM Code
└─ QtyBom列 → 自动填充到Qty/Unit

Core数据库
├─ 用于库存更新
└─ 不再用于Product Code选择器
```

---

更新完成！现在Manufacture Hub的Product Code选择器更加准确和高效！🎉
