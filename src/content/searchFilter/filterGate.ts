import type { FavoriteVideo } from "../../shared/favoriteFolder";
import { BLOCK_MENU_CONTROL_ATTR } from "../blockMenu";
import {
  formatFavoritePublishedDate,
  getFavoriteVideoUrl,
  normalizeFavoriteCoverUrl,
} from "../favoriteRecommendation";

export const FILTER_REASON_CLASS = "bili-manager-filter-reasons";

const STATE_ATTR = "data-bili-manager-filter-state";
const GATE_ATTR = "data-bili-manager-filter-gate";
const REASON_TEXT_ATTR = "data-bili-manager-filter-reason-text";
const RECOMMENDATION_HOST_CLASS = "bili-manager-filter-reasons--recommendation";
const RECOMMENDATION_LINK_ATTR = "data-bili-manager-favorite-recommendation-link";
const RECOMMENDATION_ID_ATTR = "data-bili-manager-favorite-recommendation-id";

type FilterGateState = "locked" | "peek" | "unlocked";

const LOCKED_POINTER_EVENT_NAMES = [
  "click",
  "auxclick",
  "pointerover",
  "pointerenter",
  "mouseover",
  "mouseenter",
] as const;

const recommendationsByCard = new WeakMap<HTMLElement, FavoriteVideo>();

let filterGateEventsBound = false;

export function markFilterGateActive(cardEl: HTMLElement): void {
  bindFilterGateEvents();
  if (!cardEl.hasAttribute(GATE_ATTR)) cardEl.setAttribute(GATE_ATTR, "locked");
  cardEl.setAttribute(STATE_ATTR, "filtered");
}

export function renderFilterGate(
  cardEl: HTMLElement,
  reasonEl: HTMLElement,
  visibleReason: string,
  recommendation: FavoriteVideo | null,
): void {
  if (recommendation) recommendationsByCard.set(cardEl, recommendation);
  else recommendationsByCard.delete(cardEl);
  cardEl.setAttribute(REASON_TEXT_ATTR, visibleReason);
  updateReasonOverlay(cardEl, reasonEl, visibleReason);
}

export function clearFilterGate(cardEl: HTMLElement): void {
  recommendationsByCard.delete(cardEl);
  cardEl.removeAttribute(STATE_ATTR);
  cardEl.removeAttribute(GATE_ATTR);
  cardEl.removeAttribute(REASON_TEXT_ATTR);
}

