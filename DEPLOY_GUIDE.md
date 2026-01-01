# Vercel 部署适配指南 (Vercel Deployment Guide)

本文件总结了从本地开发环境迁移至 Vercel 生产环境时，为了解决构建错误（Build Errors）所做的关键修改。

在新项目中复用代码时，请务必遵守以下结构规范。

## 1. 目录结构调整 (File Structure)

Vite 在 Vercel 上构建时，对于源代码的位置非常敏感。

*   **❌ 错误做法**: 将源代码直接放在项目根目录（如 `E:\Projects\imsgimini\App.tsx`）。
*   **✅ 正确做法**: 所有 React 组件和逻辑代码必须放入 `src/` 目录。

**标准结构示例：**
```text
/ (根目录)
├── index.html          <-- 入口文件，必须在根目录
├── vite.config.ts      <-- 配置文件
├── tailwind.config.js  <-- 样式配置
├── package.json
└── src/                <-- 源代码目录
    ├── index.tsx       <-- JS 入口
    ├── index.css       <-- 全局样式
    ├── App.tsx         <-- 主组件
    ├── types.ts
    ├── components/
    └── services/
```

## 2. 入口文件修正 (Index.html)

`index.html` 中的脚本引用路径必须指向 `src` 目录：

**修正前：**
```html
<script type="module" src="/index.tsx"></script>
```

**修正后：**
```html
<script type="module" src="/src/index.tsx"></script>
```

## 3. 环境变量配置 (Environment Variables)

Vercel 不会读取本地的 `.env` 文件，必须在 Vercel 网页后台配置，且代码需做适配。

1.  **在 Vercel 后台**: 添加环境变量 `VITE_API_KEY`。
2.  **在 `vite.config.ts`**: 添加 `define` 映射，防止构建时 `process` 未定义报错。

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // 关键：将 process.env.API_KEY 替换为 Vercel 注入的 VITE_API_KEY
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    },
  };
});
```

## 4. Tailwind CSS 配置

确保 `tailwind.config.js` 能扫描到 `src` 目录下的所有文件：

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- 确保包含 src 目录
    "./*.{js,ts,jsx,tsx}"
  ],
  // ...
}
```

---

**如何基于本项目开启新项目：**

1.  新建一个文件夹（例如 `imsgimini-v2`）。
2.  将本项目所有文件复制过去。
3.  确保保留 `src/` 目录结构。
4.  在 `index.html` 中保留 Tailwind CDN (为了开发预览) 或依赖构建流程。
5.  执行 `git init` 初始化一个新的仓库。
```