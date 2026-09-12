import type { FavoriteVideo } from "../../shared/favoriteFolder";
import { formatFavoritePublishedDate } from "../favoriteRecommendation";
import type { BilibiliPageThemeDetection } from "../pageTheme";
import {
  clearFilterGate,
  FILTER_REASON_CLASS,
  getFilteredCards,
  markFilterGateActive,
  renderFilterGate,
} from "./filterGate";
import { findSearchCardDate, findSearchCardTitle, findSearchCardUploader } from "./pageAdapter";
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

const GLOBAL_FILTER_STATE_CLASSES = [UNHIGHLIGHTED_TITLE_CLASS, GRAYSCALE_COVER_CLASS] as const;
const CARD_FILTER_STATE_CLASSES = [
  COVER_WRAP_CLASS,
  COVER_CLASS,
  TITLE_CLASS,
  UNHIGHLIGHTED_TITLE_CLASS,
  GRAYSCALE_COVER_CLASS,
  META_CLASS,
  "bili-manager-preview-disabled",
] as const;

const originalRecommendationText = new WeakMap<
  HTMLElement,
  {
    titleHtml: string;
    uploaderHtml: string | null;
    uploaderLinkHref: string | null;
    dateHtml: string | null;
  }
>();

type StrictRemoval = {
  card: SearchCard;
  removedEl: HTMLElement;
  placeholder: Comment;
};

const strictlyRemovedCards = new Map<HTMLElement, StrictRemoval>();
let strictRemovalPageKey: string | null = null;

export function prepareStrictInterceptionPage(pageKey: string): void {
  if (strictRemovalPageKey !== null && strictRemovalPageKey !== pageKey) {
    restoreStrictlyRemovedCards();
  }
  strictRemovalPageKey = pageKey;
}

export function getStrictlyRemovedCards(): SearchCard[] {
  discardDisconnectedStrictRemovals();
  return [...strictlyRemovedCards.values()].map(record => record.card);
}

export function removeStrictlyFilteredCard(card: SearchCard): void {
  if (strictlyRemovedCards.has(card.cardEl) || !card.cardEl.isConnected) return;

  clearFilterState(card.cardEl);
  const placeholder = document.createComment("bili-manager-strict-interception");
  card.layoutEl.replaceWith(placeholder);
  strictlyRemovedCards.set(card.cardEl, { card, placeholder, removedEl: card.layoutEl });
}

export function restoreStrictlyRemovedCard(cardEl: HTMLElement): void {
  const removal = strictlyRemovedCards.get(cardEl);
  if (!removal) return;

  clearFilterState(cardEl);
  if (removal.placeholder.isConnected) {
    if (removal.removedEl.isConnected) removal.placeholder.remove();
    else removal.placeholder.replaceWith(removal.removedEl);
  }
  strictlyRemovedCards.delete(cardEl);
}

export function restoreStrictlyRemovedCards(): void {
  [...strictlyRemovedCards.keys()].forEach(restoreStrictlyRemovedCard);
}

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
  restoreStrictlyRemovedCards();
  getFilteredCards().forEach(clearFilterState);
  removeClassesFromDescendants(document, GLOBAL_FILTER_STATE_CLASSES);
}

export function clearFilterState(cardEl: HTMLElement): void {
  restoreFavoriteCardText(cardEl);
  clearFilterGate(cardEl);
  restoreTitleTooltips(cardEl);
  cardEl.classList.remove("bili-manager-filtered", PAGE_DARK_CLASS, PAGE_LIGHT_CLASS);
  cardEl.querySelector(`.${FILTER_REASON_CLASS}`)?.remove();
  removeClassesFromDescendants(cardEl, CARD_FILTER_STATE_CLASSES);
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
    const uploaderLink = getUploaderLink(card.uploaderEl);
    originalRecommendationText.set(card.cardEl, {
      titleHtml: card.titleEl.innerHTML,
      uploaderHtml: card.uploaderEl?.innerHTML ?? null,
      uploaderLinkHref: uploaderLink?.getAttribute("href") ?? null,
      dateHtml: card.dateEl?.innerHTML ?? null,
    });
  }

  const publishedDate = formatFavoritePublishedDate(recommendation.publishedAt);
  card.titleEl.textContent = recommendation.title;
  card.titleEl.classList.remove(TITLE_CLASS);
  if (card.uploaderEl) card.uploaderEl.textContent = recommendation.uploader;
  const uploaderLink = getUploaderLink(card.uploaderEl);
  if (recommendation.uploaderMid) {
    uploaderLink?.setAttribute("href", `https://space.bilibili.com/${recommendation.uploaderMid}`);
  } else {
    uploaderLink?.removeAttribute("href");
  }
  if (card.dateEl) card.dateEl.textContent = publishedDate ? ` · ${publishedDate}` : "";

  const visibleMetadata = [card.uploaderEl, publishedDate ? card.dateEl : null].filter(
    (root): root is HTMLElement => root !== null,
  );
  card.metadataEls.forEach(element => {
    const visible = visibleMetadata.some(
      root => root === element || root.contains(element) || element.contains(root),
    );
    element.classList.toggle(RECOMMENDATION_META_HIDDEN_CLASS, !visible);
    element.classList.toggle(META_CLASS, !visible);
  });
}

function restoreFavoriteCardText(cardEl: HTMLElement): void {
  const original = originalRecommendationText.get(cardEl);
  if (!original) return;

  const titleEl = findSearchCardTitle(cardEl);
  const uploaderEl = findSearchCardUploader(cardEl);
  const uploaderLink = getUploaderLink(uploaderEl);
  const dateEl = findSearchCardDate(cardEl);
  if (titleEl) titleEl.innerHTML = original.titleHtml;
  if (uploaderEl && original.uploaderHtml !== null) uploaderEl.innerHTML = original.uploaderHtml;
  if (uploaderLink && original.uploaderLinkHref !== null) {
    uploaderLink.setAttribute("href", original.uploaderLinkHref);
  }
  if (dateEl && original.dateHtml !== null) dateEl.innerHTML = original.dateHtml;
  removeClassesFromDescendants(cardEl, [RECOMMENDATION_META_HIDDEN_CLASS]);
  originalRecommendationText.delete(cardEl);
}

function getUploaderLink(uploaderEl: HTMLElement | null): HTMLAnchorElement | null {
  return uploaderEl?.closest<HTMLAnchorElement>("a") ?? null;
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

function removeClassesFromDescendants(root: ParentNode, classNames: readonly string[]): void {
  classNames.forEach(className => {
    root.querySelectorAll<HTMLElement>(`.${className}`).forEach(element => {
      element.classList.remove(className);
    });
  });
}

function discardDisconnectedStrictRemovals(): void {
  [...strictlyRemovedCards.values()].forEach(removal => {
    if (removal.placeholder.isConnected) return;

    clearFilterState(removal.card.cardEl);
    strictlyRemovedCards.delete(removal.card.cardEl);
  });
}

function applyPageThemeClass(cardEl: HTMLElement, pageTheme: BilibiliPageThemeDetection): void {
  if (pageTheme === "unknown") return;

  cardEl.classList.toggle(PAGE_DARK_CLASS, pageTheme === "dark");
  cardEl.classList.toggle(PAGE_LIGHT_CLASS, pageTheme === "light");
}
