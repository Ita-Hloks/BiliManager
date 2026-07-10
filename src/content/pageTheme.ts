export type BilibiliPageTheme = "dark" | "light";
export type BilibiliPageThemeDetection = BilibiliPageTheme | "unknown";

const THEME_TOKEN_MAP: Record<string, BilibiliPageTheme> = {
  dark: "dark",
  "dark-mode": "dark",
  "theme-dark": "dark",
  "bili-dark": "dark",
  light: "light",
  "light-mode": "light",
  "theme-light": "light",
  "bili-light": "light",
};

const THEME_TEXT_MAP: Record<string, BilibiliPageTheme> = {
  dark: "dark",
  light: "light",
  暗色: "dark",
  深色: "dark",
  亮色: "light",
  浅色: "light",
};

const OFFICIAL_THEME_TEXT_PATTERN =
  /(?:主题\s*[:：]\s*)?(暗色|深色|亮色|浅色|dark|light)(?:模式)?/i;

export function detectBilibiliPageTheme(): BilibiliPageThemeDetection {
  return detectThemeFromDocument() ?? detectOfficialAvatarTheme() ?? "unknown";
}

function detectThemeFromDocument(): BilibiliPageTheme | null {
  for (const element of getThemeRootElements()) {
    const datasetTheme = readThemeToken(
      element.dataset.theme,
      element.dataset.colorMode,
      element.getAttribute("data-theme"),
      element.getAttribute("data-color-mode"),
      element.getAttribute("data-mode"),
      element.getAttribute("color-scheme"),
      element.className,
    );
    if (datasetTheme) return datasetTheme;
  }

  return readThemeToken(getComputedStyle(document.documentElement).colorScheme);
}

function detectOfficialAvatarTheme(): BilibiliPageTheme | null {
  const selectors = [
    ".header-avatar-wrap .single-link-item",
    ".header-avatar-wrap .links-item",
    ".avatar-panel-popover .single-link-item",
    ".avatar-panel-popover .links-item",
    ".right-entry .single-link-item",
    ".right-entry .links-item",
    ".topbar .single-link-item",
    ".topbar .links-item",
    ".top-bar .single-link-item",
    ".top-bar .links-item",
    ".bili-header .single-link-item",
    ".bili-header .links-item",
  ];

  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const theme = parseOfficialThemeText(element.textContent ?? "");
      if (theme) return theme;
    }
  }

  return parseOfficialThemeText(document.querySelector(".header-avatar-wrap")?.textContent ?? "");
}

function getThemeRootElements(): HTMLElement[] {
  return [
    document.documentElement,
    document.body,
    document.getElementById("app"),
    document.querySelector("[data-v-app]"),
    document.querySelector(".bili-app"),
    document.querySelector(".bili-layout"),
    document.querySelector(".bili-page"),
    document.querySelector(".bpx-player-container"),
  ].filter((element): element is HTMLElement => !!element);
}

function parseOfficialThemeText(text: string): BilibiliPageTheme | null {
  const match = normalizeText(text).match(OFFICIAL_THEME_TEXT_PATTERN);
  if (!match?.[1]) return null;

  return THEME_TEXT_MAP[match[1].toLowerCase()] ?? null;
}

function readThemeToken(...values: Array<string | null | undefined>): BilibiliPageTheme | null {
  for (const value of values) {
    const theme = parseThemeToken(value);
    if (theme) return theme;
  }

  return null;
}

function parseThemeToken(value: string | null | undefined): BilibiliPageTheme | null {
  if (!value) return null;

  for (const token of normalizeText(value).toLowerCase().split(/\s+/)) {
    const theme = THEME_TOKEN_MAP[token];
    if (theme) return theme;
  }

  return null;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
