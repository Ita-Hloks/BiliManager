export type BilibiliPageTheme = "dark" | "light";

export function detectBilibiliPageTheme(): BilibiliPageTheme {
  const officialTheme = detectOfficialAvatarTheme();
  if (officialTheme) return officialTheme;

  const explicitTheme = detectExplicitTheme();
  if (explicitTheme) return explicitTheme;

  const colorScheme = [
    getComputedStyle(document.documentElement).colorScheme,
    getComputedStyle(document.body).colorScheme,
  ]
    .join(" ")
    .toLowerCase();
  if (colorScheme.includes("dark")) return "dark";

  return detectBackgroundTheme();
}

function detectOfficialAvatarTheme(): BilibiliPageTheme | null {
  const candidates = [
    ".header-avatar-wrap .single-link-item",
    ".header-avatar-wrap .links-item",
    ".avatar-panel-popover .single-link-item",
    ".avatar-panel-popover .links-item",
    ".right-entry .single-link-item",
    ".right-entry .links-item",
  ];

  for (const selector of candidates) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const theme = parseOfficialThemeText(element.textContent ?? "");
      if (theme) return theme;
    }
  }

  return parseOfficialThemeText(document.querySelector(".header-avatar-wrap")?.textContent ?? "");
}

function parseOfficialThemeText(text: string): BilibiliPageTheme | null {
  const match = normalizeText(text).match(
    /主题\s*[:：]\s*(浅色|亮色|白色|light|深色|暗色|黑色|dark)/i,
  );
  if (!match?.[1]) return null;

  return /深色|暗色|黑色|dark/i.test(match[1]) ? "dark" : "light";
}

function detectExplicitTheme(): BilibiliPageTheme | null {
  const themeText = [document.documentElement, document.body]
    .map(element =>
      [
        element.dataset.theme,
        element.dataset.colorMode,
        element.dataset.mode,
        element.className,
        element.getAttribute("theme"),
      ].join(" "),
    )
    .join(" ")
    .toLowerCase();

  if (/\b(?:dark|night|black|theme-dark)\b/.test(themeText)) return "dark";
  if (/\b(?:light|white|theme-light)\b/.test(themeText)) return "light";
  return null;
}

function detectBackgroundTheme(): BilibiliPageTheme {
  const candidates = [
    document.querySelector<HTMLElement>(".search-page"),
    document.querySelector<HTMLElement>("#app"),
    document.querySelector<HTMLElement>("#i_cecream"),
    document.body,
    document.documentElement,
  ];

  for (const element of candidates) {
    if (!element) continue;

    const color = parseRgbColor(getComputedStyle(element).backgroundColor);
    if (!color || color.alpha < 0.2) continue;

    return getRelativeLuminance(color) < 0.5 ? "dark" : "light";
  }

  return "light";
}

function parseRgbColor(
  value: string,
): { red: number; green: number; blue: number; alpha: number } | null {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match?.[1]) return null;

  const parts = match[1].split(",").map(part => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.some(part => Number.isNaN(part))) return null;

  return {
    red: parts[0] ?? 0,
    green: parts[1] ?? 0,
    blue: parts[2] ?? 0,
    alpha: parts[3] ?? 1,
  };
}

function getRelativeLuminance(color: { red: number; green: number; blue: number }) {
  const [red, green, blue] = [color.red, color.green, color.blue].map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
