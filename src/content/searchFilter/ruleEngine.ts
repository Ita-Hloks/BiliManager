import type { SearchFilterSettings } from "../../shared/types";
import type { FilterResult, SearchCard } from "./types";

const TEXT = {
  titleRuleLabel: "过滤词",
  uploaderRuleLabel: "UP 主过滤词",
  titleMatched: "过滤词命中",
  uploaderMatched: "UP过滤词命中",
  missingSearchTerm: "未命中搜索词",
  lowInteraction: "互动率过低",
  invalidRegex: "正则无效",
  unknownError: "未知错误",
};

export function evaluateSearchCard(
  card: SearchCard,
  settings: SearchFilterSettings,
  titleHighlighted: boolean,
): FilterResult {
  const reasons: string[] = [];
  const regexErrors: string[] = [];

  const titlePattern = compilePattern(settings.titlePattern, TEXT.titleRuleLabel);
  if (titlePattern.error) regexErrors.push(titlePattern.error);
  if (titlePattern.regex?.test(card.title)) {
    reasons.push(`${TEXT.titleMatched}：${settings.titlePattern}`);
  }

  const uploaderPattern = compilePattern(settings.uploaderPattern, TEXT.uploaderRuleLabel);
  if (uploaderPattern.error) regexErrors.push(uploaderPattern.error);
  if (uploaderPattern.regex?.test(card.uploader)) reasons.push(TEXT.uploaderMatched);

  if (settings.filterMissingTitleHighlight && !titleHighlighted) {
    reasons.push(TEXT.missingSearchTerm);
  }

  let lowInteractionRate: number | null = null;
  if (
    typeof card.viewCount === "number" &&
    typeof card.danmakuCount === "number" &&
    card.viewCount > 0 &&
    card.danmakuCount > 0
  ) {
    const rate = card.danmakuCount / card.viewCount;
    if (rate < settings.minDanmakuViewRate) {
      lowInteractionRate = rate;
      if (settings.filterLowDanmakuViewRate) {
        reasons.push(`${TEXT.lowInteraction}：${formatRate(rate)}`);
      }
    }
  }

  return { reasons, regexErrors, lowInteractionRate };
}

function compilePattern(
  pattern: string,
  label: string,
): { regex: RegExp | null; error: string | null } {
  const trimmed = pattern.trim();
  if (!trimmed) return { regex: null, error: null };

  try {
    return { regex: new RegExp(trimmed, "i"), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : TEXT.unknownError;
    return { regex: null, error: `${label}${TEXT.invalidRegex}：${message}` };
  }
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}
