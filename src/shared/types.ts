export type FeatureKey = "searchFilter" | "watchTimer" | "dailyStats";

export type ExtensionSettings = {
  features: Record<FeatureKey, boolean>;
  theme: "system" | "light" | "dark";
  updatedAt: string;
};

export type RuntimeSnapshot = {
  url: string;
  title: string;
  isBilibili: boolean;
  detectedAt: string;
};
