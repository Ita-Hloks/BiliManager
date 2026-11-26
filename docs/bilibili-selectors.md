# Bilibili 外部契约与选择器清单（Selectors & API Contract）

BiliManager 直接依赖 B 站网页 DOM 结构、样式变量及公开 Web API。本文件汇总全仓所有外部强耦合点，是应对 B 站前端改版时的核心排查清单。

> **维护铁律**：凡在源码中新增、修改或删除任何 B 站 URL 规则、DOM 选择器或接口字段，必须同步更新本文档。

---

## 1. URL 路由与权限范围

| 位置                                                                                                                                  | 匹配目标                                    | 具体规则                                                                                                                                                        |
| :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`                                                                                                                       | Host 权限与 Content 注入范围                | `https://*.bilibili.com/*`、`https://search.bilibili.com/*`                                                                                                     |
| `src/content/searchFilter/pageAdapter.ts`                                                                                             | 搜索页（`isSearchPage`）                    | `hostname === "search.bilibili.com"` 且 `pathname`（去尾斜杠）为 `/all` 或 `/video`                                                                             |
| `src/content/playerPersonalization/index.ts`<br>`src/content/playerWatchTimer/index.ts`<br>`src/content/playerWatchReminder/index.ts` | 播放页                                      | `hostname.endsWith("bilibili.com")` 且 `pathname` 匹配 `/^\/video\/(?:BV\|av)/i` 或以 `/bangumi/play/` 开头                                                     |
| `src/content/playerPersonalization/index.ts`                                                                                          | 进页关弹幕（`getOrdinaryVideoKey`）         | 仅普通视频页 `/^\/video\/(BV[\da-z]+\|av\d+)/i`（不含番剧页）                                                                                                   |
| `src/content/customBackground.ts`                                                                                                     | 自定义背景主要页面（`isMajorBilibiliPage`） | `search.bilibili.com`、`t.bilibili.com`、`space.bilibili.com`、`message.bilibili.com`，或 `www.bilibili.com` 下 `/`、`/video/`、`/list/`、`/bangumi/`、`/read/` |

---

## 2. 搜索页 DOM 选择器

### 2.1 视频卡片结构与字段抽取（`src/content/searchFilter/pageAdapter.ts`）

