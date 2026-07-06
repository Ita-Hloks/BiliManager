type ThemeUpdateHandler = () => void;

const THEME_UPDATE_DELAYS = [80, 260, 520];
const THEME_OPTION_TEXT_PATTERN =
  /^(?:主题\s*[:：]\s*)?(?:浅色|亮色|白色|light|深色|暗色|黑色|dark)$/i;
const THEME_LABEL_TEXT_PATTERN = /主题\s*[:：]\s*(?:浅色|亮色|白色|light|深色|暗色|黑色|dark)/i;

export function bindBilibiliPageThemeUpdates(handler: ThemeUpdateHandler): () => void {
  const handleClick = (event: MouseEvent) => {
    if (isThemeUpdateTrigger(event.target)) scheduleThemeUpdate(handler);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isThemeUpdateTrigger(event.target)) scheduleThemeUpdate(handler);
  };

  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);

  return () => {
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
  };
}

function isThemeUpdateTrigger(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  const candidate = target.closest<HTMLElement>(
    ".single-link-item, .links-item, [class*='theme'], [data-theme], [data-color-mode], button, a, label, li",
  );
  if (!candidate) return false;

  const candidateText = normalizeText(candidate.textContent ?? "");
  if (THEME_LABEL_TEXT_PATTERN.test(candidateText)) return true;

  if (!THEME_OPTION_TEXT_PATTERN.test(candidateText)) return false;

  const container = candidate.closest<HTMLElement>(
    ".avatar-panel-popover, .header-avatar-wrap, .v-popover-content",
  );
  const containerText = normalizeText(container?.textContent ?? "");
  const classText = `${candidate.className || ""} ${container?.className || ""}`;
  return containerText.includes("主题") || /theme/i.test(classText);
}

function scheduleThemeUpdate(handler: ThemeUpdateHandler) {
  for (const delay of THEME_UPDATE_DELAYS) {
    window.setTimeout(handler, delay);
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
