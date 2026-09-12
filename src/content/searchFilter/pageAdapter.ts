import type { SearchCard } from "./types";

const SUPPORTED_SEARCH_PATHS = new Set(["/all", "/video"]);

const TEXT = {
  playLabels: ["播放量", "播放", "观看"],
  danmakuLabels: ["弹幕"],
  tenThousand: "万",
  hundredMillion: "亿",
};

const selectors = {
  cards: [
    ".video-list .bili-video-card",
    ".video-list .video-item",
    ".search-page .bili-video-card",
    ".search-page .video-item",
    ".bili-video-card",
  ],
  uploaderVideoRecommendation: [".b-user-video-card", ".user-video-info"],
  cardRoots: [".bili-video-card", ".video-item", ".search-card", ".video-list-item"],
  layoutRoots: [".video-item", ".search-card", ".video-list-item"],
  contentLinks: [
    "a[href*='/video/BV']",
    "a[href*='bilibili.com/video/']",
    "a[href*='/cheese/play/']",
    "a[href*='bilibili.com/cheese/play/']",
  ],
  courseBadge: ".bili-video-card__info--cheese",
  title: [".bili-video-card__info--tit", ".bili-video-card__info--title", ".title", "a[title]"],
  uploader: [
    ".bili-video-card__info--author",
    ".bili-video-card__info--owner",
    ".up-name",
    ".username",
    "a[href*='space.bilibili.com']",
  ],
  date: [".bili-video-card__info--date", ".bili-video-card__info--time", ".date", ".time"],
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

export function collectSearchCards(): SearchCard[] {
  const elements = new Set<HTMLElement>();
  const searchKeyword = getSearchKeyword();

  for (const selector of selectors.cards) {
    document.querySelectorAll<HTMLElement>(selector).forEach(element => {
      if (hasSearchCardLink(element)) elements.add(element);
    });
  }

  for (const selector of selectors.contentLinks) {
    document.querySelectorAll<HTMLElement>(selector).forEach(link => {
      const cardRoot = findCardRoot(link);
      if (cardRoot) elements.add(cardRoot);
    });
  }

  return [...elements]
    .map(cardEl => toSearchCard(cardEl, searchKeyword))
    .filter((card): card is SearchCard => card !== null);
}

export function findSearchCardTitle(cardEl: HTMLElement): HTMLElement | null {
  return queryFirst(cardEl, selectors.title);
}

export function findSearchCardUploader(cardEl: HTMLElement): HTMLElement | null {
  return queryFirst(cardEl, selectors.uploader);
}

export function findSearchCardDate(cardEl: HTMLElement): HTMLElement | null {
  return queryFirst(cardEl, selectors.date);
}

export function hasTitleHighlight(titleEl: HTMLElement): boolean {
  for (const selector of selectors.titleHighlight) {
    const highlight = titleEl.querySelector<HTMLElement>(selector);
    if (highlight && isPinkHighlight(highlight)) return true;
  }

  return false;
}

export function getBvid(value: string): string {
  return value.match(/\/video\/(BV[0-9A-Z]+)/i)?.[1] ?? "";
}

function findCardRoot(link: HTMLElement): HTMLElement | null {
  const closest = link.closest<HTMLElement>(selectors.cardRoots.join(", "));
  if (closest) return closest;

  return link.parentElement?.parentElement?.parentElement ?? link.parentElement;
}

function toSearchCard(cardEl: HTMLElement, searchKeyword: string): SearchCard | null {
  const titleEl = findSearchCardTitle(cardEl);
  const thumbnailEl = queryFirst(cardEl, selectors.thumbnail);
  const contentLink = queryFirst(cardEl, selectors.contentLinks);
  if (!titleEl || !thumbnailEl || !contentLink) return null;

  const title = normalizeText(titleEl.textContent || titleEl.getAttribute("title") || "");
  if (!title || cardEl.closest("footer, .footer, .bili-footer")) return null;

  const uploaderEl = findSearchCardUploader(cardEl);
  const dateEl = findSearchCardDate(cardEl);
  const uploaderLink =
    uploaderEl?.closest<HTMLAnchorElement>("a[href*='space.bilibili.com']") ??
    cardEl.querySelector<HTMLAnchorElement>("a[href*='space.bilibili.com']");
  const metricsText = collectMetricText(cardEl);
  const fallbackCounts = parseOrderedStatCounts(cardEl);
  const videoUrl = contentLink.getAttribute("href") ?? "";
  const uploader = normalizeText(uploaderEl?.textContent ?? "");

  return {
    cardEl,
    layoutEl: findLayoutElement(cardEl),
    titleEl,
    uploaderEl,
    title,
    videoUrl,
    uploader,
    uploaderMid: getUploaderMid(uploaderLink?.getAttribute("href") ?? ""),
    uploaderMatchesSearchKeyword: isExactSearchKeywordMatch(uploader, searchKeyword),
    isUploaderVideoRecommendation: isUploaderVideoRecommendation(cardEl),
    isCourse: cardEl.querySelector(selectors.courseBadge) !== null,
    dateEl,
    viewCount: parseMetric(metricsText, TEXT.playLabels) ?? fallbackCounts[0] ?? null,
    danmakuCount: parseMetric(metricsText, TEXT.danmakuLabels) ?? fallbackCounts[1] ?? null,
    thumbnailEl,
    metadataEls: collectMetadataElements(cardEl, titleEl),
    previewEls: selectors.preview.flatMap(selector => [
      ...cardEl.querySelectorAll<HTMLElement>(selector),
    ]),
  };
}

function hasSearchCardLink(cardEl: HTMLElement): boolean {
  return queryFirst(cardEl, selectors.contentLinks) !== null;
}

function findLayoutElement(cardEl: HTMLElement): HTMLElement {
  let current = cardEl.parentElement;
  while (current) {
    const layoutElement = current;
    if (selectors.layoutRoots.some(selector => layoutElement.matches(selector))) {
      return layoutElement;
    }
    current = current.parentElement;
  }

  return cardEl;
}

function getSearchKeyword(): string {
  return new URL(location.href).searchParams.get("keyword") ?? "";
}

function isExactSearchKeywordMatch(value: string, searchKeyword: string): boolean {
  const normalizedKeyword = normalizeComparableText(searchKeyword);
  return normalizedKeyword !== "" && normalizeComparableText(value) === normalizedKeyword;
}

function isUploaderVideoRecommendation(cardEl: HTMLElement): boolean {
  return selectors.uploaderVideoRecommendation.some(selector => cardEl.closest(selector) !== null);
}

function collectMetadataElements(cardEl: HTMLElement, titleEl: HTMLElement): HTMLElement[] {
  const elements = new Set<HTMLElement>();

  for (const selector of selectors.metadata) {
    cardEl.querySelectorAll<HTMLElement>(selector).forEach(element => {
      if (element === titleEl || titleEl.contains(element)) return;
      elements.add(element);
    });
  }

  return [...elements];
}

function getUploaderMid(value: string): string {
  return value.match(/space\.bilibili\.com\/(\d+)/i)?.[1] ?? "";
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

function normalizeComparableText(text: string): string {
  return normalizeText(text.normalize("NFKC")).toLowerCase();
}
