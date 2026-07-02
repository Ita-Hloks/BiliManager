export type FeatureKey = "searchFilter" | "watchTimer" | "dailyStats";

export type SearchFilterSettings = {
  enabled: boolean;
  titlePattern: string;
  uploaderPattern: string;
  minDanmakuViewRate: number;
  filterMissingTitleHighlight: boolean;
};

export type ExtensionSettings = {
  features: Record<FeatureKey, boolean>;
  searchFilter: SearchFilterSettings;
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
