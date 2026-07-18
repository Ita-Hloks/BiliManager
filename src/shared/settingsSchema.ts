import { clamp } from "./number";
import type {
  CustomBackgroundSettings,
  ExtensionSettings,
  FavoriteRecommendationSettings,
  PlayerPersonalizationSettings,
  SearchFilterSettings,
  WatchReminderSettings,
  WatchTimerSettings,
} from "./types";

export const defaultSettings: ExtensionSettings = {
  features: {
    enabled: true,
    watchTimer: false,
    watchReminder: false,
    dailyStats: false,
  },
  searchFilter: {
    enabled: true,
    titlePattern: "",
    uploaderPattern: "",
    minDanmakuViewRate: 0.005,
    filterLowDanmakuViewRate: true,
    grayscaleLowDanmakuViewRate: true,
    filterMissingTitleHighlight: true,
    grayscaleMissingTitleHighlight: true,
  },
  favoriteRecommendation: {
    enabled: true,
    folderId: "2045665532",
    recommendationRate: 0.35,
  },
  personalization: {
    filterTrending: true,
    blockRelatedVideos: false,
    blockPlayerAds: false,
    disableRecommendationAutoplay: false,
    customBackground: {
      enabled: false,
      imageDataUrl: "",
      maskOpacity: 0.18,
      positionX: 50,
      positionY: 50,
    },
  },
  watchTimer: {
    opacity: 0.86,
  },
  watchReminder: {
    limitMinutes: 60,
    interruptionMinutes: 10,
  },
  theme: "system",
  updatedAt: new Date(0).toISOString(),
};

