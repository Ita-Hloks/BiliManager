import type { SearchCard } from "./types";

const SUPPORTED_SEARCH_PATHS = new Set(["/all", "/video"]);

const TEXT = {
  playLabels: ["播放", "观看"],
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

export function collectSearchCards(): SearchCard[] {
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

export function findSearchCardTitle(cardEl: HTMLElement): HTMLElement | null {
  return queryFirst(cardEl, selectors.title);
}

export function findSearchCardUploader(cardEl: HTMLElement): HTMLElement | null {
  return queryFirst(cardEl, selectors.uploader);
}

export function hasTitleHighlight(titleEl: HTMLElement | null): boolean {
  if (!titleEl) return false;

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

function toSearchCard(cardEl: HTMLElement): SearchCard {
  const titleEl = findSearchCardTitle(cardEl);
  const thumbnailEl = queryFirst(cardEl, selectors.thumbnail);
  const uploaderEl = findSearchCardUploader(cardEl);
  const uploaderLink =
    uploaderEl?.closest<HTMLAnchorElement>("a[href*='space.bilibili.com']") ??
    cardEl.querySelector<HTMLAnchorElement>("a[href*='space.bilibili.com']");
  const videoLink = queryFirst(cardEl, selectors.videoLinks);
  const metricsText = collectMetricText(cardEl);
  const fallbackCounts = parseOrderedStatCounts(cardEl);

  return {
    cardEl,
    titleEl,
    uploaderEl,
    title: normalizeText(titleEl?.textContent || titleEl?.getAttribute("title") || ""),
    videoUrl: videoLink?.getAttribute("href") ?? "",
    uploader: normalizeText(uploaderEl?.textContent ?? ""),
    uploaderMid: getUploaderMid(uploaderLink?.getAttribute("href") ?? ""),
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
