# 技术债务与重构清单（Tech Debt & Roadmap）

> **前提约定**：BiliManager 尚未正式上线发布，后续重构**无需保留对旧版本本地数据格式或历史内部接口的兼容层**。本清单按优先级汇总已发现的规格偏差、多版本历史遗留与运行期稳定性隐患。

---

## P0：产品规格偏差（必须优先对齐）

### 1. 对齐“搜索过滤”与“屏蔽列表”的独立开关分层

- **现状问题**（`src/content/searchFilter/index.ts`、`src/content/index.ts`、`src/shared/types.ts`）：
  1. `searchFilter/index.ts#L167-L171`：当 `searchFilter.enabled === false` 时，仍保留了 `result.lowViewCountReason`（播放量下限未关闭）。
  2. `searchFilter/index.ts` 与 `ruleEngine.ts`：属于“屏蔽列表”面板的 `titlePattern` 与 `uploaderPattern` 目前受 `searchFilter.enabled` 控制，关闭搜索过滤后正则屏蔽失效。
  3. `personalization.filterTrending` 目前存放在 `PlayerPersonalizationSettings` 下，不受 `searchFilter.enabled` 控制（而 UI 已将其放在 `SearchFilterPanel` 内）。
- **目标修复**：
  - 将 `filterTrending` 归并到搜索过滤配置域；
  - `searchFilter.enabled` 严格控制热榜、播放量下限、互动率、未命中搜索词、课程标签；
  - `titlePattern`、`uploaderPattern` 与 `uploaderBlocklist` 统一归为常驻屏蔽列表，仅受全局总开关 `features.enabled` 控制。

### 2. 数据备份补全 UP 屏蔽列表（`uploaderBlocklist`）

- **现状问题**：`src/options/dataTransfer.ts` 仅导入/导出 `settings` 与 `watchHistory`，遗漏了 `biliFilter.uploaderBlocklist`。
- **目标修复**：`all` 与 `settings` 两种导出类型均纳入 `uploaderBlocklist`，并在导入时合并或替换屏蔽列表。

### 3. 搜索过滤面板 UI 互斥提示与文案修正

- **现状问题**：`src/options/panels/searchFilterPanel.tsx` 开启“严格拦截”时与“收藏夹推荐”互斥（不展示替换视频），但 UI 无提示；第 183 行文案 `"黑白处理低互动率低的视频"` 存在错别字（多了一个“低”）。
- **目标修复**：补充互斥提示（或禁用/折叠收藏夹推荐子区域提示），并修正文案。

---

## P1：多版本历史遗留清理与测试底座建设

### 1. 删除废弃死代码与冗余封装

- 删除未被任何模块引用的 `src/options/settingsImport.ts`，并同步更新 `src/options/main.tsx#L318` 的过时注释（实际已切换为 `dataTransfer.ts`）。
- 移除从未被 UI 或业务逻辑消费的 `FeatureKey` 值 `"dailyStats"`（`src/shared/types.ts`、`src/shared/settingsSchema.ts`）。
- 移除无人发送的扩展消息 `BILI_FILTER_GET_STATUS`（`src/shared/messaging.ts`、`src/background/index.ts`）。
- 评估内联或简化仅 6 行的透传模块 `src/content/uploaderBlock/index.ts`。

### 2. 精简历史兼容代码并统一命名规范

- **精简 `settingsSchema.ts`**：移除未上线前遗留的 `legacyFeatures` 兼容分支与单值 `folderId` 迁移逻辑。
- **统一前缀命名**：将旧项目名遗留的 Storage Key（`biliFilter.settings`、`biliFilter.uploaderBlocklist`、`biliFilter.favoriteFolderCache`）与消息类型（`BILI_FILTER_*`）统一重构为 `biliManager.*` 与 `BILI_MANAGER_*`。

### 3. 清理根目录构建产物拷贝冗余

- **现状问题**：`scripts/copyManifest.mjs` 每次 `npm run build` 会把产物拷贝到根目录 `assets/`、`icons/`、`popup.html`、`options.html`（其中 `popup.html`、`options.html` 还被 Git 追踪），导致构建污染工作区。
- **目标修复**：统一约定仅从 `dist/` 加载扩展，移除根目录 `popup.html`、`options.html` 及 `copyManifest.mjs` 中的根目录拷贝逻辑（保留 `scripts/prepareHtml.mjs` 或改为仅操作临时构建入口）。

