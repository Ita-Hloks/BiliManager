import { normalizeSettings } from "../shared/settingsSchema";
import type { ExtensionSettings } from "../shared/types";
import { splitRules } from "./utils";

type LegacyRuleImportPayload = {
  searchFilter?: { titlePattern?: unknown; uploaderPattern?: unknown };
  titlePattern?: unknown;
  uploaderPattern?: unknown;
  titleRules?: unknown;
  uploaderRules?: unknown;
};

// 统一处理完整配置 JSON、旧版规则 JSON 和纯文本规则导入，输出可直接保存的完整设置对象。
export function parseImportedSettings(
  text: string,
  currentSettings: ExtensionSettings,
): ExtensionSettings {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("导入文件为空");

  try {
    const payload = JSON.parse(trimmed) as Partial<ExtensionSettings> &
      LegacyRuleImportPayload & {
        settings?: Partial<ExtensionSettings>;
      };
    const candidate = payload.settings ?? payload;

    if (hasSettingsShape(candidate)) return normalizeSettings(candidate, currentSettings);
    return normalizeLegacyRuleImport(payload, currentSettings);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        ...currentSettings,
        searchFilter: {
          ...currentSettings.searchFilter,
          titlePattern: splitRules(trimmed.replace(/\r?\n/g, "|")).join("|"),
        },
        updatedAt: new Date().toISOString(),
      };
    }

    throw error;
  }
}

function hasSettingsShape(value: Partial<ExtensionSettings>) {
  return !!value.searchFilter || !!value.personalization || !!value.features || !!value.theme;
}

// 兼容早期只导出过滤规则的格式，避免用户旧备份在完整 settings 结构出现后失效。
function normalizeLegacyRuleImport(
  payload: LegacyRuleImportPayload,
  currentSettings: ExtensionSettings,
) {
  return {
    ...currentSettings,
    searchFilter: {
      ...currentSettings.searchFilter,
      titlePattern: normalizeImportedRules(
        payload.titleRules,
        getStringPattern(payload.titlePattern ?? payload.searchFilter?.titlePattern),
      ).join("|"),
      uploaderPattern: normalizeImportedRules(
        payload.uploaderRules,
        getStringPattern(payload.uploaderPattern ?? payload.searchFilter?.uploaderPattern),
      ).join("|"),
    },
    updatedAt: new Date().toISOString(),
  };
}

function getStringPattern(value: unknown) {
  return typeof value === "string" ? value : "";
}

// 规则在 UI 中按列表展示，但底层仍以 `|` 拼接的正则字符串保存，这里集中维护转换约定。
function normalizeImportedRules(value: unknown, fallbackPattern: string) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map(rule => rule.trim())
      .filter(Boolean);
  }

  return splitRules(fallbackPattern);
}
