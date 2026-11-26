# AGENTS.md — BiliManager 工程与协作指南

> 本文件面向在本仓库工作的 Coding Agent 与开发者，提供仓库地图、硬性工程约束与标准验证闭环。

## 1. 项目概览

**BiliManager** 是一个基于 **Manifest V3 + React 19 + TypeScript (strict) + Tailwind CSS 3 + Vite 6** 的浏览器扩展，面向 Bilibili 提供搜索质量过滤、吃灰收藏夹置换推荐、UP 主屏蔽、播放页净化、前/后台观看计时统计与连续观看休息提醒。

### 文档导航（按需阅读）

| 文档                                                       | 何时阅读                                     | 核心内容                                                     |
| :--------------------------------------------------------- | :------------------------------------------- | :----------------------------------------------------------- |
| [docs/product-spec.md](./docs/product-spec.md)             | 新增/调整功能、确认开关边界或交互语义        | 产品定位、开关分层矩阵、各模块目标规格与当前实现偏差         |
| [docs/architecture.md](./docs/architecture.md)             | 修改构建配置、消息协议、存储结构或跨模块逻辑 | 四端入口、双 Vite 构建链路、Content 生命周期、消息与存储模型 |
| [docs/bilibili-selectors.md](./docs/bilibili-selectors.md) | 适配 B 站改版、修改 DOM 选择器或 Web API     | 搜索页/播放页/主题/背景全部外部 DOM 与 API 契约及验证清单    |
| [docs/tech-debt.md](./docs/tech-debt.md)                   | 规划重构、清理死代码、补测试或优化性能       | 目标规格偏差、多版本历史遗留、自动化测试与运行期加固清单     |
| [README.md](./README.md)                                   | 更新面向用户的功能介绍与安装说明             | 功能概览、隐私说明、快速构建与安装方式                       |

---

## 2. 核心架构速览（四端 + 共享层）

- **Content Script**（`src/content/index.ts`）：统一注入 `https://*.bilibili.com/*` 与 `https://search.bilibili.com/*`，调度搜索过滤、热榜清理、屏蔽菜单、收藏夹替换、播放页净化、自定义背景、观看计时与休息提醒。
- **Background Service Worker**（`src/background/index.ts`）：处理收藏夹 API 拉取与缓存（`favoriteFolderApi.ts`），并通过串行写队列 `watchTimerWriteQueue` 统一落盘观看历史。
- **Popup 看板**（`src/popup/main.tsx` → `src/popup/popupApp.tsx`）：全局开关、当前搜索页正则报错提示、近 7 天/本月/本年观看统计图表与当日 Top 3 下钻、最近观看列表。
- **Options 设置页**（`src/options/main.tsx`）：各功能域配置面板、收藏夹管理、UP 屏蔽管理弹窗、本地 JSON/文本导入导出（`src/options/dataTransfer.ts`）。
- **Shared 共享层**（`src/shared/`）：类型定义、设置归一化唯一入口（`settingsSchema.ts`）、消息联合类型（`messaging.ts`）、观看历史分片存储与统计（`watchTimerHistory.ts`、`watchTimerStats.ts`）、扩展上下文失效检测（`extensionContext.ts`）。

---

## 3. 不可违背的工程约束（Hard Rules）

1. **禁止直推/直提交主干**：`scripts/guardBranch.mjs` 与 `.husky/pre-commit` 会拦截 `master`/`main` 分支上的提交；所有开发必须在独立功能/修复分支进行。
2. **双 Vite 构建不可破坏**：
   - `vite.config.ts` 构建 `popup`、`options`、`background`（ES Module）与 `contentStyle`（`dist/assets/content.css`）。
   - `vite.content.config.ts` 必须保持 `formats: ["iife"]` 构建 `dist/assets/content.js`，不得引入顶层 `import`/`export`（`scripts/validateContentBuild.mjs` 会校验并在违规时阻断构建）。
   - 修改 `manifest.json` 或新增构建入口时，需同步检查 `scripts/prepareHtml.mjs` 与 `scripts/copyManifest.mjs`。
3. **Content 侧 CSS 强隔离**：
   - `src/content/style.css` 通过 `tailwind.content.config.ts` 配置了 `prefix: "bm-"`，且仅注入 `@tailwind utilities;`。
   - **严禁**在 content 脚本或 content CSS 中使用无前缀的裸 Tailwind 工具类或 `@tailwind base` 全局重置，以免污染 B 站宿主页面样式（历史教训见 PR #28）。
4. **隐私与存储并发红线**：
   - **纯本地原则**：所有配置与记录仅保存在 `chrome.storage.local`，严禁引入 `chrome.storage.sync` 或任何第三方遥测/数据上报。
   - **唯一归一化入口**：读写配置统一经过 `src/shared/settingsSchema.ts` 的 `normalizeSettings`，避免散落局部默认值造成字段漂移。
   - **串行写队列**：观看历史的增删改（会话写入、历史替换、过期裁剪）必须发消息给 Background，经 `watchTimerWriteQueue` 串行落盘，禁止在 Content/Options 中直接并发覆写历史索引键。
5. **Extension Context 失效防御**：扩展热重载或更新后旧页面上下文会失效，Content 脚本内所有异步任务与消息调用必须兼容 `isExtensionContextInvalidated`（参考 `src/content/index.ts` 的 `runContentTask` 与 `src/shared/extensionContext.ts`）。
6. **无历史包袱原则**：项目尚未公开发布上线，重构或修 Bug 时**不需要**为兼容旧版本存储格式或废弃代码保留冗余兼容层；遇到重复实现或死代码应参考 `docs/tech-debt.md` 直接收敛为单一清晰路径。
7. **外部契约同步更新**：凡新增、删改 B 站页面 DOM 选择器或 Web API 字段，必须同步更新 `docs/bilibili-selectors.md`；凡调整功能边界或解决已知债务，需同步更新 `docs/product-spec.md` / `docs/tech-debt.md`。

---

## 4. 标准开发与验证闭环

### 常用命令

```bash
npm run check   # 依次执行 typecheck (tsc --noEmit) + lint (eslint --max-warnings=0) + format:check
npm run build   # prepareHtml -> 主 Vite 构建 -> content IIFE 构建 -> validateContentBuild -> copyManifest
npm run format  # 使用 Prettier 按 .prettierrc.json (LF / 100列) 统一格式化
```

### 提交前检查清单

1. **静态与构建校验**：任何源码或配置改动后，必须运行 `npm run check && npm run build`，确保 TypeScript 严格模式、ESLint 零警告、Prettier 风格及双端产物校验全部通过。
2. **手工回归说明**（当前仓库尚无自动化单测，补全计划见 `docs/tech-debt.md`）：
   - 涉及功能行为改动时，统一在 Chrome/Edge 开发者模式加载 **`dist/`** 目录进行手工验证（注意：`scripts/copyManifest.mjs` 目前仍会向根目录冗余拷贝产物，目标约定以 `dist/` 为唯一加载目录）。
   - 在提交说明或任务总结中明确写明实际运行过的命令，以及手工验证覆盖的页面（如搜索页 `search.bilibili.com/all`、普通视频页 `/video/BV...`、Popup、Options）。
