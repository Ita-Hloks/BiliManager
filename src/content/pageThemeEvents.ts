import { detectBilibiliPageTheme } from "./pageTheme";
import type { BilibiliPageThemeDetection } from "./pageTheme";

type ThemeUpdateHandler = () => void;

const THEME_UPDATE_DELAYS = [80, 260, 520];
const THEME_ATTRIBUTE_FILTER = [
  "class",
  "data-theme",
  "data-color-mode",
  "data-mode",
  "color-scheme",
];
const THEME_CONTROL_SELECTOR =
  ".single-link-item, .links-item, [data-theme], [data-color-mode], [data-mode], [role='menuitem'], [role='option'], button, a, label, li, input[type='radio']";
const THEME_CONTAINER_SELECTOR =
  ".avatar-panel-popover, .header-avatar-wrap, .v-popover-content, .right-entry, .topbar, .top-bar, .bili-header";
const THEME_STATE_SELECTOR = "[data-theme], [data-color-mode], [data-mode]";
const THEME_TEXT_PATTERN = /主题|暗色|深色|亮色|浅色|theme|dark|light/i;

export function bindBilibiliPageThemeUpdates(handler: ThemeUpdateHandler): () => void {
  let disposed = false;
  let lastTheme: BilibiliPageThemeDetection = detectBilibiliPageTheme();
  const pendingTimers = new Set<number>();

  const clearPendingTimers = () => {
    for (const timerId of pendingTimers) {
      window.clearTimeout(timerId);
    }
    pendingTimers.clear();
  };

  const checkThemeChange = () => {
    if (disposed) return;
    const nextTheme = detectBilibiliPageTheme();
    if (nextTheme === lastTheme) return;

    lastTheme = nextTheme;
    handler();
  };

  const schedule = () => {
    if (disposed) return;
    clearPendingTimers();
    for (const delay of THEME_UPDATE_DELAYS) {
      const timerId = window.setTimeout(() => {
        pendingTimers.delete(timerId);
        checkThemeChange();
      }, delay);
      pendingTimers.add(timerId);
    }
  };

  const handleClick = (event: MouseEvent) => {
    if (isThemeUpdateTrigger(event.target)) schedule();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isThemeUpdateTrigger(event.target)) schedule();
  };

  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);

  const observer = new MutationObserver(() => {
    checkThemeChange();
    schedule();
  });

  const observerOptions: MutationObserverInit = {
    subtree: false,
    attributes: true,
    attributeFilter: THEME_ATTRIBUTE_FILTER,
  };
  observer.observe(document.documentElement, observerOptions);
  if (document.body) {
    observer.observe(document.body, observerOptions);
  }

  return () => {
    disposed = true;
    clearPendingTimers();
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
    observer.disconnect();
  };
}

function isThemeUpdateTrigger(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  const candidate = target.closest<HTMLElement>(THEME_CONTROL_SELECTOR);
  if (!candidate) return false;
  if (candidate.matches(THEME_STATE_SELECTOR)) return true;

  const container = candidate.closest<HTMLElement>(THEME_CONTAINER_SELECTOR);
  const text = normalizeText(`${candidate.textContent ?? ""} ${container?.textContent ?? ""}`);
  return THEME_TEXT_PATTERN.test(text);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
