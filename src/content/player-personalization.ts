import type { PlayerPersonalizationSettings } from "../shared/types";

const HIDDEN_CLASS = "bili-manager-personalization-hidden";
const HIDDEN_ATTR = "data-bili-manager-personalization-hidden";
const AUTO_CONTROL_ATTR = "data-bili-manager-autoplay-checked";
const VIDEO_ENDED_ATTR = "data-bili-manager-ended-bound";
const BLOCK_RELATED_ATTR = "data-bili-manager-block-related";
const PLAYER_PERSONALIZATION_ATTR = "data-bili-manager-player-personalization";

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
const RELATED_TRACK_RE = /recommend_more_video|specialRecommendByOp|right_bottom\.adfloor/;
let latestSettings: PlayerPersonalizationSettings = {
  blockRelatedVideos: false,
  disableRecommendationAutoplay: false,
};

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
  latestSettings = settings;

  if (!isPlayerPage()) {
    clearRelatedVideoModules();
    syncPlayerPersonalizationState(false, false);
    return;
  }

  syncPlayerPersonalizationState(true, settings.blockRelatedVideos);

  if (settings.disableRecommendationAutoplay) {
    bindVideoEndedGuards();
    disableRecommendationAutoplay();
  }

  if (settings.blockRelatedVideos) {
    hideFallbackRelatedVideoModules();
  } else {
    clearRelatedVideoModules();
  }
}

export function getPlayerObservationTargets(): HTMLElement[] {
  const targets = [
    document.querySelector<HTMLElement>(".right-container"),
    document.querySelector<HTMLElement>(".video-card-ad-small"),
    document.querySelector<HTMLElement>(".video-pod"),
  ].filter(Boolean) as HTMLElement[];

  return targets.length > 0 ? removeNestedModules(targets) : [document.body];
}

function syncPlayerPersonalizationState(isPlayer: boolean, shouldBlockRelated: boolean) {
  const root = document.documentElement;
  if (!isPlayer) {
    root.removeAttribute(PLAYER_PERSONALIZATION_ATTR);
    root.removeAttribute(BLOCK_RELATED_ATTR);
    return;
  }

  root.setAttribute(PLAYER_PERSONALIZATION_ATTR, "true");
  if (shouldBlockRelated) root.setAttribute(BLOCK_RELATED_ATTR, "true");
  else root.removeAttribute(BLOCK_RELATED_ATTR);
}

function hideFallbackRelatedVideoModules() {
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
  const rightContainer = document.querySelector<HTMLElement>(".right-container");

  if (!rightContainer) return [];

  collectKnownRelatedModules().forEach(element => modules.add(element));

  rightContainer.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(link => {
    if (!isRelatedLink(link)) return;

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

function isRelatedLink(link: HTMLAnchorElement): boolean {
  const target = getUrl(link.href);
  if (!target || !target.hostname.endsWith("bilibili.com")) return false;
  if (isCurrentEpisodeLink(target)) return false;
  if (RELATED_TRACK_RE.test(target.href)) return true;
  if (!/^\/video\/(?:BV|av)/i.test(target.pathname)) return false;

  const currentVideoId = getVideoId(new URL(location.href));
  const targetVideoId = getVideoId(target);
  if (currentVideoId && targetVideoId && currentVideoId === targetVideoId) return false;

  return true;
}

function isCurrentEpisodeLink(target: URL) {
  return target.searchParams.has("p") && getVideoId(target) === getVideoId(new URL(location.href));
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
  return [...document.querySelectorAll<HTMLElement>(".right-container .video-pod .continuous-btn")];
}

function shouldDisableAutoplayControl(control: HTMLElement) {
  if (control.getAttribute(AUTO_CONTROL_ATTR) === "true") return false;

  return isBilibiliContinuousButton(control) && !!control.querySelector(".switch-btn.on");
}

function isBilibiliContinuousButton(control: HTMLElement) {
  return control.matches(".right-container .video-pod .continuous-btn");
}

function bindVideoEndedGuards() {
  document.querySelectorAll<HTMLVideoElement>("video").forEach(video => {
    if (video.getAttribute(VIDEO_ENDED_ATTR) === "true") return;

    video.setAttribute(VIDEO_ENDED_ATTR, "true");
    video.addEventListener("ended", () => {
      window.setTimeout(() => {
        video.pause();
        disableRecommendationAutoplay();
        if (latestSettings.blockRelatedVideos) hideFallbackRelatedVideoModules();
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
