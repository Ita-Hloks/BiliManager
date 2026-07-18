import type { FavoriteVideo } from "../../shared/favoriteFolder";
import type { RuntimeSnapshot, SearchFilterSettings, SearchFilterStats } from "../../shared/types";
import type { FavoriteRecommendationPool } from "../favoriteRecommendation";
import {
  getFavoriteVideoUrl,
  normalizeFavoriteCoverUrl,
  pickFavoriteRecommendation,
} from "../favoriteRecommendation";
import type { BilibiliPageThemeDetection } from "../pageTheme";
import { detectBilibiliPageTheme } from "../pageTheme";

type SearchCard = {
  cardEl: HTMLElement;
  titleEl: HTMLElement | null;
  uploaderEl: HTMLElement | null;
  title: string;
  videoUrl: string;
  uploader: string;
  viewCount: number | null;
  danmakuCount: number | null;
  thumbnailEl: HTMLElement | null;
  metadataEls: HTMLElement[];
  previewEls: HTMLElement[];
};

type FilterResult = {
  reasons: string[];
  regexErrors: string[];
  lowInteractionRate: number | null;
};

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
const SUPPORTED_SEARCH_PATHS = new Set(["/all", "/video"]);
type FilterGateState = "locked" | "peek" | "unlocked";
const recommendationsByCard = new WeakMap<HTMLElement, FavoriteVideo>();
const originalRecommendationText = new WeakMap<
  HTMLElement,
  { titleHtml: string | null; uploaderHtml: string | null }
>();
const EMPTY_RECOMMENDATION_POOL: FavoriteRecommendationPool = {
  videos: [],
  recommendationRate: 0,
};
const TEXT = {
  titleRuleLabel: "过滤词",
  uploaderRuleLabel: "UP 主过滤词",
  titleMatched: "过滤词命中",
  uploaderMatched: "UP 主命中",
  missingSearchTerm: "未命中搜索词",
  lowInteraction: "互动率过低",
  invalidRegex: "正则无效",
  unknownError: "未知错误",
  playLabels: ["播放", "观看"],
  danmakuLabels: ["弹幕"],
  tenThousand: "万",
  hundredMillion: "亿",
  gateGuide: "再次右键显示封面，之后可点击进入",
};

const selectors = {
  cards: [
    ".video-list .bili-video-card",
    ".video-list .video-item",
    ".search-page .bili-video-card",
    ".search-page .video-item",
    ".bili-video-card",
  ],
  cardRoots: [
    ".bili-video-card",
    ".video-item",
    ".search-card",
    ".video-list-item",
    "[class*='video-card']",
  ],
  videoLinks: ["a[href*='/video/BV']", "a[href*='bilibili.com/video/']"],
  title: [".bili-video-card__info--tit", ".bili-video-card__info--title", ".title", "a[title]"],
  uploader: [
    ".bili-video-card__info--author",
    ".bili-video-card__info--owner",
    ".up-name",
    ".username",
    "a[href*='space.bilibili.com']",
  ],
  metrics: [".bili-video-card__stats", ".so-icon", ".tags", ".des"],
  metadata: [
    ".bili-video-card__info--author",
    ".bili-video-card__info--owner",
    ".bili-video-card__stats",
    ".bili-video-card__stats--item",
    ".bili-video-card__info--date",
    ".bili-video-card__info--time",
    ".up-name",
    ".username",
    ".so-icon",
    ".tags",
    ".des",
    ".date",
    ".time",
  ],
  thumbnail: [".bili-video-card__cover", ".bili-video-card__cover img", ".img", ".cover", "img"],
  preview: [
    "video",
    ".bili-video-card__cover--mask",
    ".bili-video-card__cover--hover",
    ".v-img__mask",
    ".cover-preview",
  ],
  titleHighlight: [
    ".keyword",
    ".highlight",
    ".search-keyword",
    ".bili-video-card__info--tit em",
    ".bili-video-card__info--title em",
    "em",
  ],
};

export function isSearchPage(url = location.href): boolean {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/$/, "");
  return parsed.hostname === "search.bilibili.com" && SUPPORTED_SEARCH_PATHS.has(pathname);
}

export function getSearchSnapshot(stats: SearchFilterStats): RuntimeSnapshot {
  return {
    url: location.href,
    title: document.title,
    isBilibili: location.hostname.includes("bilibili.com"),
    isSearchPage: isSearchPage(),
    detectedAt: stats.updatedAt,
  };
}

