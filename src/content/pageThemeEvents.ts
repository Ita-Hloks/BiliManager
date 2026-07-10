type ThemeUpdateHandler = () => void;

const THEME_UPDATE_DELAYS = [80, 260, 520];
const THEME_ATTRIBUTE_FILTER = [
  "class",
  "style",
  "data-theme",
  "data-color-mode",
  "data-mode",
  "color-scheme",
  "aria-checked",
  "aria-selected",
  "checked",
  "value",
];
const THEME_CONTROL_SELECTOR =
  ".single-link-item, .links-item, [data-theme], [data-color-mode], [data-mode], [role='menuitem'], [role='option'], button, a, label, li, input[type='radio']";
const THEME_CONTAINER_SELECTOR =
  ".avatar-panel-popover, .header-avatar-wrap, .v-popover-content, .right-entry, .topbar, .top-bar, .bili-header";
const THEME_STATE_SELECTOR = "[data-theme], [data-color-mode], [data-mode]";
const THEME_TEXT_PATTERN = /主题|暗色|深色|亮色|浅色|theme|dark|light/i;

export function bindBilibiliPageThemeUpdates(handler: ThemeUpdateHandler): () => void {
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    scheduleThemeUpdate(() => {
      if (!disposed) handler();
    });
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

  const observer = new MutationObserver(records => {
    if (!records.some(isThemeMutation)) return;
    schedule();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: THEME_ATTRIBUTE_FILTER,
  });

  return () => {
    disposed = true;
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

function scheduleThemeUpdate(handler: ThemeUpdateHandler) {
  for (const delay of THEME_UPDATE_DELAYS) {
    window.setTimeout(handler, delay);
  }
}

function isThemeMutation(record: MutationRecord): boolean {
  if (record.type === "attributes") return isThemeMutationTarget(record.target);
  if (record.type === "characterData") return isThemeMutationTarget(record.target.parentElement);

  return [...record.addedNodes, ...record.removedNodes].some(node => isThemeMutationTarget(node));
}

function isThemeMutationTarget(target: EventTarget | Node | null): boolean {
  if (!(target instanceof Element)) return false;

  if (
    target === document.documentElement ||
    target === document.body ||
    target.matches(`${THEME_STATE_SELECTOR}, [aria-checked], [aria-selected]`)
  ) {
    return true;
  }

  const themedAncestor = target.closest(`${THEME_CONTAINER_SELECTOR}, ${THEME_STATE_SELECTOR}`);
  if (!themedAncestor) return false;

  return THEME_TEXT_PATTERN.test(normalizeText(themedAncestor.textContent ?? ""));
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
