# Fragment Isles

本地优先的科研碎片工作台，帮助研究者收集、整理、关联和总结研究碎片。

## 功能

- **Fragments 碎片管理** — 创建、编辑、搜索、分类、标签管理，支持 AI 分析
- **Timeline 时间轴** — 从碎片中提取时间事件，可视化时间线
- **Relations 关系图** — AI 辅助发现碎片间的关联，SVG 可视化关系网络
- **Summary 总结生成** — 基于选定碎片生成结构化总结（总结 + Digest + 新Idea）
- **本地存储** — 所有数据存储在浏览器 IndexedDB 中，无需后端
- **Markdown 导出** — 支持导出和复制 Markdown 格式内容

## 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS + Framer Motion
- Dexie.js (IndexedDB)
- OpenAI 兼容 API（需自行配置）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 http://localhost:5173 即可使用。

## 构建部署

```bash
# 构建生产版本
npm run build

# 本地预览构建产物
npm run preview
```

构建产物在 `dist/` 目录下，可部署到任意静态托管服务。

## AI 配置

进入 Settings 页面，填写：
- API Base URL（OpenAI 兼容接口地址）
- API Key
- Model Name

所有 AI 调用都需要用户手动触发并确认费用后才会执行。

## License

MIT
