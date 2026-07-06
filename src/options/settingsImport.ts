import { normalizeSettings } from "../shared/settingsSchema";
import type { ExtensionSettings } from "../shared/types";
import { splitRules } from "./utils";

// 统一处理完整配置 JSON 和纯文本规则导入，输出可直接保存的完整设置对象。
export function parseImportedSettings(
  text: string,
  currentSettings: ExtensionSettings,
): ExtensionSettings {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("导入文件为空");

  try {
    const payload = JSON.parse(trimmed) as Partial<ExtensionSettings> & {
      settings?: Partial<ExtensionSettings>;
    };
    const candidate = payload.settings ?? payload;

    if (hasSettingsShape(candidate)) return normalizeSettings(candidate, currentSettings);
    throw new Error("导入的 JSON 不是完整配置");
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