export function getFilteredCards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[${STATE_ATTR}], .bili-manager-filtered`)];
}

export function unbindFilterGateEvents(): void {
  if (!filterGateEventsBound) return;

  LOCKED_POINTER_EVENT_NAMES.forEach(eventName => {
    document.removeEventListener(eventName, stopLockedCardEvent, true);
  });
  document.removeEventListener("keydown", stopLockedKeyboardNavigation, true);
  document.removeEventListener("contextmenu", handleFilteredContextMenu, true);
  filterGateEventsBound = false;
}

function bindFilterGateEvents(): void {
  if (filterGateEventsBound) return;

  LOCKED_POINTER_EVENT_NAMES.forEach(eventName => {
    document.addEventListener(eventName, stopLockedCardEvent, true);
  });
  document.addEventListener("keydown", stopLockedKeyboardNavigation, true);
  document.addEventListener("contextmenu", handleFilteredContextMenu, true);
  filterGateEventsBound = true;
}

function stopLockedCardEvent(event: Event): void {
  const cardEl = getEventFilteredCard(event);
  if (!cardEl || getGateState(cardEl) === "unlocked") return;

  stopEvent(event);
}

function stopLockedKeyboardNavigation(event: KeyboardEvent): void {
  if (event.key !== "Enter" && event.key !== " ") return;

  stopLockedCardEvent(event);
}

function handleFilteredContextMenu(event: MouseEvent): void {
  const cardEl = getEventFilteredCard(event);
  if (!cardEl) return;

  stopEvent(event);

  const currentState = getGateState(cardEl);
  const nextState: FilterGateState =
    currentState === "locked" ? "peek" : currentState === "peek" ? "unlocked" : "locked";
  cardEl.setAttribute(GATE_ATTR, nextState);
  refreshReasonOverlay(cardEl);
}

function getEventFilteredCard(event: Event): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  if (target.closest(`[${RECOMMENDATION_LINK_ATTR}]`)) return null;
  if (target.closest(`[${BLOCK_MENU_CONTROL_ATTR}]`)) return null;
  const cardEl = target.closest<HTMLElement>(`.bili-manager-filtered[${STATE_ATTR}="filtered"]`);
  if (
    cardEl &&
    recommendationsByCard.has(cardEl) &&
    target.closest("a[href*='space.bilibili.com']")
  ) {
    return null;
  }
  return cardEl;
}

function stopEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function getGateState(cardEl: HTMLElement): FilterGateState {
  const state = cardEl.getAttribute(GATE_ATTR);
  if (state === "peek" || state === "unlocked") return state;
  return "locked";
}

function refreshReasonOverlay(cardEl: HTMLElement): void {
  const reasonEl = cardEl.querySelector<HTMLElement>(`.${FILTER_REASON_CLASS}`);
  if (!reasonEl) return;

  updateReasonOverlay(cardEl, reasonEl, cardEl.getAttribute(REASON_TEXT_ATTR) ?? "");
}

function updateReasonOverlay(
  cardEl: HTMLElement,
  reasonEl: HTMLElement,
  visibleReason: string,
): void {
  const gateState = getGateState(cardEl);
  const text = gateState === "peek" ? "再次右键显示封面，之后可点击进入" : visibleReason;
  const recommendation = gateState === "locked" ? recommendationsByCard.get(cardEl) : undefined;

  reasonEl.classList.toggle("bili-manager-filter-reasons--hidden", gateState === "unlocked");
  reasonEl.classList.toggle(RECOMMENDATION_HOST_CLASS, !!recommendation);
  if (recommendation) renderFavoriteRecommendation(reasonEl, recommendation);
  else setReasonText(reasonEl, text);
  reasonEl.setAttribute(
    "aria-label",
    recommendation
      ? getFavoriteRecommendationAriaLabel(recommendation, visibleReason)
      : text || visibleReason,
  );
  reasonEl.removeAttribute("title");
}

function renderFavoriteRecommendation(reasonEl: HTMLElement, video: FavoriteVideo): void {
  const recommendationId = video.bvid || video.id;
  if (
    reasonEl.getAttribute(RECOMMENDATION_ID_ATTR) === recommendationId &&
    reasonEl.querySelector(`[${RECOMMENDATION_LINK_ATTR}]`)
  ) {
    return;
  }

  const videoUrl = getFavoriteVideoUrl(video);
  const link = document.createElement("a");
  link.className = "bili-manager-favorite-recommendation";
  link.href = videoUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.tabIndex = 0;
  link.setAttribute(RECOMMENDATION_LINK_ATTR, "true");
  link.addEventListener("click", event => openFavoriteVideo(event, videoUrl));
  link.addEventListener("auxclick", event => {
    if (event.button === 1) openFavoriteVideo(event, videoUrl);
  });
  link.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") openFavoriteVideo(event, videoUrl);
  });

  if (video.coverUrl) {
    const cover = document.createElement("img");
    cover.className = "bili-manager-favorite-recommendation__cover";
    cover.src = normalizeFavoriteCoverUrl(video.coverUrl);
    cover.alt = "";
    cover.loading = "lazy";
    link.append(cover);
  }

  const shade = document.createElement("span");
  shade.className = "bili-manager-favorite-recommendation__shade";

  const content = document.createElement("span");
  content.className = "bili-manager-favorite-recommendation__content";

  const source = document.createElement("span");
  source.className = "bili-manager-favorite-recommendation__source";
  source.textContent = "收藏夹";

  content.append(source);
  link.append(shade, content);
  reasonEl.replaceChildren(link);
  reasonEl.setAttribute(RECOMMENDATION_ID_ATTR, recommendationId);
}

function getFavoriteRecommendationAriaLabel(video: FavoriteVideo, visibleReason: string): string {
  const publishedDate = formatFavoritePublishedDate(video.publishedAt);
  const metadata = [
    video.uploader ? `作者：${video.uploader}` : "",
    publishedDate ? `发布日期：${publishedDate}` : "",
  ].filter(Boolean);
  const recommendation = [video.title, ...metadata].join("；");
  return `来自收藏夹：${recommendation}；原结果过滤原因：${visibleReason}`;
}

function setReasonText(reasonEl: HTMLElement, text: string): void {
  reasonEl.removeAttribute(RECOMMENDATION_ID_ATTR);
  if (reasonEl.textContent !== text || reasonEl.children.length > 0) reasonEl.textContent = text;
}

function openFavoriteVideo(event: Event, videoUrl: string): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  window.open(videoUrl, "_blank", "noopener,noreferrer");
}
