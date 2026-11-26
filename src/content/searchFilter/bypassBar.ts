import type { BilibiliPageThemeDetection } from "../pageTheme";

export const SEARCH_BYPASS_BAR_ID = "bili-manager-search-bypass-bar";

const PAGE_DARK_CLASS = "bili-manager-page-dark";
const PAGE_LIGHT_CLASS = "bili-manager-page-light";
const BYPASSED_CLASS = "bili-manager-search-bypass--active";
const FALLBACK_FIXED_CLASS = "bili-manager-search-bypass--fixed";

const SEARCH_CONDITIONS_SELECTOR = ".search-conditions";
const INLINE_BEFORE_SELECTORS = [".search-page-wrapper", ".search-page", ".video-list"];

export type SearchBypassBarState = {
  total: number;
  filtered: number;
  grayscaled: number;
  bypassed: boolean;
  regexErrorCount: number;
  pageTheme: BilibiliPageThemeDetection;
  onToggleBypass: () => void;
};

let activeSessionKey: string | null = null;
let bypassedSessionKey: string | null = null;
let dismissedSessionKey: string | null = null;
let lastSignature = "";
let currentToggleHandler: (() => void) | null = null;

/**
 * 同步当前搜索会话 key；当搜索关键词变化时自动重置临时放行与收起状态。
 */
export function syncSearchSessionKey(url = location.href): boolean {
  const nextSessionKey = getSearchSessionKey(url);
  if (nextSessionKey !== activeSessionKey) {
    activeSessionKey = nextSessionKey;
    bypassedSessionKey = null;
    dismissedSessionKey = null;
    lastSignature = "";
  }
  return isSearchFilterBypassed();
}

export function isSearchFilterBypassed(): boolean {
  return activeSessionKey !== null && bypassedSessionKey === activeSessionKey;
}

export function resetSearchBypassState(): void {
  activeSessionKey = null;
  bypassedSessionKey = null;
  dismissedSessionKey = null;
  lastSignature = "";
}

export function renderSearchBypassBar(state: SearchBypassBarState): void {
  currentToggleHandler = state.onToggleBypass;

  const hasVisibleSignal =
    state.bypassed || state.filtered > 0 || state.grayscaled > 0 || state.regexErrorCount > 0;
  const isDismissed = activeSessionKey !== null && dismissedSessionKey === activeSessionKey;
  if (!hasVisibleSignal || isDismissed) {
    clearSearchBypassBar();
    return;
  }

  const mountTarget = resolveMountTarget();
  const resolvedTheme = resolveBarTheme(state.pageTheme);
  const signature = JSON.stringify([
    state.total,
    state.filtered,
    state.grayscaled,
    state.bypassed,
    state.regexErrorCount,
    resolvedTheme,
    mountTarget.mode,
  ]);

  const existing = document.getElementById(SEARCH_BYPASS_BAR_ID);
  const correctlyMounted = isMountedAtTarget(existing, mountTarget);
  if (existing && correctlyMounted && lastSignature === signature) return;

  lastSignature = signature;
  const root = existing ?? createBypassBar();
  root.classList.toggle(PAGE_DARK_CLASS, resolvedTheme === "dark");
  root.classList.toggle(PAGE_LIGHT_CLASS, resolvedTheme === "light");
  root.classList.toggle(BYPASSED_CLASS, state.bypassed);
  root.classList.toggle(FALLBACK_FIXED_CLASS, mountTarget.mode === "fixed");

  const summaryEl = root.querySelector<HTMLElement>(".bili-manager-search-bypass__summary");
  const actionBtn = root.querySelector<HTMLButtonElement>(".bili-manager-search-bypass__action");
  if (summaryEl) summaryEl.textContent = formatSummary(state);
  if (actionBtn) {
    actionBtn.textContent = state.bypassed ? "恢复过滤" : "临时放行";
    actionBtn.title = state.bypassed
      ? "恢复当前搜索结果过滤"
      : "本次搜索暂不过滤（切换搜索词后自动恢复）";
  }

  if (!correctlyMounted) mountBar(root, mountTarget);
}

export function clearSearchBypassBar(): void {
  document.getElementById(SEARCH_BYPASS_BAR_ID)?.remove();
  lastSignature = "";
  currentToggleHandler = null;
}

