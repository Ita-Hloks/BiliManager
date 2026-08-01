import type { FavoriteVideo } from "../../shared/favoriteFolder";
import type { BilibiliPageThemeDetection } from "../pageTheme";
import {
  clearFilterGate,
  FILTER_REASON_CLASS,
  getFilteredCards,
  markFilterGateActive,
  renderFilterGate,
} from "./filterGate";
import { findSearchCardTitle, findSearchCardUploader } from "./pageAdapter";
import type { SearchCard } from "./types";

const ORIGINAL_TITLE_ATTR = "data-bili-manager-original-title";
const RECOMMENDATION_META_HIDDEN_CLASS = "bili-manager-favorite-original-meta-hidden";
const TITLE_CLASS = "bili-manager-filtered-title";
const UNHIGHLIGHTED_TITLE_CLASS = "bili-manager-unhighlighted-title";
const GRAYSCALE_COVER_CLASS = "bili-manager-grayscale-cover";
const META_CLASS = "bili-manager-filtered-meta";
const COVER_WRAP_CLASS = "bili-manager-filtered-cover-wrap";
const COVER_CLASS = "bili-manager-filtered-cover";
const PAGE_DARK_CLASS = "bili-manager-page-dark";
const PAGE_LIGHT_CLASS = "bili-manager-page-light";

const originalRecommendationText = new WeakMap<
  HTMLElement,
  { titleHtml: string; uploaderHtml: string | null }
>();

export function markFiltered(
  card: SearchCard,
  reasons: string[],
  pageTheme: BilibiliPageThemeDetection,
  recommendation: FavoriteVideo | null,
): void {
  markFilterGateActive(card.cardEl);

  applyPageThemeClass(card.cardEl, pageTheme);
  card.cardEl.classList.add("bili-manager-filtered");
  card.titleEl.classList.add(TITLE_CLASS);
  card.titleEl.classList.remove(UNHIGHLIGHTED_TITLE_CLASS);
  card.thumbnailEl.classList.remove(GRAYSCALE_COVER_CLASS);
  card.metadataEls.forEach(element => element.classList.add(META_CLASS));
  const coverHost = getCoverOverlayHost(card);
  coverHost.classList.add(COVER_WRAP_CLASS);
  card.thumbnailEl.classList.add(COVER_CLASS);
  card.previewEls.forEach(element => {
    element.classList.add("bili-manager-preview-disabled");
    if (element instanceof HTMLVideoElement) element.pause();
  });

  let reasonEl = card.cardEl.querySelector<HTMLElement>(`.${FILTER_REASON_CLASS}`);
  if (!reasonEl) {
    reasonEl = document.createElement("div");
    reasonEl.className = FILTER_REASON_CLASS;
    coverHost.append(reasonEl);
  }

  const visibleReason = reasons.join(" / ");
  applyFavoriteCardText(card, recommendation);
  renderFilterGate(card.cardEl, reasonEl, visibleReason, recommendation);
  suppressTitleTooltips(card.cardEl);
}

export function clearAllFilterStates(): void {
  getFilteredCards().forEach(clearFilterState);
  document
    .querySelectorAll<HTMLElement>(`.${UNHIGHLIGHTED_TITLE_CLASS}`)
    .forEach(element => element.classList.remove(UNHIGHLIGHTED_TITLE_CLASS));
  document
    .querySelectorAll<HTMLElement>(`.${GRAYSCALE_COVER_CLASS}`)
    .forEach(element => element.classList.remove(GRAYSCALE_COVER_CLASS));
}

export function clearFilterState(cardEl: HTMLElement): void {
  restoreFavoriteCardText(cardEl);
  clearFilterGate(cardEl);
  restoreTitleTooltips(cardEl);
  cardEl.classList.remove("bili-manager-filtered", PAGE_DARK_CLASS, PAGE_LIGHT_CLASS);
  cardEl.querySelector(`.${FILTER_REASON_CLASS}`)?.remove();
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
  card.titleEl.classList.toggle(UNHIGHLIGHTED_TITLE_CLASS, enabled);
  card.thumbnailEl.classList.toggle(GRAYSCALE_COVER_CLASS, enabled);
}

function applyFavoriteCardText(card: SearchCard, recommendation: FavoriteVideo | null): void {
  if (!recommendation) {
    restoreFavoriteCardText(card.cardEl);
    return;
  }

  if (!originalRecommendationText.has(card.cardEl)) {
    originalRecommendationText.set(card.cardEl, {
      titleHtml: card.titleEl.innerHTML,
      uploaderHtml: card.uploaderEl?.innerHTML ?? null,
    });
  }

  card.titleEl.textContent = recommendation.title;
  card.titleEl.classList.remove(TITLE_CLASS);
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
  if (titleEl) titleEl.innerHTML = original.titleHtml;
  if (uploaderEl && original.uploaderHtml !== null) uploaderEl.innerHTML = original.uploaderHtml;
  cardEl
    .querySelectorAll<HTMLElement>(`.${RECOMMENDATION_META_HIDDEN_CLASS}`)
    .forEach(element => element.classList.remove(RECOMMENDATION_META_HIDDEN_CLASS));
  originalRecommendationText.delete(cardEl);
}

function getCoverOverlayHost(card: SearchCard): HTMLElement {
  return (
    card.thumbnailEl.closest<HTMLElement>(".bili-video-card__image") ??
    card.thumbnailEl.parentElement ??
    card.cardEl
  );
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
