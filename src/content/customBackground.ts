import {
  getCustomBackgroundImage,
  isValidBackgroundImageDataUrl,
} from "../shared/customBackgroundStorage";
import { isExtensionContextInvalidated } from "../shared/extensionContext";
import { clamp } from "../shared/number";
import type { CustomBackgroundSettings } from "../shared/types";
import { detectBilibiliPageTheme } from "./pageTheme";

const ROOT_ID = "bili-manager-custom-background";
const STYLE_ID = "bili-manager-custom-background-style";
const ENABLED_ATTR = "data-bili-manager-custom-background";

let appliedRevision: number | null = null;
let cachedImageUrl: string | null = null;
let lastMaskOpacity: string | null = null;
let lastPosition: string | null = null;
let lastTheme: string | null = null;
let loadGeneration = 0;

export function applyCustomBackground(settings: CustomBackgroundSettings): void {
  if (!settings.enabled || !settings.hasImage || !isCustomBackgroundSupportedPage()) {
    removeBackground();
    return;
  }

  ensureStyle();
  const root = ensureRoot();

  const nextMaskOpacity = clamp(settings.maskOpacity, 0, 1).toString();
  if (lastMaskOpacity !== nextMaskOpacity) {
    root.style.setProperty("--bili-manager-custom-background-mask-opacity", nextMaskOpacity);
    lastMaskOpacity = nextMaskOpacity;
  }

  const nextPosition = `${clamp(settings.positionX, 0, 100)}% ${clamp(settings.positionY, 0, 100)}%`;
  if (lastPosition !== nextPosition) {
    root.style.backgroundPosition = nextPosition;
    lastPosition = nextPosition;
  }

  const nextTheme = detectBilibiliPageTheme();
  if (lastTheme !== nextTheme) {
    root.classList.toggle("bili-manager-page-dark", nextTheme === "dark");
    root.classList.toggle("bili-manager-page-light", nextTheme === "light");
    lastTheme = nextTheme;
  }

  document.documentElement.dataset.biliManagerCustomBackground = "true";

  if (appliedRevision === settings.imageRevision && cachedImageUrl) {
    if (!root.style.backgroundImage) {
      root.style.backgroundImage = `url("${cachedImageUrl}")`;
    }
    return;
  }

  const generation = ++loadGeneration;
  const targetRevision = settings.imageRevision;
  void getCustomBackgroundImage()
    .then(image => {
      if (generation !== loadGeneration) return;
      if (!image || !isValidBackgroundImageDataUrl(image.dataUrl)) {
        removeBackground();
        return;
      }

      appliedRevision = targetRevision;
      cachedImageUrl = image.dataUrl;
      const currentRoot = ensureRoot();
      currentRoot.style.backgroundImage = `url("${image.dataUrl}")`;
    })
    .catch(error => {
      if (isExtensionContextInvalidated(error)) return;
      console.error("[BiliManager] Failed to load custom background image", error);
    });
}

export function isCustomBackgroundSupportedPage(): boolean {
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

  lastMaskOpacity = null;
  lastPosition = null;
  lastTheme = null;
  root = document.createElement("div");
  root.id = ROOT_ID;
  document.body.prepend(root);
  return root;
}

function removeBackground() {
  loadGeneration += 1;
  appliedRevision = null;
  cachedImageUrl = null;
  lastMaskOpacity = null;
  lastPosition = null;
  lastTheme = null;
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.removeAttribute(ENABLED_ATTR);
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      --bili-manager-custom-background-mask-opacity: 0.18;
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
      background: rgb(15 23 42 / var(--bili-manager-custom-background-mask-opacity));
    }

    #${ROOT_ID}.bili-manager-page-light::after {
      background: rgb(255 255 255 / var(--bili-manager-custom-background-mask-opacity));
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
