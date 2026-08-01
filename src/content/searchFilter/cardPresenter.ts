import type { FavoriteVideo } from "../../shared/favoriteFolder";
import { getFavoriteVideoUrl, normalizeFavoriteCoverUrl } from "../favoriteRecommendation";
import type { BilibiliPageThemeDetection } from "../pageTheme";
import { UPLOADER_BLOCK_CONTROL_ATTR } from "../uploaderBlock";
import { findSearchCardTitle, findSearchCardUploader } from "./pageAdapter";
import type { SearchCard } from "./types";

const STATE_ATTR = "data-bili-manager-filter-state";
const GATE_ATTR = "data-bili-manager-filter-gate";
const ORIGINAL_TITLE_ATTR = "data-bili-manager-original-title";
const REASON_TEXT_ATTR = "data-bili-manager-filter-reason-text";
const REASON_CLASS = "bili-manager-filter-reasons";
const RECOMMENDATION_HOST_CLASS = "bili-manager-filter-reasons--recommendation";
const RECOMMENDATION_META_HIDDEN_CLASS = "bili-manager-favorite-original-meta-hidden";
const RECOMMENDATION_LINK_ATTR = "data-bili-manager-favorite-recommendation-link";
const RECOMMENDATION_ID_ATTR = "data-bili-manager-favorite-recommendation-id";
const TITLE_CLASS = "bili-manager-filtered-title";
const UNHIGHLIGHTED_TITLE_CLASS = "bili-manager-unhighlighted-title";
const GRAYSCALE_COVER_CLASS = "bili-manager-grayscale-cover";
const META_CLASS = "bili-manager-filtered-meta";
const COVER_WRAP_CLASS = "bili-manager-filtered-cover-wrap";
const COVER_CLASS = "bili-manager-filtered-cover";
const PAGE_DARK_CLASS = "bili-manager-page-dark";
const PAGE_LIGHT_CLASS = "bili-manager-page-light";

type FilterGateState = "locked" | "peek" | "unlocked";

const recommendationsByCard = new WeakMap<HTMLElement, FavoriteVideo>();
const originalRecommendationText = new WeakMap<
  HTMLElement,
  { titleHtml: string | null; uploaderHtml: string | null }
>();

let filterGateEventsBound = false;

export function markFiltered(
  card: SearchCard,
  reasons: string[],
  pageTheme: BilibiliPageThemeDetection,
  recommendation: FavoriteVideo | null,
): void {
  bindFilterGateEvents();
  if (!card.cardEl.hasAttribute(GATE_ATTR)) card.cardEl.setAttribute(GATE_ATTR, "locked");

  card.cardEl.setAttribute(STATE_ATTR, "filtered");
  applyPageThemeClass(card.cardEl, pageTheme);
  card.cardEl.classList.add("bili-manager-filtered");
  card.titleEl?.classList.add(TITLE_CLASS);
  card.titleEl?.classList.remove(UNHIGHLIGHTED_TITLE_CLASS);
  card.thumbnailEl?.classList.remove(GRAYSCALE_COVER_CLASS);
  card.metadataEls.forEach(element => element.classList.add(META_CLASS));
  const coverHost = getCoverOverlayHost(card);
  coverHost.classList.add(COVER_WRAP_CLASS);
  card.thumbnailEl?.classList.add(COVER_CLASS);
  card.previewEls.forEach(element => {
    element.classList.add("bili-manager-preview-disabled");
    if (element instanceof HTMLVideoElement) element.pause();
  });

  let reasonEl = card.cardEl.querySelector<HTMLElement>(`.${REASON_CLASS}`);
  if (!reasonEl) {
    reasonEl = document.createElement("div");
    reasonEl.className = REASON_CLASS;
    coverHost.append(reasonEl);
  }

  const visibleReason = reasons.join(" / ");
  if (recommendation) recommendationsByCard.set(card.cardEl, recommendation);
  else recommendationsByCard.delete(card.cardEl);
  card.cardEl.setAttribute(REASON_TEXT_ATTR, visibleReason);
  applyFavoriteCardText(card, recommendation);
  updateReasonOverlay(card.cardEl, reasonEl, visibleReason);
  suppressTitleTooltips(card.cardEl);
}

