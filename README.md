# IMS Gemini - Intelligent Data Analysis System

## 👨‍💻 开发人员说明 (Developer Note)

**尊敬的用户：**

收到您的请求。作为高级前端工程师，我必须说明：**由于我运行在云端沙箱环境，无法直接读取您本地电脑 (`E:\Projects\imsgimini`) 下的文件。**

为了在不阻塞进度的情况下满足您的核心需求（使用 CSV 构建数据库、实现 UI 交互），我构建了一个**通用的、动态的智能管理系统 (IMS)**。

### 我的实现思路 (Architecture & Approach)

1.  **数据层 (Dynamic Database Construction)**:
    *   我没有硬编码特定的 CSV 结构（因为我无法读取它们）。
    *   相反，我实现了一个**动态 CSV 摄取引擎**。您可以在前端界面直接上传（或拖拽）那三个 CSV 文件。
    *   系统会自动解析表头（Headers）和数据类型，在浏览器内存中构建一个即时数据库。

2.  **UI/UX 设计 (Aesthetics)**:
    *   采用 **"Gemini Dark"** 风格：深色背景、微妙的渐变、玻璃拟态 (Glassmorphism) 卡片。
    *   交互逻辑：
        *   **Data Sources**: 数据源管理，直观展示已加载的 CSV。
        *   **Analysis Hub**: 集成 Gemini 2.5 的对话式分析界面。
        *   **Visualization**: 根据 AI 建议动态生成图表。

3.  **AI 集成 (Gemini Integration)**:
    *   系统会自动提取您上传的 CSV 的元数据（列名、示例行），并将其注入到 Gemini 的上下文窗口中。
    *   这样，Gemini 就能理解您的“私有数据库”，并回答相关问题或编写数据分析代码。

### 如何使用 (Usage)

1.  **输入 API Key**: 启动应用后，请点击右上角设置输入您的 Google Gemini API Key。
2.  **加载数据**: 进入 "Data Sources" 页面，上传您的三个 CSV 文件。
3.  **定义需求**: 您可以将 `项目系统说明文档.md` 中的关键需求，通过对话告知 AI，或者直接在心中作为评估标准来测试此系统。

---

## Tech Stack

*   **Core**: React 18, TypeScript
*   **Styling**: Tailwind CSS (Dark Mode optimized)
*   **Data**: PapaParse (CSV Parsing)
*   **AI**: Google GenAI SDK (Gemini 2.5 Flash/Pro)
*   **Icons**: Lucide React

此代码库已准备好进行下一步的具体业务逻辑定制。等待您的反馈！