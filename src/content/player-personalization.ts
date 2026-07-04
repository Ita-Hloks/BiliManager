import type { PlayerPersonalizationSettings } from "../shared/types";

const HIDDEN_CLASS = "bili-manager-personalization-hidden";
const HIDDEN_ATTR = "data-bili-manager-personalization-hidden";
const AUTO_CONTROL_ATTR = "data-bili-manager-autoplay-checked";
const VIDEO_ENDED_ATTR = "data-bili-manager-ended-bound";

const RELATED_LABEL_RE = /相关推荐|相关视频|推荐视频|推荐列表|接下来播放|播放下一个/;
const EPISODE_LABEL_RE =
  /分集|选集|合集|剧集|正片|花絮|视频列表|播放列表|目录|分P|第\s*\d+\s*[集话]/i;
const PROTECTED_MODULE_SELECTOR = [
  ".right-container",
  ".right-container-inner",
  ".video-pod",
  ".video-pod__body",
  ".video-pod__list",
  ".video-pod__item",
  ".base-video-sections",
  ".video-sections-content-list",
  ".up-info-container",
  ".up-panel-container",
  ".members-info-container",
  ".bpx-player-collapse",
].join(", ");
const RELATED_LIST_SELECTOR = [
  ".right-container .recommend-list-v1",
  ".right-container .rec-list",
].join(", ");
const RELATED_CARD_SELECTOR = [
  ".right-container .video-page-card-small",
  ".right-container .video-page-special-card-small",
].join(", ");
const RECOMMEND_AD_SELECTOR = [
  ".right-container .video-card-ad-small",
  ".right-container .ad-floor-exp",
  ".right-container .right-bottom-banner",
].join(", ");
const AUTOPLAY_LABEL_RE = /自动连播|自动播放|播完自动|连续播放|连播/;
const AUTOPLAY_OFF_RE = /关闭|已关闭|播完暂停|暂停连播|不连播/;
const AUTOPLAY_ON_RE = /开启|已开启|打开|已打开|自动连播|连续播放/;

export function isPlayerPage(url = location.href): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("bilibili.com")) return false;

    return (
      /^\/video\/(?:BV|av)/i.test(parsed.pathname) || parsed.pathname.startsWith("/bangumi/play/")
    );
  } catch {
    return false;
  }
}

export function applyPlayerPersonalization(settings: PlayerPersonalizationSettings): void {
  if (!isPlayerPage()) {
    clearRelatedVideoModules();
    return;
  }

  if (settings.disableRecommendationAutoplay) {
    bindVideoEndedGuards(settings.blockRelatedVideos);
    disableRecommendationAutoplay();
  }

  if (settings.blockRelatedVideos) {
    hideRelatedVideoModules();
  } else {
    clearRelatedVideoModules();
  }
}

function hideRelatedVideoModules() {
  collectRelatedVideoModules().forEach(element => {
    element.classList.add(HIDDEN_CLASS);
    element.setAttribute(HIDDEN_ATTR, "related-videos");
  });
}