type MountTarget =
  | { mode: "append"; container: HTMLElement }
  | { mode: "before"; anchor: HTMLElement }
  | { mode: "fixed"; container: HTMLElement };

function resolveMountTarget(): MountTarget {
  const conditions = document.querySelector<HTMLElement>(SEARCH_CONDITIONS_SELECTOR);
  if (conditions) return { mode: "append", container: conditions };

  for (const selector of INLINE_BEFORE_SELECTORS) {
    const anchor = document.querySelector<HTMLElement>(selector);
    if (anchor?.parentElement) {
      return { mode: "before", anchor };
    }
  }

  return { mode: "fixed", container: document.body };
}

function isMountedAtTarget(element: HTMLElement | null, target: MountTarget): boolean {
  if (!element || !element.isConnected) return false;
  if (target.mode === "append") return element.parentElement === target.container;
  if (target.mode === "before") return element.nextElementSibling === target.anchor;
  return element.parentElement === target.container;
}

function mountBar(root: HTMLElement, target: MountTarget): void {
  if (target.mode === "append") {
    target.container.append(root);
    return;
  }
  if (target.mode === "before") {
    target.anchor.before(root);
    return;
  }
  target.container.append(root);
}

function createBypassBar(): HTMLElement {
  const root = document.createElement("aside");
  root.id = SEARCH_BYPASS_BAR_ID;
  root.setAttribute("aria-label", "BiliManager 搜索过滤控制");

  const statusGroup = document.createElement("div");
  statusGroup.className = "bili-manager-search-bypass__status";

  const dot = document.createElement("span");
  dot.className = "bili-manager-search-bypass__dot";
  dot.setAttribute("aria-hidden", "true");

  const summary = document.createElement("span");
  summary.className = "bili-manager-search-bypass__summary";

  statusGroup.append(dot, summary);

  const actionsGroup = document.createElement("div");
  actionsGroup.className = "bili-manager-search-bypass__actions";

  const action = document.createElement("button");
  action.className = "bili-manager-search-bypass__action";
  action.type = "button";
  action.addEventListener("click", () => {
    if (!activeSessionKey) activeSessionKey = getSearchSessionKey();
    bypassedSessionKey = bypassedSessionKey === activeSessionKey ? null : activeSessionKey;
    dismissedSessionKey = null;
    lastSignature = "";
    currentToggleHandler?.();
  });

  const dismiss = document.createElement("button");
  dismiss.className = "bili-manager-search-bypass__dismiss";
  dismiss.type = "button";
  dismiss.textContent = "×";
  dismiss.title = "本次搜索隐藏提示";
  dismiss.setAttribute("aria-label", "本次搜索隐藏提示");
  dismiss.addEventListener("click", () => {
    if (activeSessionKey) dismissedSessionKey = activeSessionKey;
    clearSearchBypassBar();
  });

  actionsGroup.append(action, dismiss);
  root.append(statusGroup, actionsGroup);
  return root;
}

function formatSummary(state: SearchBypassBarState): string {
  const parts: string[] = [];

  if (state.bypassed) {
    parts.push("BiliManager 已临时放行当前搜索");
    if (state.filtered > 0) parts.push(`原拦截 ${state.filtered}/${state.total} 条`);
    else if (state.grayscaled > 0) parts.push(`原降权 ${state.grayscaled}/${state.total} 条`);
  } else {
    if (state.filtered > 0)
      parts.push(`BiliManager 已过滤 ${state.filtered}/${state.total} 条结果`);
    if (state.grayscaled > 0) {
      parts.push(
        state.filtered > 0
          ? `降权 ${state.grayscaled} 条`
          : `BiliManager 已降权 ${state.grayscaled}/${state.total} 条结果`,
      );
    }
    if (state.filtered === 0 && state.grayscaled === 0 && state.regexErrorCount > 0) {
      parts.push(`BiliManager 过滤正则有误（${state.regexErrorCount} 项）`);
    }
  }

  return parts.join(" · ");
}

function getSearchSessionKey(url = location.href): string {
  try {
    const parsed = new URL(url);
    const keyword = parsed.searchParams.get("keyword")?.trim().toLowerCase() ?? "";
    return keyword ? `kw:${keyword}` : `path:${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function resolveBarTheme(pageTheme: BilibiliPageThemeDetection): "dark" | "light" {
  if (pageTheme === "dark" || pageTheme === "light") return pageTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