### 4. 搭建自动化测试闭环（Vitest）

- **现状问题**：全仓目前 **0 个自动化测试文件**，Agent 修改核心逻辑后无法自动验证业务回归。
- **目标建设**：
  - 引入 `vitest` + `happy-dom`/`jsdom`；
  - 优先为高风险纯逻辑补充单元测试：`watchTimerHistory.ts`（前后台拆分、跨天、5000 条裁剪）、`settingsSchema.ts`、`ruleEngine.ts`、`dataTransfer.ts`、`favoriteRecommendation/index.ts`；
  - 采集脱敏 B 站搜索页 HTML Fixture，为 `pageAdapter.ts` 补齐 DOM 解析快照测试；
  - 将 `npm test` 接入 `npm run check` 与 `.github/workflows/ci.yml`。

### 5. 仓库卫生清理

- 清理本地近 40 个已完成合并的历史开发分支（含拼写错误分支如 `refacotr3` 等）。
- 规划根目录空的 `.agents/` 与 `.codex/` 目录：要么沉淀具体的项目工作流 Skill，要么清理空目录避免混淆。

---

## P2：运行期性能、配额与安全加固

### 1. 降低观看计时器存储写入频率与消除自我回环

- **现状问题**：`src/content/playerWatchTimer/index.ts` 中 `ACTIVE_SESSION_SAVE_INTERVAL_MS = 1000`、`SESSION_SAVE_INTERVAL_MS = 1000`，视频播放期间每秒向 `chrome.storage.local` 与 Background 写队列发请求，且写入会触发当前页的 `chrome.storage.onChanged` 并在 300ms 后重读 storage。
- **优化方向**：将常规节流写入间隔放宽至 `5_000ms ~ 10_000ms`（配合 `pagehide` / `visibilitychange` / `pause` 事件立即强刷），并优化同页 `storage.onChanged` 避免无意义的自我回读。

### 2. 解除自定义背景图的 10MB 存储配额风险

- **现状问题**：`manifest.json` 未申请 `unlimitedStorage`（默认 `chrome.storage.local` 仅 10MB），而上传背景图直接以 JPEG data URL（最高 4.5MB）写入 `biliFilter.settings`，叠加观看历史与多个收藏夹缓存后存在触顶报错风险。
- **优化方向**：将大体积图片二进制/Blob 迁移至 IndexedDB 存储（或在前端更严格压缩并捕获 `QUOTA_BYTES` 写入异常给用户清晰提示）。

### 3. 收敛页面观察与重复读设置开销

- **现状问题**：`src/content/index.ts` 在搜索页对整个 `document.body` 挂子树 `MutationObserver` + `500ms` URL 轮询，每次重扫均并发读取 `getSettings()` 与 `getUploaderBlocklist()`。
- **优化方向**：缓存当前设置并在 `chrome.storage.onChanged` 增量失效；优先使用 `navigation` API（存在时）或拦截 `history.pushState`/`replaceState` 辅以低频兜底，缩小搜索页监听容器范围。

### 4. 安全与异常边界加固

- **自定义背景 URL 校验**：`src/content/customBackground.ts` 直接拼接 `url("${settings.imageDataUrl}")`，应在渲染前校验 `^data:image\/(png|jpeg|webp|gif);base64,` 白名单。
- **减少 `innerHTML` 依赖**：`src/content/searchFilter/cardPresenter.ts` 保存/还原卡片时使用 `innerHTML`，可逐步替换为结构化 DOM 节点恢复或保留原节点隐显切换。
- **正则复杂度提示**：`ruleEngine.ts` 支持用户自由输入正则，可增加长度/嵌套量词校验或执行保护，避免极端输入造成页面卡顿（ReDoS）。

### 5. 自动化发布与文档目录整理

- 在 `.github/workflows/` 增加 Tag 触发构建并自动打包上传 Release Zip 的工作流，取代纯手工发包。
- 后续可将 `doc/*.png` 与 `docs/*.md` 合并整理为单一 `docs/` 目录。
