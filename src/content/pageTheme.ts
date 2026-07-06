export type BilibiliPageTheme = "dark" | "light";
export type BilibiliPageThemeDetection = BilibiliPageTheme | "unknown";

export function detectBilibiliPageTheme(): BilibiliPageThemeDetection {
  return detectOfficialAvatarTheme() ?? "unknown";
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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