export function applySearchFilter(
  settings: SearchFilterSettings,
  recommendationPool: FavoriteRecommendationPool = EMPTY_RECOMMENDATION_POOL,
): SearchFilterStats {
  if (!isSearchPage()) {
    clearAllFilterStates();
    return createStats(false, settings.enabled, 0, 0, []);
  }

  const cards = collectSearchCards();
  const regexErrors = new Set<string>();
  const pageTheme = detectBilibiliPageTheme();
  let filtered = 0;

  for (const card of cards) {
    const titleHighlighted = hasTitleHighlight(card.titleEl);
    const result = evaluateCard(card, settings, titleHighlighted);
    for (const error of result.regexErrors) regexErrors.add(error);

    if (settings.enabled && result.reasons.length > 0) {
      filtered += 1;
      const recommendation = pickFavoriteRecommendation(
        recommendationPool,
        `${location.pathname}${location.search}:${card.videoUrl || card.title}`,
        getBvid(card.videoUrl),
      );
      markFiltered(card, result.reasons, pageTheme, recommendation);
    } else {
      clearFilterState(card.cardEl);
      applyGrayscaleState(
        card,
        settings.enabled &&
          ((settings.grayscaleMissingTitleHighlight &&
            !settings.filterMissingTitleHighlight &&
            !titleHighlighted) ||
            (settings.grayscaleLowDanmakuViewRate &&
              !settings.filterLowDanmakuViewRate &&
              result.lowInteractionRate !== null)),
      );
    }
  }

  return createStats(true, settings.enabled, cards.length, filtered, [...regexErrors]);
}

function createStats(
  available: boolean,
  enabled: boolean,
  total: number,
  filtered: number,
  regexErrors: string[],
): SearchFilterStats {
  return {
    available,
    enabled,
    total,
    filtered,
    regexErrors,
    updatedAt: new Date().toISOString(),
  };
}

function collectSearchCards(): SearchCard[] {
  const elements = new Set<HTMLElement>();

  for (const selector of selectors.cards) {
    document.querySelectorAll<HTMLElement>(selector).forEach(element => {
      if (element.querySelector("a[href*='/video/']")) elements.add(element);
    });
  }

  for (const selector of selectors.videoLinks) {
    document.querySelectorAll<HTMLElement>(selector).forEach(link => {
      const cardRoot = findCardRoot(link);
      if (cardRoot) elements.add(cardRoot);
    });
  }

  return [...elements].map(toSearchCard).filter(isValidSearchCard);
}

function findCardRoot(link: HTMLElement): HTMLElement | null {
  const closest = link.closest<HTMLElement>(selectors.cardRoots.join(", "));
  if (closest) return closest;

  return link.parentElement?.parentElement?.parentElement ?? link.parentElement;
}

function toSearchCard(cardEl: HTMLElement): SearchCard {
  const titleEl = queryFirst(cardEl, selectors.title);
  const thumbnailEl = queryFirst(cardEl, selectors.thumbnail);
  const uploaderEl = queryFirst(cardEl, selectors.uploader);
  const videoLink = queryFirst(cardEl, selectors.videoLinks);
  const metricsText = collectMetricText(cardEl);
  const fallbackCounts = parseOrderedStatCounts(cardEl);

  return {
    cardEl,
    titleEl,
    uploaderEl,
    title: normalizeText(titleEl?.textContent || titleEl?.getAttribute("title") || ""),
    videoUrl: videoLink?.getAttribute("href") ?? "",
    uploader: normalizeText(queryFirst(cardEl, selectors.uploader)?.textContent ?? ""),
    viewCount: parseMetric(metricsText, TEXT.playLabels) ?? fallbackCounts[0] ?? null,
    danmakuCount: parseMetric(metricsText, TEXT.danmakuLabels) ?? fallbackCounts[1] ?? null,
    thumbnailEl,
    metadataEls: collectMetadataElements(cardEl, titleEl),
    previewEls: selectors.preview.flatMap(selector => [
      ...cardEl.querySelectorAll<HTMLElement>(selector),
    ]),
  };
}

function isValidSearchCard(card: SearchCard): boolean {
  if (!card.titleEl || !card.thumbnailEl || !card.title) return false;
  if (card.cardEl.closest("footer, .footer, .bili-footer")) return false;
  return !!card.cardEl.querySelector(selectors.videoLinks.join(", "));
}