function clearRelatedVideoModules() {
  document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}]`).forEach(element => {
    element.classList.remove(HIDDEN_CLASS);
    element.removeAttribute(HIDDEN_ATTR);
  });
}

function collectRelatedVideoModules(): HTMLElement[] {
  const modules = new Set<HTMLElement>();

  collectKnownRelatedModules().forEach(element => modules.add(element));

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(link => {
    if (!isRelatedVideoLink(link)) return;

    const moduleRoot = findRelatedModuleRoot(link);
    if (moduleRoot) modules.add(moduleRoot);
  });

  return removeNestedModules([...modules]);
}

function collectKnownRelatedModules(): HTMLElement[] {
  const modules = new Set<HTMLElement>();

  document
    .querySelectorAll<HTMLElement>(`${RELATED_LIST_SELECTOR}, ${RECOMMEND_AD_SELECTOR}`)
    .forEach(element => {
      if (isSafeRelatedTarget(element)) modules.add(element);
    });

  document.querySelectorAll<HTMLElement>(RELATED_CARD_SELECTOR).forEach(element => {
    if (isSafeRelatedTarget(element)) modules.add(element);
  });

  return [...modules];
}

function findRelatedModuleRoot(link: HTMLAnchorElement): HTMLElement | null {
  const knownCard = link.closest<HTMLElement>(RELATED_CARD_SELECTOR);
  if (knownCard && isSafeRelatedTarget(knownCard)) return knownCard;

  const knownList = link.closest<HTMLElement>(RELATED_LIST_SELECTOR);
  if (knownList && isSafeRelatedTarget(knownList)) return knownList;

  return findCompactRightSideCard(link);
}

function isRelatedVideoLink(link: HTMLAnchorElement): boolean {
  const target = getUrl(link.href);
  if (!target || !target.hostname.endsWith("bilibili.com")) return false;
  if (!/^\/video\/(?:BV|av)/i.test(target.pathname)) return false;

  const currentVideoId = getVideoId(new URL(location.href));
  const targetVideoId = getVideoId(target);
  if (currentVideoId && targetVideoId && currentVideoId === targetVideoId) return false;

  return true;
}

function isRightSide(rect: DOMRect) {
  if (rect.width === 0) return false;
  return (
    rect.left >= window.innerWidth * 0.52 ||
    (rect.right >= window.innerWidth * 0.86 && rect.width <= 680)
  );
}

function findCompactRightSideCard(link: HTMLAnchorElement): HTMLElement | null {
  let current = link.parentElement;
  let depth = 0;

  while (current && current !== document.body && depth < 4) {
    if (current.matches(PROTECTED_MODULE_SELECTOR) || current.closest(".video-pod")) return null;

    const rect = current.getBoundingClientRect();
    if (
      isRightSide(rect) &&
      rect.width > 0 &&
      rect.width <= 430 &&
      rect.height > 0 &&
      rect.height <= 180
    ) {
      return current;
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function isSafeRelatedTarget(element: HTMLElement) {
  if (!element.closest(".right-container")) return false;
  if (element.matches(".right-container, .right-container-inner, .rcmd-tab")) return false;
  if (element.matches(PROTECTED_MODULE_SELECTOR)) return false;
  if (element.closest(".video-pod, .base-video-sections, .video-sections-content-list")) {
    return false;
  }

  return true;
}

function removeNestedModules(modules: HTMLElement[]) {
  return modules.filter(
    module => !modules.some(other => other !== module && other.contains(module)),
  );
}

function disableRecommendationAutoplay() {
  collectAutoplayControls().forEach(control => {
    if (!shouldDisableAutoplayControl(control)) return;

    control.setAttribute(AUTO_CONTROL_ATTR, "true");
    control.click();
    window.setTimeout(() => control.removeAttribute(AUTO_CONTROL_ATTR), 1200);
  });
}

function collectAutoplayControls(): HTMLElement[] {
  const controls = new Set<HTMLElement>();

  document
    .querySelectorAll<HTMLElement>(".right-container .video-pod .continuous-btn")
    .forEach(element => {
      if (AUTOPLAY_LABEL_RE.test(normalizeText(element.textContent ?? ""))) {
        controls.add(element);
      }
    });

  document
    .querySelectorAll<HTMLElement>(
      "button, [role='switch'], [role='checkbox'], input[type='checkbox']",
    )
    .forEach(element => {
      const context = getAutoplayContext(element);
      if (context && AUTOPLAY_LABEL_RE.test(context)) controls.add(element);
    });

  document.querySelectorAll<HTMLElement>("span, div, label").forEach(element => {
    if (!AUTOPLAY_LABEL_RE.test(normalizeText(element.textContent ?? ""))) return;
    const control = element.closest<HTMLElement>(
      "button, label, [role='switch'], [role='checkbox']",
    );
    if (control) controls.add(control);
  });

  return [...controls];
}

function shouldDisableAutoplayControl(control: HTMLElement) {
  if (control.getAttribute(AUTO_CONTROL_ATTR) === "true") return false;

  if (isBilibiliContinuousButton(control)) {
    return !!control.querySelector(".switch-btn.on");
  }

  const context = getAutoplayContext(control);
  if (!context || AUTOPLAY_OFF_RE.test(context)) return false;
  if (EPISODE_LABEL_RE.test(context) && !RELATED_LABEL_RE.test(context)) return false;

  return isControlOn(control, context);
}

function isControlOn(control: HTMLElement, context: string) {
  if (control instanceof HTMLInputElement) return control.checked;

  const ariaChecked = control.getAttribute("aria-checked");
  if (ariaChecked === "true") return true;
  if (ariaChecked === "false") return false;

  const ariaPressed = control.getAttribute("aria-pressed");
  if (ariaPressed === "true") return true;
  if (ariaPressed === "false") return false;

  const datasetState = [
    control.dataset.checked,
    control.dataset.state,
    control.dataset.status,
    control.getAttribute("data-value"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\b(?:true|on|active|checked|open)\b/.test(datasetState)) return true;
  if (/\b(?:false|off|inactive|unchecked|close|closed)\b/.test(datasetState)) return false;

  const classState = control.className.toString().toLowerCase();
  if (/\b(?:on|active|checked|open|selected)\b/.test(classState)) return true;

  return AUTOPLAY_ON_RE.test(context) && !AUTOPLAY_OFF_RE.test(context);
}

function isBilibiliContinuousButton(control: HTMLElement) {
  return control.matches(".right-container .video-pod .continuous-btn");
}

function getAutoplayContext(element: HTMLElement) {
  const texts = new Set<string>();
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && current !== document.body && depth < 4) {
    texts.add(current.getAttribute("aria-label") ?? "");
    texts.add(current.getAttribute("title") ?? "");
    texts.add(current.textContent ?? "");
    current = current.parentElement;
    depth += 1;
  }

  return normalizeText([...texts].join(" "));
}

function bindVideoEndedGuards(shouldHideRelatedVideos: boolean) {
  document.querySelectorAll<HTMLVideoElement>("video").forEach(video => {
    if (video.getAttribute(VIDEO_ENDED_ATTR) === "true") return;

    video.setAttribute(VIDEO_ENDED_ATTR, "true");
    video.addEventListener("ended", () => {
      window.setTimeout(() => {
        video.pause();
        disableRecommendationAutoplay();
        if (shouldHideRelatedVideos) hideRelatedVideoModules();
      }, 0);
    });
  });
}

function getVideoId(url: URL): string | null {
  const bv = url.pathname.match(/\/video\/(BV[\da-z]+)/i)?.[1];
  if (bv) return bv.toUpperCase();

  const av = url.pathname.match(/\/video\/av(\d+)/i)?.[1];
  return av ? `AV${av}` : null;
}

function getUrl(value: string): URL | null {
  try {
    return new URL(value, location.href);
  } catch {
    return null;
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
