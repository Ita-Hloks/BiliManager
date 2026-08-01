import type { BlockedUploader } from "../../shared/uploaderBlocklist";
import { findBlockedUploader } from "../../shared/uploaderBlocklist";
import type { RuntimeSnapshot, SearchFilterSettings, SearchFilterStats } from "../../shared/types";
import type { FavoriteRecommendationPool } from "../favoriteRecommendation";
import { pickFavoriteRecommendation } from "../favoriteRecommendation";
import { detectBilibiliPageTheme } from "../pageTheme";
import { clearUploaderBlockControls, syncUploaderBlockControl } from "../uploaderBlock";
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
): SearchFilterStats {
  if (!isSearchPage()) {
    clearUploaderBlockControls();
    clearAllFilterStates();
    return createStats(false, settings.enabled, 0, 0, []);
  }

  const cards = collectSearchCards();
  if (cards.length === 0) return createStats(true, settings.enabled, 0, 0, []);

  const evaluator = createSearchCardEvaluator(settings);
  const pageTheme = detectBilibiliPageTheme();
  let filtered = 0;

  for (const card of cards) {
    const titleHighlighted = hasTitleHighlight(card.titleEl);
    const result = evaluator.evaluate(card, titleHighlighted);
    const blockedUploader = findBlockedUploader(uploaderBlocklist, {
      mid: card.uploaderMid,
      name: card.uploader,
    });
    syncUploaderBlockControl(
      {
        cardEl: card.cardEl,
        mid: card.uploaderMid,
        name: card.uploader,
      },
      uploaderBlockingEnabled && !blockedUploader,
    );
    const activeReasons = settings.enabled ? [...result.reasons] : [];
    if (uploaderBlockingEnabled && blockedUploader) {
      activeReasons.unshift(`已屏蔽 UP：${blockedUploader.name}`);
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
            !titleHighlighted) ||
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
  clearUploaderBlockControls();
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