export function clearAllFilterStates(): void {
  document
    .querySelectorAll<HTMLElement>(`[${STATE_ATTR}], .bili-manager-filtered`)
    .forEach(clearFilterState);
  document
    .querySelectorAll<HTMLElement>(`.${UNHIGHLIGHTED_TITLE_CLASS}`)
    .forEach(element => element.classList.remove(UNHIGHLIGHTED_TITLE_CLASS));
  document
    .querySelectorAll<HTMLElement>(`.${GRAYSCALE_COVER_CLASS}`)
    .forEach(element => element.classList.remove(GRAYSCALE_COVER_CLASS));
}

export function clearFilterState(cardEl: HTMLElement): void {
  restoreFavoriteCardText(cardEl);
  recommendationsByCard.delete(cardEl);
  restoreTitleTooltips(cardEl);
  cardEl.removeAttribute(STATE_ATTR);
  cardEl.removeAttribute(GATE_ATTR);
  cardEl.removeAttribute(REASON_TEXT_ATTR);
  cardEl.classList.remove("bili-manager-filtered", PAGE_DARK_CLASS, PAGE_LIGHT_CLASS);
  cardEl.querySelector(`.${REASON_CLASS}`)?.remove();
  cardEl
    .querySelectorAll<HTMLElement>(`.${COVER_WRAP_CLASS}`)
    .forEach(element => element.classList.remove(COVER_WRAP_CLASS));
  cardEl
    .querySelectorAll<HTMLElement>(`.${COVER_CLASS}`)
    .forEach(element => element.classList.remove(COVER_CLASS));
  cardEl
    .querySelectorAll<HTMLElement>(`.${TITLE_CLASS}`)
    .forEach(element => element.classList.remove(TITLE_CLASS));
  cardEl
    .querySelectorAll<HTMLElement>(`.${UNHIGHLIGHTED_TITLE_CLASS}`)
    .forEach(element => element.classList.remove(UNHIGHLIGHTED_TITLE_CLASS));
  cardEl
    .querySelectorAll<HTMLElement>(`.${GRAYSCALE_COVER_CLASS}`)
    .forEach(element => element.classList.remove(GRAYSCALE_COVER_CLASS));
  cardEl
    .querySelectorAll<HTMLElement>(`.${META_CLASS}`)
    .forEach(element => element.classList.remove(META_CLASS));
  cardEl
    .querySelectorAll<HTMLElement>(".bili-manager-preview-disabled")
    .forEach(element => element.classList.remove("bili-manager-preview-disabled"));
}

export function applyGrayscaleState(card: SearchCard, enabled: boolean): void {
  card.titleEl?.classList.toggle(UNHIGHLIGHTED_TITLE_CLASS, enabled);
  card.thumbnailEl?.classList.toggle(GRAYSCALE_COVER_CLASS, enabled);
}

export function unbindFilterGateEvents(): void {
  if (!filterGateEventsBound) return;

  document.removeEventListener("click", stopLockedNavigation, true);
  document.removeEventListener("auxclick", stopLockedNavigation, true);
  document.removeEventListener("keydown", stopLockedKeyboardNavigation, true);
  document.removeEventListener("contextmenu", handleFilteredContextMenu, true);
  document.removeEventListener("pointerover", stopLockedHoverDetails, true);
  document.removeEventListener("pointerenter", stopLockedHoverDetails, true);
  document.removeEventListener("mouseover", stopLockedHoverDetails, true);
  document.removeEventListener("mouseenter", stopLockedHoverDetails, true);
  filterGateEventsBound = false;
}

function applyFavoriteCardText(card: SearchCard, recommendation: FavoriteVideo | null): void {
  if (!recommendation) {
    restoreFavoriteCardText(card.cardEl);
    return;
  }

  if (!originalRecommendationText.has(card.cardEl)) {
    originalRecommendationText.set(card.cardEl, {
      titleHtml: card.titleEl?.innerHTML ?? null,
      uploaderHtml: card.uploaderEl?.innerHTML ?? null,
    });
  }

  if (card.titleEl) {
    card.titleEl.textContent = recommendation.title;
    card.titleEl.classList.remove(TITLE_CLASS);
  }
  if (card.uploaderEl) {
    card.uploaderEl.textContent = recommendation.uploader || "";
    card.uploaderEl.classList.remove(META_CLASS);
  }

  card.metadataEls.forEach(element => {
    if (element !== card.uploaderEl) element.classList.add(RECOMMENDATION_META_HIDDEN_CLASS);
  });
}

