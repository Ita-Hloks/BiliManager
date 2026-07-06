import type { CustomBackgroundSettings } from "../shared/types";
import { detectBilibiliPageTheme } from "./pageTheme";

const ROOT_ID = "bili-manager-custom-background";
const STYLE_ID = "bili-manager-custom-background-style";
const ENABLED_ATTR = "data-bili-manager-custom-background";

export function applyCustomBackground(settings: CustomBackgroundSettings): void {
  ensureStyle();

  if (!shouldApplyCustomBackground(settings)) {
    removeBackground();
    return;
  }

  const root = ensureRoot();
  root.style.backgroundImage = `url("${settings.imageDataUrl}")`;
  root.style.backgroundPosition = `${clamp(settings.positionX, 0, 100)}% ${clamp(
    settings.positionY,
    0,
    100,
  )}%`;
  applyBackgroundThemeClass(root);
  document.documentElement.dataset.biliManagerCustomBackground = "true";
}

function shouldApplyCustomBackground(settings: CustomBackgroundSettings) {
  return settings.enabled && !!settings.imageDataUrl && isMajorBilibiliPage();
}

function isMajorBilibiliPage() {
  const hostname = location.hostname;
  const pathname = location.pathname;

  if (hostname === "search.bilibili.com") return true;
  if (hostname === "www.bilibili.com") {
    return (
      pathname === "/" ||
      pathname.startsWith("/video/") ||
      pathname.startsWith("/list/") ||
      pathname.startsWith("/bangumi/") ||
      pathname.startsWith("/read/")
    );
  }

  return (
    hostname === "t.bilibili.com" ||
    hostname === "space.bilibili.com" ||
    hostname === "message.bilibili.com"
  );
}

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = ROOT_ID;
  document.body.prepend(root);
  return root;
}

function applyBackgroundThemeClass(root: HTMLElement) {
  const theme = detectBilibiliPageTheme();
  root.classList.toggle("bili-manager-page-dark", theme === "dark");
  root.classList.toggle("bili-manager-page-light", theme === "light");
}

function removeBackground() {
  document.getElementById(ROOT_ID)?.remove();
  document.documentElement.removeAttribute(ENABLED_ATTR);
  delete document.documentElement.dataset.biliManagerCustomBackground;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background-size: cover;
      background-repeat: no-repeat;
      background-color: #0f172a;
      isolation: isolate;
    }

    #${ROOT_ID}::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: rgba(15, 23, 42, 0.18);
    }

    #${ROOT_ID}.bili-manager-page-light::after {
      background: rgba(255, 255, 255, 0.2);
    }

    html[${ENABLED_ATTR}="true"],
    html[${ENABLED_ATTR}="true"] body {
      background: transparent !important;
    }

    html[${ENABLED_ATTR}="true"] #app,
    html[${ENABLED_ATTR}="true"] .bili-feed4,
    html[${ENABLED_ATTR}="true"] .bili-feed4-layout,
    html[${ENABLED_ATTR}="true"] .search-page,
    html[${ENABLED_ATTR}="true"] .search-container,
    html[${ENABLED_ATTR}="true"] .bpx-player-container,
    html[${ENABLED_ATTR}="true"] .video-container-v1,
    html[${ENABLED_ATTR}="true"] .left-container,
    html[${ENABLED_ATTR}="true"] .right-container {
      background-color: transparent !important;
    }
  `;
  document.head.append(style);
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