| 语义                       | 选择器 / 解析策略                                                                                                                                                                                                         | 备注与退化风险                                                                                                                                                             |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 卡片收集入口               | `.video-list .bili-video-card`, `.video-list .video-item`, `.search-page .bili-video-card`, `.search-page .video-item`, `.bili-video-card`                                                                                | 需通过 `contentLinks` 二次校验；同时从 `contentLinks` 向上找 `cardRoots` 兜底                                                                                              |
| 内容链接（`contentLinks`） | `a[href*='/video/BV']`, `a[href*='bilibili.com/video/']`, `a[href*='/cheese/play/']`, `a[href*='bilibili.com/cheese/play/']`                                                                                              | 用于提取 `videoUrl` 与 BV 号                                                                                                                                               |
| 卡片根 / 布局根            | `cardRoots`: `.bili-video-card`, `.video-item`, `.search-card`, `.video-list-item`<br>`layoutRoots`: `.video-item`, `.search-card`, `.video-list-item`                                                                    | 严格拦截时从 DOM 移出的是 `layoutEl`；`footer, .footer, .bili-footer` 内元素会被忽略                                                                                       |
| UP 主视频推荐卡            | `.b-user-video-card`, `.user-video-info`                                                                                                                                                                                  | 命中时豁免“未命中搜索词”过滤                                                                                                                                               |
| 课程标记                   | `.bili-video-card__info--cheese`                                                                                                                                                                                          | 存在即判定 `isCourse = true`                                                                                                                                               |
| 标题元素                   | `.bili-video-card__info--tit`, `.bili-video-card__info--title`, `.title`, `a[title]`                                                                                                                                      | 读取 `textContent` 或 `title` 属性                                                                                                                                         |
| 搜索词高亮检测             | `.keyword`, `.highlight`, `.search-keyword`, `.bili-video-card__info--tit em`, `.bili-video-card__info--title em`, `em`                                                                                                   | 结合 `getComputedStyle(el).color` 检查粉色高亮（`pink` / `251, 114, 153` / `255, 102` / `#fb7299`）或 `<em>` 标签                                                          |
| UP 主与 UID                | `.bili-video-card__info--author`, `.bili-video-card__info--owner`, `.up-name`, `.username`, `a[href*='space.bilibili.com']`                                                                                               | 从 `space.bilibili.com/(\d+)` 提取 `uploaderMid`                                                                                                                           |
| 发布日期                   | `.bili-video-card__info--date`, `.bili-video-card__info--time`, `.date`, `.time`                                                                                                                                          | 用于收藏夹替换时重写日期文案                                                                                                                                               |
| 播放量 / 弹幕数            | `.bili-video-card__stats`, `.so-icon`, `.tags`, `.des`                                                                                                                                                                    | 优先按 `播放量/播放/观看`、`弹幕` 标签解析 `万`/`亿`；缺失时按 `.bili-video-card__stats--item`（回退 `.bili-video-card__stats span, .so-icon`）顺序取 `[0]=播放, [1]=弹幕` |
| 封面与预览遮罩             | `thumbnail`: `.bili-video-card__cover`, `.bili-video-card__cover img`, `.img`, `.cover`, `img`<br>`preview`: `video`, `.bili-video-card__cover--mask`, `.bili-video-card__cover--hover`, `.v-img__mask`, `.cover-preview` | 遮罩宿主优先取 `.bili-video-card__image`（见 `cardPresenter.ts`）                                                                                                          |

### 2.2 搜索页净化与门控（`searchCleanup/style.css`、`filterGate.ts`）

- **热榜容器**：`html[data-bili-manager-filter-trending="true"] .trending`（隐藏热榜）。
- **门控导航目标**：`filterGate.ts` 监听 `a[href*='/video/']`、`a[href*='bilibili.com/video/']`、`a[href*='/cheese/play/']`、`a[href*='bilibili.com/cheese/play/']` 及卡片根元素，以处理点击外卡片时的自动重锁。

---

## 3. 播放页 DOM 选择器

### 3.1 个性化净化与控制（`src/content/playerPersonalization/index.ts` & `style.css`）

| 功能                | 依赖选择器                                                                                                                                                                                                          | 交互/注入方式                                                                              |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------- |
| 推荐视频列表        | `.right-container .recommend-list-v1`, `.right-container .rec-list`, `.bpx-player-ending-related`                                                                                                                   | CSS 属性选择器隐藏 + JS 添加 `bili-manager-personalization-hidden`                         |
| 播放器右侧广告/推广 | `.right-container .video-card-ad-small`, `.right-container .ad-floor-exp.right-bottom-banner`, `.right-container #slide_ad`, `.right-container .slide-ad-exp`, `.activity-m-v1`, `.right-container [class*="_ad_"]` | 同上                                                                                       |
| 推荐自动连播按钮    | `.right-container .video-pod .continuous-btn`（判断子节点 `.switch-btn.on`）                                                                                                                                        | 模拟 `.click()` 关闭（1200ms 防重入冷却），并在 `<video>` `ended` 事件后再次兜底暂停与检查 |
| 弹幕总开关          | `.bpx-player-dm-switch input.bui-danmaku-switch-input`, `.bilibili-player-video-danmaku-switch input[type="checkbox"]`                                                                                              | 检查 `.checked` 后模拟 `.click()`，单视频最多尝试 3 次                                     |
| 观察容器目标        | `.right-container`, `.bpx-player-container`, `.rec-list`, `.bpx-player-ending-related`, `.video-card-ad-small`, `#slide_ad`, `.slide-ad-exp`, `.activity-m-v1`                                                      | `getPlayerObservationTargets()` 去重嵌套后挂载 `MutationObserver`                          |