// 设置结构的唯一归一化入口：合并缺省值、兼容旧字段，并同步 features 与各功能实际开关。
export function normalizeSettings(
  value: Partial<ExtensionSettings> | undefined,
  currentSettings: ExtensionSettings = defaultSettings,
): ExtensionSettings {
  const source = value ?? {};
  const theme = normalizeTheme(source.theme, currentSettings.theme);
  const searchFilter = normalizeSearchFilter(source.searchFilter, currentSettings.searchFilter);
  const favoriteRecommendation = normalizeFavoriteRecommendation(
    source.favoriteRecommendation,
    currentSettings.favoriteRecommendation,
  );
  const personalization = normalizePersonalization(
    source.personalization,
    currentSettings.personalization,
  );
  const legacyFeatures = source.features as
    | (Partial<ExtensionSettings["features"]> & {
        searchFilter?: boolean;
        personalization?: boolean;
      })
    | undefined;
  const searchFilterEnabled =
    typeof source.searchFilter?.enabled === "boolean"
      ? source.searchFilter.enabled
      : (legacyFeatures?.searchFilter ?? searchFilter.enabled);

  return {
    ...currentSettings,
    features: {
      enabled: source.features?.enabled ?? currentSettings.features.enabled ?? true,
      watchTimer: source.features?.watchTimer ?? currentSettings.features.watchTimer,
      watchReminder: source.features?.watchReminder ?? currentSettings.features.watchReminder,
      dailyStats: source.features?.dailyStats ?? currentSettings.features.dailyStats,
    },
    searchFilter: {
      ...searchFilter,
      enabled: searchFilterEnabled,
    },
    favoriteRecommendation,
    personalization,
    watchTimer: normalizeWatchTimer(source.watchTimer, currentSettings.watchTimer),
    watchReminder: normalizeWatchReminder(source.watchReminder, currentSettings.watchReminder),
    theme,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeFavoriteRecommendation(
  value: Partial<FavoriteRecommendationSettings> | undefined,
  currentRecommendation: FavoriteRecommendationSettings,
): FavoriteRecommendationSettings {
  const folderId = typeof value?.folderId === "string" ? value.folderId.trim() : undefined;

  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : currentRecommendation.enabled,
    folderId:
      folderId === undefined || (!/^\d+$/.test(folderId) && folderId !== "")
        ? currentRecommendation.folderId
        : folderId,
    recommendationRate:
      typeof value?.recommendationRate === "number"
        ? clamp(value.recommendationRate, 0, 1)
        : currentRecommendation.recommendationRate,
  };
}

// 搜索过滤设置需要保留 regex 字符串、限制互动率范围，并保持 enabled 的布尔语义稳定。
export function normalizeSearchFilter(
  value: Partial<SearchFilterSettings> | undefined,
  currentSearchFilter: SearchFilterSettings,
): SearchFilterSettings {
  return {
    ...currentSearchFilter,
    ...value,
    enabled: typeof value?.enabled === "boolean" ? value.enabled : currentSearchFilter.enabled,
    titlePattern: getStringPattern(value?.titlePattern) || currentSearchFilter.titlePattern,
    uploaderPattern:
      getStringPattern(value?.uploaderPattern) || currentSearchFilter.uploaderPattern,
    minDanmakuViewRate:
      typeof value?.minDanmakuViewRate === "number"
        ? clamp(value.minDanmakuViewRate, 0, 0.01)
        : currentSearchFilter.minDanmakuViewRate,
    filterLowDanmakuViewRate:
      typeof value?.filterLowDanmakuViewRate === "boolean"
        ? value.filterLowDanmakuViewRate
        : currentSearchFilter.filterLowDanmakuViewRate,
    grayscaleLowDanmakuViewRate:
      (value?.filterLowDanmakuViewRate ?? currentSearchFilter.filterLowDanmakuViewRate)
        ? true
        : typeof value?.grayscaleLowDanmakuViewRate === "boolean"
          ? value.grayscaleLowDanmakuViewRate
          : currentSearchFilter.grayscaleLowDanmakuViewRate,
    filterMissingTitleHighlight:
      typeof value?.filterMissingTitleHighlight === "boolean"
        ? value.filterMissingTitleHighlight
        : currentSearchFilter.filterMissingTitleHighlight,
    grayscaleMissingTitleHighlight:
      (value?.filterMissingTitleHighlight ?? currentSearchFilter.filterMissingTitleHighlight)
        ? true
        : typeof value?.grayscaleMissingTitleHighlight === "boolean"
          ? value.grayscaleMissingTitleHighlight
          : currentSearchFilter.grayscaleMissingTitleHighlight,
  };
}

// 个性化设置包含播放器拦截和背景图子结构；这里集中补齐嵌套字段，避免浅合并丢失背景参数。
export function normalizePersonalization(
  value: Partial<PlayerPersonalizationSettings> | undefined,
  currentPersonalization: PlayerPersonalizationSettings,
): PlayerPersonalizationSettings {
  return {
    ...currentPersonalization,
    filterTrending:
      typeof value?.filterTrending === "boolean"
        ? value.filterTrending
        : currentPersonalization.filterTrending,
    blockRelatedVideos:
      typeof value?.blockRelatedVideos === "boolean"
        ? value.blockRelatedVideos
        : currentPersonalization.blockRelatedVideos,
    blockPlayerAds:
      typeof value?.blockPlayerAds === "boolean"
        ? value.blockPlayerAds
        : currentPersonalization.blockPlayerAds,
    disableRecommendationAutoplay:
      typeof value?.disableRecommendationAutoplay === "boolean"
        ? value.disableRecommendationAutoplay
        : currentPersonalization.disableRecommendationAutoplay,
    customBackground: normalizeCustomBackground(
      value?.customBackground,
      currentPersonalization.customBackground,
    ),
  };
}

// 背景图设置来自导入文件或 UI 输入时都要限制透明度与位置范围，防止渲染状态越界。
export function normalizeCustomBackground(
  value: Partial<CustomBackgroundSettings> | undefined,
  currentBackground: CustomBackgroundSettings,
): CustomBackgroundSettings {
  return {
    ...currentBackground,
    enabled: typeof value?.enabled === "boolean" ? value.enabled : currentBackground.enabled,
    imageDataUrl:
      typeof value?.imageDataUrl === "string" ? value.imageDataUrl : currentBackground.imageDataUrl,
    maskOpacity:
      typeof value?.maskOpacity === "number"
        ? clamp(value.maskOpacity, 0, 0.7)
        : currentBackground.maskOpacity,
    positionX:
      typeof value?.positionX === "number"
        ? clamp(value.positionX, 0, 100)
        : currentBackground.positionX,
    positionY:
      typeof value?.positionY === "number"
        ? clamp(value.positionY, 0, 100)
        : currentBackground.positionY,
  };
}

// 计时器透明度同时影响设置页预览和内容脚本浮层，统一限制在可读范围内。
export function normalizeWatchTimer(
  value: Partial<WatchTimerSettings> | undefined,
  currentWatchTimer: WatchTimerSettings,
): WatchTimerSettings {
  return {
    ...currentWatchTimer,
    opacity:
      typeof value?.opacity === "number"
        ? clamp(value.opacity, 0.45, 1)
        : currentWatchTimer.opacity,
  };
}

export function normalizeWatchReminder(
  value: Partial<WatchReminderSettings> | undefined,
  currentWatchReminder: WatchReminderSettings,
): WatchReminderSettings {
  return {
    limitMinutes:
      typeof value?.limitMinutes === "number"
        ? Math.round(clamp(value.limitMinutes, 1, 720))
        : currentWatchReminder.limitMinutes,
    interruptionMinutes:
      typeof value?.interruptionMinutes === "number"
        ? Math.round(clamp(value.interruptionMinutes, 1, 120))
        : currentWatchReminder.interruptionMinutes,
  };
}

function normalizeTheme(value: unknown, fallback: ExtensionSettings["theme"]) {
  return value === "system" || value === "light" || value === "dark" ? value : fallback;
}

function getStringPattern(value: unknown) {
  return typeof value === "string" ? value : "";
}