function collectMetadataElements(cardEl: HTMLElement, titleEl: HTMLElement | null): HTMLElement[] {
  const elements = new Set<HTMLElement>();

  for (const selector of selectors.metadata) {
    cardEl.querySelectorAll<HTMLElement>(selector).forEach(element => {
      if (element === titleEl || titleEl?.contains(element)) return;
      elements.add(element);
    });
  }

  return [...elements];
}

function evaluateCard(
  card: SearchCard,
  settings: SearchFilterSettings,
  titleHighlighted: boolean,
): FilterResult {
  const reasons: string[] = [];
  const regexErrors: string[] = [];

  const titlePattern = compilePattern(settings.titlePattern, TEXT.titleRuleLabel);
  if (titlePattern.error) regexErrors.push(titlePattern.error);
  if (titlePattern.regex?.test(card.title))
    reasons.push(`${TEXT.titleMatched}：${settings.titlePattern}`);

  const uploaderPattern = compilePattern(settings.uploaderPattern, TEXT.uploaderRuleLabel);
  if (uploaderPattern.error) regexErrors.push(uploaderPattern.error);
  if (uploaderPattern.regex?.test(card.uploader))
    reasons.push(`${TEXT.uploaderMatched}：${settings.uploaderPattern}`);

  if (settings.filterMissingTitleHighlight && !titleHighlighted) {
    reasons.push(TEXT.missingSearchTerm);
  }

  let lowInteractionRate: number | null = null;
  if (
    typeof card.viewCount === "number" &&
    typeof card.danmakuCount === "number" &&
    card.viewCount > 0 &&
    card.danmakuCount > 0
  ) {
    const rate = card.danmakuCount / card.viewCount;
    if (rate < settings.minDanmakuViewRate) {
      lowInteractionRate = rate;
      if (settings.filterLowDanmakuViewRate) {
        reasons.push(`${TEXT.lowInteraction}：${formatRate(rate)}`);
      }
    }
  }

  return { reasons, regexErrors, lowInteractionRate };
}

