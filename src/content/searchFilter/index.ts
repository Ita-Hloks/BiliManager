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
  getStrictlyRemovedCards,
  markFiltered,
  prepareStrictInterceptionPage,
  removeStrictlyFilteredCard,
  restoreStrictlyRemovedCard,
  restoreStrictlyRemovedCards,
} from "./cardPresenter";
import { unbindFilterGateEvents } from "./filterGate";
import { collectSearchCards, getBvid, hasTitleHighlight, isSearchPage } from "./pageAdapter";
import { createSearchCardEvaluator } from "./ruleEngine";
import type { FilterResult, SearchCard } from "./types";

export { isSearchPage } from "./pageAdapter";

const EMPTY_RECOMMENDATION_POOL: FavoriteRecommendationPool = {
  videos: [],
  recommendationRate: 0,
};

let strictInterceptionWasEnabled = false;

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
    clearBlockMenuControls();
    clearAllFilterStates();
    strictInterceptionWasEnabled = false;
    return createStats(false, settings.enabled, 0, 0, []);
  }

  const pageKey = `${location.pathname}${location.search}`;
  prepareStrictInterceptionPage(pageKey);
  if (settings.strictInterception && !strictInterceptionWasEnabled) {
    clearAllFilterStates();
    prepareStrictInterceptionPage(pageKey);
  }
  strictInterceptionWasEnabled = settings.strictInterception;
  if (!settings.strictInterception) restoreStrictlyRemovedCards();

  const evaluator = createSearchCardEvaluator(settings);
  const cards = collectSearchCards();
  const pageTheme = detectBilibiliPageTheme();
  const strictlyRemovedCards = settings.strictInterception ? getStrictlyRemovedCards() : [];
  const restoredCards: SearchCard[] = [];
  let filtered = 0;

  for (const card of strictlyRemovedCards) {
    const evaluation = evaluateCard(
      card,
      evaluator,
      settings,
      uploaderBlocklist,
      uploaderBlockingEnabled,
    );
    if (evaluation.activeReasons.length > 0) {
      filtered += 1;
      continue;
    }

    restoreStrictlyRemovedCard(card.cardEl);
    restoredCards.push(card);
  }

  for (const card of [...cards, ...restoredCards]) {
    const evaluation = evaluateCard(
      card,
      evaluator,
      settings,
      uploaderBlocklist,
      uploaderBlockingEnabled,
    );
    const shouldRemove = settings.strictInterception && evaluation.activeReasons.length > 0;
    syncBlockMenuControl({
      cardEl: card.cardEl,
      uploader: shouldRemove
        ? null
        : uploaderBlockingEnabled && !evaluation.blockedUploader
          ? { mid: card.uploaderMid, name: card.uploader }
          : null,
    });

    if (evaluation.activeReasons.length > 0) {
      filtered += 1;
      if (shouldRemove) {
        removeStrictlyFilteredCard(card);
        continue;
      }

      const recommendation = pickFavoriteRecommendation(
        recommendationPool,
        `${location.pathname}${location.search}:${card.videoUrl || card.title}`,
        getBvid(card.videoUrl),
      );
      markFiltered(card, evaluation.activeReasons, pageTheme, recommendation);
    } else {
      clearFilterState(card.cardEl);
      applyGrayscaleState(
        card,
        settings.enabled &&
          ((settings.grayscaleMissingTitleHighlight &&
            !settings.filterMissingTitleHighlight &&
            !evaluation.searchTermMatched) ||
            (settings.grayscaleLowDanmakuViewRate &&
              !settings.filterLowDanmakuViewRate &&
              evaluation.result.lowInteractionRate !== null)),
      );
    }
  }

  return createStats(
    true,
    settings.enabled,
    cards.length + strictlyRemovedCards.length,
    filtered,
    evaluator.regexErrors,
  );
}

export function clearSearchFilter(): void {
  strictInterceptionWasEnabled = false;
  clearAllFilterStates();
  clearBlockMenuControls();
  unbindFilterGateEvents();
}

function evaluateCard(
  card: SearchCard,
  evaluator: ReturnType<typeof createSearchCardEvaluator>,
  settings: SearchFilterSettings,
  uploaderBlocklist: BlockedUploader[],
  uploaderBlockingEnabled: boolean,
): CardEvaluation {
  const searchTermMatched =
    card.isUploaderVideoRecommendation ||
    card.uploaderMatchesSearchKeyword ||
    hasTitleHighlight(card.titleEl);
  const result = evaluator.evaluate(card, searchTermMatched);
  const blockedUploader = findBlockedUploader(uploaderBlocklist, {
    mid: card.uploaderMid,
    name: card.uploader,
  });
  const activeReasons = settings.enabled
    ? [...result.reasons]
    : result.lowViewCountReason
      ? [result.lowViewCountReason]
      : [];
  if (uploaderBlockingEnabled && blockedUploader) {
    activeReasons.unshift(`已屏蔽 UP：${blockedUploader.name}`);
  }

  return { activeReasons, blockedUploader, result, searchTermMatched };
}

type CardEvaluation = {
  activeReasons: string[];
  blockedUploader: BlockedUploader | undefined;
  result: FilterResult;
  searchTermMatched: boolean;
};

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
