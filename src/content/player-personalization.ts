import type { PlayerPersonalizationSettings } from "../shared/types";

const HIDDEN_CLASS = "bili-manager-personalization-hidden";
const HIDDEN_ATTR = "data-bili-manager-personalization-hidden";
const AUTO_CONTROL_ATTR = "data-bili-manager-autoplay-checked";
const VIDEO_ENDED_ATTR = "data-bili-manager-ended-bound";
const BLOCK_RELATED_ATTR = "data-bili-manager-block-related";
const PLAYER_PERSONALIZATION_ATTR = "data-bili-manager-player-personalization";

const RELATED_MODULE_SELECTOR = [
  ".right-container .rec-list",
  ".right-container .video-card-ad-small",
].join(", ");
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
    document.querySelector<HTMLElement>(".rec-list"),
    document.querySelector<HTMLElement>(".video-card-ad-small"),
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
  return removeNestedModules([...document.querySelectorAll<HTMLElement>(RELATED_MODULE_SELECTOR)]);
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
