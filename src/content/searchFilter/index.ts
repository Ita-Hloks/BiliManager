import type { BlockedTag } from "../../shared/tagBlocklist";
import { findBlockedTag } from "../../shared/tagBlocklist";
import type { SearchTagIndex } from "../../shared/searchTags";
import type { BlockedUploader } from "../../shared/uploaderBlocklist";
import { findBlockedUploader } from "../../shared/uploaderBlocklist";
import type { RuntimeSnapshot, SearchFilterSettings, SearchFilterStats } from "../../shared/types";
import { clearBlockMenuControls, syncBlockMenuControl } from "../blockMenu";
import type { FavoriteRecommendationPool } from "../favoriteRecommendation";
import { pickFavoriteRecommendation } from "../favoriteRecommendation";
import { detectBilibiliPageTheme } from "../pageTheme";
import {
  applyGrayscaleState,
  clearAllFilterStates,
  clearFilterState,
  markFiltered,
} from "./cardPresenter";
import { unbindFilterGateEvents } from "./filterGate";
import { collectSearchCards, getBvid, hasTitleHighlight, isSearchPage } from "./pageAdapter";
import { createSearchCardEvaluator } from "./ruleEngine";

export { isSearchPage } from "./pageAdapter";

const EMPTY_RECOMMENDATION_POOL: FavoriteRecommendationPool = {
  videos: [],
  recommendationRate: 0,
};

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
  uploaderBlocklist: BlockedUploader[] = [],
  uploaderBlockingEnabled = false,
  tagBlocklist: BlockedTag[] = [],
  tagBlockingEnabled = false,
  tagsByBvid: SearchTagIndex = {},
  tagIndexReady = true,
): SearchFilterStats {
  if (!isSearchPage()) {
    clearBlockMenuControls();
    clearAllFilterStates();
    return createStats(false, settings.enabled, 0, 0, []);
  }

  const cards = collectSearchCards(tagsByBvid);
  if (cards.length === 0) return createStats(true, settings.enabled, 0, 0, []);

  const evaluator = createSearchCardEvaluator(settings);
  const pageTheme = detectBilibiliPageTheme();
  let filtered = 0;

  for (const card of cards) {
    const searchTermMatched =
      card.isUploaderVideoRecommendation ||
      card.uploaderMatchesSearchKeyword ||
      hasTitleHighlight(card.titleEl);
    const result = evaluator.evaluate(card, searchTermMatched);
    const blockedUploader = findBlockedUploader(uploaderBlocklist, {
      mid: card.uploaderMid,
      name: card.uploader,
    });
    const blockedTag = tagIndexReady ? findBlockedTag(tagBlocklist, card.tags) : undefined;
    const availableTags =
      tagIndexReady && tagBlockingEnabled
        ? card.tags.filter(tag => !findBlockedTag(tagBlocklist, [tag]))
        : [];
    syncBlockMenuControl({
      cardEl: card.cardEl,
      uploader:
        tagIndexReady && uploaderBlockingEnabled && !blockedUploader
          ? { mid: card.uploaderMid, name: card.uploader }
          : null,
      tags: availableTags,
    });
    const activeReasons = settings.enabled ? [...result.reasons] : [];
    if (uploaderBlockingEnabled && blockedUploader) {
      activeReasons.unshift(`已屏蔽 UP：${blockedUploader.name}`);
    }
    if (tagIndexReady && tagBlockingEnabled && blockedTag) {
      activeReasons.unshift(`已屏蔽 TAG：${blockedTag.name}`);
    }

    if (activeReasons.length > 0) {
      filtered += 1;
      const recommendation = pickFavoriteRecommendation(
        recommendationPool,
        `${location.pathname}${location.search}:${card.videoUrl || card.title}`,
        getBvid(card.videoUrl),
      );
      markFiltered(card, activeReasons, pageTheme, recommendation);
    } else {
      clearFilterState(card.cardEl);
      applyGrayscaleState(
        card,
        settings.enabled &&
          ((settings.grayscaleMissingTitleHighlight &&
            !settings.filterMissingTitleHighlight &&
            !searchTermMatched) ||
            (settings.grayscaleLowDanmakuViewRate &&
              !settings.filterLowDanmakuViewRate &&
              result.lowInteractionRate !== null)),
      );
    }
  }

  return createStats(true, settings.enabled, cards.length, filtered, evaluator.regexErrors);
}

export function clearSearchFilter(): void {
  clearAllFilterStates();
  clearBlockMenuControls();
  unbindFilterGateEvents();
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
