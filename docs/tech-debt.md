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

### 3. 搜索过滤面板 UI 互斥提示与文案修正（已解决）

- 已在 `src/options/panels/searchFilterPanel.tsx` 修正错别字（`"黑白处理互动率过低的视频"`），并在开启“严格拦截”时禁用收藏夹推荐编辑区且展示互斥说明（保留已配置收藏夹）。

---

## P1：多版本历史遗留清理与测试底座建设

### 1. 删除废弃死代码与冗余封装

- ~~删除未被任何模块引用的 `src/options/settingsImport.ts`，并同步更新 `src/options/main.tsx` 的过时注释~~（已清理）。
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

### 1. 观看计时器存储写入频率与自我回环（已优化）

- 已将 `src/content/playerWatchTimer/index.ts` 常规节流写入间隔放宽至 `5_000ms`（保留生命周期强刷），合并 `writeWatchTimerSession` 为单次 `storage.local.set`，并过滤同页自写回环触发的冗余重读。

### 2. 自定义背景图独立存储与配额防护（已优化）

- 已将背景图从 `biliFilter.settings` 剥离至独立键 `biliManager.customBackgroundImage`，前端优先压缩为 WebP（0.84 / 上限 ~2MB），并在 `src/shared/customBackgroundStorage.ts` 捕获 `QUOTA_BYTES` 异常给出中文提示。

### 3. 页面观察收敛与设置缓存（已优化）

- `src/content/index.ts` 已对设置与 UP 黑名单做内存缓存与 `storage.onChanged` 失效刷新，URL 变化结合 `navigation` / `popstate` / `hashchange` + `1500ms` 兜底，播放页监听忽略弹幕层变动，`pageThemeEvents.ts` 收敛为按需挂载的根元素非子树属性监听。

### 4. 安全与异常边界加固

- ~~**自定义背景 URL 校验**~~（已通过 `isValidBackgroundImageDataUrl` 完成白名单校验）。
- **减少 `innerHTML` 依赖**：`src/content/searchFilter/cardPresenter.ts` 保存/还原卡片时使用 `innerHTML`，可逐步替换为结构化 DOM 节点恢复或保留原节点隐显切换。
- **正则复杂度提示**：`ruleEngine.ts` 支持用户自由输入正则，可增加长度/嵌套量词校验或执行保护，避免极端输入造成页面卡顿（ReDoS）。

### 5. 自动化发布与文档目录整理

- 在 `.github/workflows/` 增加 Tag 触发构建并自动打包上传 Release Zip 的工作流，取代纯手工发包。
- 后续可将 `doc/*.png` 与 `docs/*.md` 合并整理为单一 `docs/` 目录。