function markFiltered(
  card: SearchCard,
  reasons: string[],
  pageTheme: BilibiliPageThemeDetection,
  recommendation: FavoriteVideo | null,
) {
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

function clearAllFilterStates() {
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

function clearFilterState(cardEl: HTMLElement) {
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

  const titleEl = queryFirst(cardEl, selectors.title);
  const uploaderEl = queryFirst(cardEl, selectors.uploader);
  if (titleEl && original.titleHtml !== null) titleEl.innerHTML = original.titleHtml;
  if (uploaderEl && original.uploaderHtml !== null) uploaderEl.innerHTML = original.uploaderHtml;
  cardEl
    .querySelectorAll<HTMLElement>(`.${RECOMMENDATION_META_HIDDEN_CLASS}`)
    .forEach(element => element.classList.remove(RECOMMENDATION_META_HIDDEN_CLASS));
  originalRecommendationText.delete(cardEl);
}

function applyGrayscaleState(card: SearchCard, enabled: boolean): void {
  card.titleEl?.classList.toggle(UNHIGHLIGHTED_TITLE_CLASS, enabled);
  card.thumbnailEl?.classList.toggle(GRAYSCALE_COVER_CLASS, enabled);
}

function getCoverOverlayHost(card: SearchCard): HTMLElement {
  return (
    card.thumbnailEl?.closest<HTMLElement>(".bili-video-card__image") ??
    card.thumbnailEl?.parentElement ??
    card.cardEl
  );
}

let filterGateEventsBound = false;

function bindFilterGateEvents() {
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

function stopLockedNavigation(event: MouseEvent) {
  const cardEl = getEventFilteredCard(event);
  if (!cardEl || getGateState(cardEl) === "unlocked") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function stopLockedKeyboardNavigation(event: KeyboardEvent) {
  if (event.key !== "Enter" && event.key !== " ") return;

  const cardEl = getEventFilteredCard(event);
  if (!cardEl || getGateState(cardEl) === "unlocked") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function stopLockedHoverDetails(event: MouseEvent | PointerEvent) {
  const cardEl = getEventFilteredCard(event);
  if (!cardEl || getGateState(cardEl) === "unlocked") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function handleFilteredContextMenu(event: MouseEvent) {
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
  return target.closest<HTMLElement>(`.bili-manager-filtered[${STATE_ATTR}="filtered"]`);
}

function getGateState(cardEl: HTMLElement): FilterGateState {
  const state = cardEl.getAttribute(GATE_ATTR);
  if (state === "peek" || state === "unlocked") return state;
  return "locked";
}

function refreshReasonOverlay(cardEl: HTMLElement) {
  const reasonEl = cardEl.querySelector<HTMLElement>(`.${REASON_CLASS}`);
  if (!reasonEl) return;

  updateReasonOverlay(cardEl, reasonEl, cardEl.getAttribute(REASON_TEXT_ATTR) ?? "");
}

function updateReasonOverlay(cardEl: HTMLElement, reasonEl: HTMLElement, visibleReason: string) {
  const gateState = getGateState(cardEl);
  const text = gateState === "peek" ? TEXT.gateGuide : visibleReason;
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

function getBvid(value: string): string {
  return value.match(/\/video\/(BV[0-9A-Z]+)/i)?.[1] ?? "";
}

function suppressTitleTooltips(cardEl: HTMLElement) {
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

function restoreTitleTooltips(cardEl: HTMLElement) {
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

function applyPageThemeClass(cardEl: HTMLElement, pageTheme: BilibiliPageThemeDetection) {
  if (pageTheme === "unknown") return;

  cardEl.classList.toggle(PAGE_DARK_CLASS, pageTheme === "dark");
  cardEl.classList.toggle(PAGE_LIGHT_CLASS, pageTheme === "light");
}

function hasTitleHighlight(titleEl: HTMLElement | null): boolean {
  if (!titleEl) return false;

  for (const selector of selectors.titleHighlight) {
    const highlight = titleEl.querySelector<HTMLElement>(selector);
    if (highlight && isPinkHighlight(highlight)) return true;
  }

  return false;
}

function isPinkHighlight(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  const color = style.color.toLowerCase();
  const tagName = element.tagName.toLowerCase();

  return (
    color.includes("pink") ||
    color.includes("251, 114, 153") ||
    color.includes("255, 102") ||
    color.includes("#fb7299") ||
    tagName === "em"
  );
}

function queryFirst(root: ParentNode, candidates: string[]): HTMLElement | null {
  for (const selector of candidates) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) return element;
  }

  return null;
}

function collectMetricText(cardEl: HTMLElement): string {
  const values = new Set<string>();
  for (const selector of selectors.metrics) {
    cardEl.querySelectorAll<HTMLElement>(selector).forEach(element => {
      [
        element.textContent,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-title"),
      ].forEach(value => {
        const normalized = normalizeText(value ?? "");
        if (normalized) values.add(normalized);
      });
    });
  }
  return [...values].join(" ");
}

function compilePattern(
  pattern: string,
  label: string,
): { regex: RegExp | null; error: string | null } {
  const trimmed = pattern.trim();
  if (!trimmed) return { regex: null, error: null };

  try {
    return { regex: new RegExp(trimmed, "i"), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : TEXT.unknownError;
    return { regex: null, error: `${label}${TEXT.invalidRegex}：${message}` };
  }
}

function parseMetric(text: string, labels: string[]): number | null {
  const normalized = normalizeText(text);

  for (const label of labels) {
    const suffixMatch = normalized.match(
      new RegExp(`([\\d.]+\\s*(?:${TEXT.tenThousand}|${TEXT.hundredMillion})?)\\s*${label}`),
    );
    if (suffixMatch?.[1]) return parseChineseNumber(suffixMatch[1]);

    const prefixMatch = normalized.match(
      new RegExp(
        `${label}\\s*[:：]?\\s*([\\d.]+\\s*(?:${TEXT.tenThousand}|${TEXT.hundredMillion})?)`,
      ),
    );
    if (prefixMatch?.[1]) return parseChineseNumber(prefixMatch[1]);
  }

  return null;
}

function parseOrderedStatCounts(cardEl: HTMLElement): number[] {
  const currentStatItems = [
    ...cardEl.querySelectorAll<HTMLElement>(".bili-video-card__stats--item"),
  ];
  const statItems =
    currentStatItems.length >= 2
      ? currentStatItems
      : [...cardEl.querySelectorAll<HTMLElement>(".bili-video-card__stats span, .so-icon")];

  return statItems
    .map(element => parseChineseNumber(normalizeText(element.textContent ?? "")))
    .filter((value): value is number => typeof value === "number");
}

function parseChineseNumber(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(/[^\d.万亿-]/g, "");
  if (!normalized || normalized === "--") return null;

  const number = Number.parseFloat(normalized);
  if (Number.isNaN(number)) return null;
  if (normalized.endsWith(TEXT.hundredMillion)) return number * 100000000;
  if (normalized.endsWith(TEXT.tenThousand)) return number * 10000;
  return number;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}
