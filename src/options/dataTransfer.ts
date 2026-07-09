import { normalizeSettings } from "../shared/settingsSchema";
import type { ExtensionSettings, PlayerPersonalizationSettings } from "../shared/types";
import type { WatchTimerHistoryBackup } from "../shared/watchTimerHistory";
import { exportWatchTimerHistory, importWatchTimerHistory } from "../shared/watchTimerHistory";
import { splitRules } from "./utils";

export type DataExportKind = "all" | "settings" | "watchHistory";

type BiliManagerBackup = {
  app: "BiliManager";
  schemaVersion: 1;
  kind: DataExportKind;
  exportedAt: string;
  settings?: PortableSettings;
  watchHistory?: WatchTimerHistoryBackup;
};

type PortableSettings = Partial<Omit<ExtensionSettings, "personalization">> & {
  personalization?: Partial<PlayerPersonalizationSettings>;
};

export async function createDataExportPayload(
  kind: DataExportKind,
  settings: ExtensionSettings,
): Promise<BiliManagerBackup> {
  const payload: BiliManagerBackup = {
    app: "BiliManager",
    schemaVersion: 1,
    kind,
    exportedAt: new Date().toISOString(),
  };

  if (kind === "all" || kind === "settings") {
    payload.settings = createPortableSettings(settings);
  }

  if (kind === "all" || kind === "watchHistory") {
    payload.watchHistory = await exportWatchTimerHistory();
  }

  return payload;
}

export async function importDataBackup(
  text: string,
  currentSettings: ExtensionSettings,
): Promise<{ message: string; settings?: ExtensionSettings }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("导入文件为空");

  try {
    const candidate = JSON.parse(trimmed) as Partial<BiliManagerBackup> | PortableSettings;

    if (isBackupPayload(candidate)) {
      let nextSettings: ExtensionSettings | undefined;

      if ((candidate.kind === "all" || candidate.kind === "settings") && candidate.settings) {
        nextSettings = normalizePortableSettings(candidate.settings, currentSettings);
      }

      if (
        (candidate.kind === "all" || candidate.kind === "watchHistory") &&
        candidate.watchHistory
      ) {
        await importWatchTimerHistory(candidate.watchHistory);
      }

      return {
        message: getImportMessage(candidate.kind),
        settings: nextSettings,
      };
    }

    if (hasSettingsShape(candidate)) {
      return {
        message: "已导入设置配置",
        settings: normalizePortableSettings(candidate, currentSettings),
      };
    }

    throw new Error("导入的 JSON 不是支持的数据备份");
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        message: "已导入标题过滤规则",
        settings: {
          ...currentSettings,
          searchFilter: {
            ...currentSettings.searchFilter,
            titlePattern: splitRules(trimmed.replace(/\r?\n/g, "|")).join("|"),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    }

    throw error;
  }
}

export function getExportFileName(kind: DataExportKind, dateText: string): string {
  const label: Record<DataExportKind, string> = {
    all: "all",
    settings: "settings",
    watchHistory: "watch-history",
  };
  return `bili-manager-${label[kind]}-${dateText}.json`;
}

export function getExportMessage(kind: DataExportKind): string {
  if (kind === "all") return "已导出全部数据";
  if (kind === "settings") return "已导出设置配置";
  return "已导出观看历史";
}

function createPortableSettings(settings: ExtensionSettings): PortableSettings {
  return {
    features: settings.features,
    searchFilter: settings.searchFilter,
    personalization: {
      blockRelatedVideos: settings.personalization.blockRelatedVideos,
      blockPlayerAds: settings.personalization.blockPlayerAds,
      disableRecommendationAutoplay: settings.personalization.disableRecommendationAutoplay,
    },
    watchTimer: settings.watchTimer,
    theme: settings.theme,
    updatedAt: settings.updatedAt,
  };
}

function normalizePortableSettings(
  source: PortableSettings,
  currentSettings: ExtensionSettings,
): ExtensionSettings {
  const normalized = normalizeSettings(
    stripCustomBackground(source) as Partial<ExtensionSettings>,
    currentSettings,
  );
  return {
    ...normalized,
    personalization: {
      ...normalized.personalization,
      customBackground: currentSettings.personalization.customBackground,
    },
  };
}

function stripCustomBackground(source: PortableSettings): PortableSettings {
  return {
    ...source,
    personalization: source.personalization
      ? {
          blockRelatedVideos: source.personalization.blockRelatedVideos,
          blockPlayerAds: source.personalization.blockPlayerAds,
          disableRecommendationAutoplay: source.personalization.disableRecommendationAutoplay,
        }
      : undefined,
  };
}

function isBackupPayload(value: unknown): value is BiliManagerBackup {
  if (!value || typeof value !== "object") return false;

  const record = value as Partial<BiliManagerBackup>;
  return (
    record.app === "BiliManager" &&
    record.schemaVersion === 1 &&
    (record.kind === "all" || record.kind === "settings" || record.kind === "watchHistory")
  );
}

function hasSettingsShape(value: unknown): value is PortableSettings {
  if (!value || typeof value !== "object") return false;

  const record = value as PortableSettings;
  return !!record.searchFilter || !!record.personalization || !!record.features || !!record.theme;
}

function getImportMessage(kind: DataExportKind): string {
  if (kind === "all") return "已导入全部数据";
  if (kind === "settings") return "已导入设置配置";
  return "已导入观看历史";
}