function restoreFavoriteCardText(cardEl: HTMLElement): void {
  const original = originalRecommendationText.get(cardEl);
  if (!original) return;

  const titleEl = findSearchCardTitle(cardEl);
  const uploaderEl = findSearchCardUploader(cardEl);
  if (titleEl && original.titleHtml !== null) titleEl.innerHTML = original.titleHtml;
  if (uploaderEl && original.uploaderHtml !== null) uploaderEl.innerHTML = original.uploaderHtml;
  cardEl
    .querySelectorAll<HTMLElement>(`.${RECOMMENDATION_META_HIDDEN_CLASS}`)
    .forEach(element => element.classList.remove(RECOMMENDATION_META_HIDDEN_CLASS));
  originalRecommendationText.delete(cardEl);
}

function getCoverOverlayHost(card: SearchCard): HTMLElement {
  return (
    card.thumbnailEl?.closest<HTMLElement>(".bili-video-card__image") ??
    card.thumbnailEl?.parentElement ??
    card.cardEl
  );
}

function bindFilterGateEvents(): void {
  if (filterGateEventsBound) return;

  document.addEventListener("click", stopLockedNavigation, true);
  document.addEventListener("auxclick", stopLockedNavigation, true);
  document.addEventListener("keydown", stopLockedKeyboardNavigation, true);
  document.addEventListener("contextmenu", handleFilteredContextMenu, true);
  document.addEventListener("pointerover", stopLockedHoverDetails, true);
  document.addEventListener("pointerenter", stopLockedHoverDetails, true);
  document.addEventListener("mouseover", stopLockedHoverDetails, true);
  document.addEventListener("mouseenter", stopLockedHoverDetails, true);
  filterGateEventsBound = true;
}

function stopLockedNavigation(event: MouseEvent): void {
  const cardEl = getEventFilteredCard(event);
  if (!cardEl || getGateState(cardEl) === "unlocked") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function stopLockedKeyboardNavigation(event: KeyboardEvent): void {
  if (event.key !== "Enter" && event.key !== " ") return;

  const cardEl = getEventFilteredCard(event);
  if (!cardEl || getGateState(cardEl) === "unlocked") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function stopLockedHoverDetails(event: MouseEvent | PointerEvent): void {
  const cardEl = getEventFilteredCard(event);
  if (!cardEl || getGateState(cardEl) === "unlocked") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function handleFilteredContextMenu(event: MouseEvent): void {
  const cardEl = getEventFilteredCard(event);
  if (!cardEl) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

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
  if (target.closest(`[${UPLOADER_BLOCK_CONTROL_ATTR}]`)) return null;
  return target.closest<HTMLElement>(`.bili-manager-filtered[${STATE_ATTR}="filtered"]`);
}

function getGateState(cardEl: HTMLElement): FilterGateState {
  const state = cardEl.getAttribute(GATE_ATTR);
  if (state === "peek" || state === "unlocked") return state;
  return "locked";
}

function refreshReasonOverlay(cardEl: HTMLElement): void {
  const reasonEl = cardEl.querySelector<HTMLElement>(`.${REASON_CLASS}`);
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
      ? `来自收藏夹：${recommendation.title}；原结果过滤原因：${visibleReason}`
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

function suppressTitleTooltips(cardEl: HTMLElement): void {
  const titledElements = [
    ...(cardEl.hasAttribute("title") ? [cardEl] : []),
    ...cardEl.querySelectorAll<HTMLElement>("[title]"),
  ];

  titledElements.forEach(element => {
    const title = element.getAttribute("title");
    if (title === null) return;

    if (!element.hasAttribute(ORIGINAL_TITLE_ATTR))
      element.setAttribute(ORIGINAL_TITLE_ATTR, title);
    element.removeAttribute("title");
  });
}

function restoreTitleTooltips(cardEl: HTMLElement): void {
  const restoredElements = [
    ...(cardEl.hasAttribute(ORIGINAL_TITLE_ATTR) ? [cardEl] : []),
    ...cardEl.querySelectorAll<HTMLElement>(`[${ORIGINAL_TITLE_ATTR}]`),
  ];

  restoredElements.forEach(element => {
    const title = element.getAttribute(ORIGINAL_TITLE_ATTR);
    element.removeAttribute(ORIGINAL_TITLE_ATTR);
    if (title !== null) element.setAttribute("title", title);
  });
}

function applyPageThemeClass(cardEl: HTMLElement, pageTheme: BilibiliPageThemeDetection): void {
  if (pageTheme === "unknown") return;

  cardEl.classList.toggle(PAGE_DARK_CLASS, pageTheme === "dark");
  cardEl.classList.toggle(PAGE_LIGHT_CLASS, pageTheme === "light");
}
