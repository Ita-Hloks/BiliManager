export type FeatureKey = "enabled" | "watchTimer" | "dailyStats";

export type SearchFilterSettings = {
  enabled: boolean;
  titlePattern: string;
  uploaderPattern: string;
  minDanmakuViewRate: number;
  filterLowDanmakuViewRate: boolean;
  grayscaleLowDanmakuViewRate: boolean;
  filterMissingTitleHighlight: boolean;
  grayscaleMissingTitleHighlight: boolean;
};

export type CustomBackgroundSettings = {
  enabled: boolean;
  imageDataUrl: string;
  maskOpacity: number;
  positionX: number;
  positionY: number;
};

export type PlayerPersonalizationSettings = {
  blockRelatedVideos: boolean;
  blockPlayerAds: boolean;
  disableRecommendationAutoplay: boolean;
  customBackground: CustomBackgroundSettings;
};

export type WatchTimerSettings = {
  opacity: number;
};

export type ExtensionSettings = {
  features: Record<FeatureKey, boolean>;
  searchFilter: SearchFilterSettings;
  personalization: PlayerPersonalizationSettings;
  watchTimer: WatchTimerSettings;
  theme: "system" | "light" | "dark";
  updatedAt: string;
};

export type RuntimeSnapshot = {
  url: string;
  title: string;
  isBilibili: boolean;
  isSearchPage?: boolean;
  detectedAt: string;
};

export type SearchFilterStats = {
  available: boolean;
  enabled: boolean;
  total: number;
  filtered: number;
  regexErrors: string[];
  updatedAt: string;
};