### 3.2 观看计时器与休息提醒（`playerWatchTimer/index.ts`、`playerWatchReminder/index.ts`）

- **视频播放状态**：遍历全部 `document.querySelectorAll<HTMLVideoElement>("video")`，检查 `!video.paused && !video.ended && video.readyState > HTMLMediaElement.HAVE_CURRENT_DATA`。
- **视频标题采集**：`h1.video-title, h1[title], .video-title, .media-title`（回退 `document.title` 并剥离 `/[_-]?哔哩哔哩.*$/u`）。

---

## 4. 全站主题探测与背景透明覆写

### 4.1 主题探测（`src/content/pageTheme.ts` & `pageThemeEvents.ts`）

- **根元素探测**：`html`, `body`, `#app`, `[data-v-app]`, `.bili-app`, `.bili-layout`, `.bili-page`, `.bpx-player-container` 上的 `data-theme`、`data-color-mode`、`data-mode`、`color-scheme`、`className` 及 `getComputedStyle(document.documentElement).colorScheme`。
- **头像菜单兜底探测**：`.header-avatar-wrap`, `.avatar-panel-popover`, `.v-popover-content`, `.right-entry`, `.topbar`, `.top-bar`, `.bili-header` 内的 `.single-link-item` / `.links-item` 文本匹配中文/英文主题关键词。

### 4.2 自定义背景透明覆写（`src/content/customBackground.ts`）

注入 `#bili-manager-custom-background` 并对以下官方容器强制 `background-color: transparent !important`：

- `html`, `body`, `#app`, `.bili-feed4`, `.bili-feed4-layout`, `.search-page`, `.search-container`, `.bpx-player-container`, `.video-container-v1`, `.left-container`, `.right-container`。

---

## 5. B 站 Web API 依赖（`src/background/favoriteFolderApi.ts`）

- **接口地址**：`GET https://api.bilibili.com/x/v3/fav/resource/list`
- **认证方式**：`credentials: "include"`（直接复用浏览器当前登录态 Cookie）。
- **请求参数**：`media_id={folderId}`, `pn={pageNumber}`, `ps=20`, `keyword=""`, `order="mtime"`, `type=0`, `tid=0`, `platform="web"`，单收藏夹最多翻页 `100` 次（最多约 2000 条）。
- **字段映射与过滤**：
  - 过滤 `attr === 9` 或标题为 `"已失效视频"` / `"视频已失效"` 的失效条目；
  - 读取 `id`, `bvid`/`bv_id`, `link`, `title`, `cover`, `upper.mid`, `upper.name`, `pubtime`/`ctime`；
  - HTTP `404` 或业务错误码 `-400` / `-404` / `-101` 统一提示收藏夹不存在或无权访问。

---

## 6. B 站改版维护检查清单

当某一功能在 B 站页面突然失效时，按以下顺序定位：

1. **先查 URL 与注入匹配**：确认新页面 URL 是否仍命中 `isSearchPage` / `isPlayerPage` / `isMajorBilibiliPage`。
2. **用浏览器 DevTools 核对 DOM 选择器**：在 Console 验证本文档对应模块的 `querySelectorAll` 返回是否为空，尤其关注搜索卡片 `stats` 顺序回退与播放器 `.video-pod .continuous-btn` 结构变化。
3. **检查样式层级冲突**：若遮罩错位或背景不透明，检查 `.bili-video-card__image`、`z-index` 或官方新增的背景包装类名。
4. **验证接口返回**：在 Background Service Worker 控制台测试收藏夹接口响应码与 `medias` 字段结构是否变更。
5. **更新源码与本文件**：修复后务必同步更新本文件中的选择器/API 条目。
