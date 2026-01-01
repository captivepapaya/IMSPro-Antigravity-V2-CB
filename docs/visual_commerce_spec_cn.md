# 电商视觉合成助手 (Visual Commerce Agent - VCA) 开发规范文档

## 1. 概述 (Overview)
本文档概述了 **Visual Commerce Agent (VCA)** 模块的架构和实现细节。
本模块的核心目标是自动生成高保真、物理精确的电商场景图。核心功能包括“数字化栽植” (Digital Planting - 将植物与花盆自然结合) 以及“场景化叙事” (Contextual Storytelling - 在不同生活场景中保持模特和产品的一致性)。

**数据来源**: 基于 2025年12月执行的 "Gum Tree + Kristina" 项目的手动成功范例。

---

## 2. 核心架构 (Core Architecture)

VCA 采用四阶段流水线作业：

1.  **计算器 (The Calculator)**: 逻辑层。负责物理尺寸的校验与换算。
2.  **组装师 (The Assembler)**: 资产层。生成可信赖的“白底基础图” (Base Image)。
3.  **导演 (The Director)**: 场景层。将基础图注入不同风格的场景。
4.  **修图师 (The Retoucher)**: 精修层。处理“换脸” (Face Swap) 和细节修正 (Inpainting)。

---

## 3. 数据结构 (Data Schema)

建议使用以下 TypeScript 接口来构建 React 状态或 API 数据包。

```typescript
// 核心产品规格
interface ProductSpecs {
  id: string;
  name: string; // 例如: "Gum Tree" (桉树)
  type: 'Plant' | 'Furniture' | 'Decor';
  dimensions: {
    height_cm: number; // 例如: 180
    width_cm?: number;
    pot_height_cm?: number; // 原配黑色塑料盆的高度 (例如: 18)
  };
  assets: {
    main_image: string; // 原料图 URL
    detail_images: string[];
  };
}

// 目标容器规格 (花盆)
interface ContainerSpecs {
  id: string;
  name: string; // 例如: "白色纹理盆"
  dimensions: {
    height_cm: number; // 例如: 30
    diameter_cm: number; // 例如: 31
  };
  styling: {
    topping: 'White Pebbles' | 'Bark' | 'Soil'; // 铺面: 白色鹅卵石 / 树皮 / 泥土
    color: string;
  };
}

// 模特身份 (用于保持一致性)
interface ModelIdentity {
  name: string; // 例如: "Demo1"
  face_reference_image: string; // 那个“黄金标准”的人脸参考图
  height_cm: number; // 例如: 175
}

// 场景配置
interface SceneConfig {
  id: string;
  name: string; // 例如: "海边度假" 或 "用户自定义"
  prompt_template: string; // 支持动态占位符 {{ model.name }}, {{ product.name }}
  is_custom: boolean; // 是否为用户手动输入
  outfit_ref?: string;
  force_scale_check?: boolean;
}
```

---

## 4. 计算器: 高度逻辑算法

**痛点**: 产品只有 180cm，为什么要求在图中展示为 192cm？
**逻辑**: 当仿真植物放入装饰盆时，通常底部需要垫高或填充，使得植物原盆表面与装饰盆口齐平。

```javascript
/**
 * 计算“栽植”后的视觉总高度
 */
function calculateVisualHeight(product: ProductSpecs, container: ContainerSpecs): number {
  // 逻辑: 原配盆 (18cm) 通常放置在装饰盆 (30cm) 内部的填充物上。
  // 为了美观，植物根部通常与新盆口齐平。
  // 抬升高度 = 装饰盆高度 - 原配盆高度
  
  // 经验公式:
  // 视觉总高 = 植物本体高 + (装饰盆高 - 原配盆高)
  // 如果原盆比装饰盆还高(不太可能)，则为0。
  
  // Gum Tree 项目实战数据:
  // 180 + (30 - 18) = 192cm.
  
  const lift = Math.max(0, container.dimensions.height_cm - product.dimensions.pot_height_cm);
  return product.dimensions.height_cm + lift;
}
```

---

## 5. 提示词工程模板 (Prompt Templates)

这些是经过验证的“金牌提示词”。请在代码中将 `{{ 变量 }}` 替换为实际值。

### 阶段 1: 基础资产 (数字化栽植)
```json
{
  "task": "Product Composition",
  "base_prompt": "A photorealistic high-key studio product shot. Front view. A tall {{ product.name }} ({{ product.height }}cm) planted naturally in a large {{ container.color }} {{ container.name }} ({{ container.height }}cm).",
  "details": [
    "The tree grows out of clean {{ container.topping }} within the pot.", // 关键: 铺面材质
    "Maintain a visual scale of approx {{ scale_ratio }} (tree vs pot).",
    "White background."
  ],
  "negative_prompt": "blurry, low resolution, multiple pots, distorted leaves"
}
```

### 阶段 2: 场景注入 (动态逻辑)
```json
{
  "scenario_logic": "Iterate through user-selected scenes.",
  "prompt_assembly": {
    "system": "Use the Base Asset provided. Keep its shape 100% consistent.",
    "user": "{{ selected_scene.prompt_template }}" 
  }
}
```

### 阶段 3: 换脸 / 一致性精修
*注意: 这是一个“图生图” (Image-to-Image) 的操作步骤，而非纯文本生成。*
**指令 (Instruction):** "Editing task: Face swap ONLY. Replace the face of the person in the image with the reference face provided. DO NOT CHANGE the lighting, outfit, or background plant details."

---

## 6. 实现工作流 (状态机)

1.  **输入状态 (Input)**: 用户上传产品图、花盆图、模特人脸。
2.  **校验状态 (Validation)**: 系统自动计算 `视觉总高度`。
    *   *UI反馈*: "预计总高: 192cm (比模特高出约 17cm)。"
3.  **生成状态 A (栽植)**:
    *   生成 4 张“已栽植”的产品白底图。
    *   **用户操作**: 从中选一张形态最完美的 (这将成为“锁定资产”)。
4.  **生成状态 B (场景)**:
    *   使用“锁定资产” + “场景提示词”生成不同场景图。
    *   *关键*: 必须使用 Inpainting/img2img 技术，防止植物形态发生“漂移”。
5.  **精修状态 (Refinement)**:
    *   遍历所有选定的场景图，使用 `model.face_reference_image` 进行批量换脸。
    *   针对特写图 (Detail Shot)，检查物理细节 (如: 强制叶片直径 < 4cm)。
6.  **最终输出 (Output)**: 打包下载所有高清素材。

---

## 7. 经验总结与异常处理 (Edge Cases)

*   **叶片比例失调 (Leaf Scale Bug)**: AI 在画微距特写时，倾向于把叶子画得巨大。
    *   *修正*: 必须在提示词中显式规定物理尺寸 (例如: "3-4cm diameter", "coin sized" 硬币大小)。
*   **资产漂移 (Asset Drift)**: 在不同场景中，植物长相变来变去。
    *   *修正*: 一旦阶段 1 的植物图被确认，后续所有生成都必须以此图为 Image Prompt 锚点 (权重建议 0.7+)。
*   **身高比例 (Height Consistency)**:
    *   *修正*: 永远在提示词中带上具体的身高数值对比 (例如 "192cm vs 175cm")，强迫模型理解比例关系。
