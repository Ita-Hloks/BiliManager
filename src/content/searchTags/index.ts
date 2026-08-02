import type { SearchTagIndex } from "../../shared/searchTags";
import { extractSearchTagIndex } from "./pageData";

export type SearchTagIndexSnapshot = {
  ready: boolean;
  index: SearchTagIndex;
};

let cachedKey = "";
let cachedIndex: SearchTagIndex = {};
let cachedReady = false;

export function loadSearchTagIndex(url = location.href): SearchTagIndexSnapshot {
  const parsed = new URL(url);
  const keyword = parsed.searchParams.get("keyword")?.trim() ?? "";
  const pageValue = Number.parseInt(parsed.searchParams.get("page") ?? "1", 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const key = `${parsed.pathname}\n${keyword}\n${page}`;
  if (cachedReady && cachedKey === key) return { ready: true, index: cachedIndex };

  if (!keyword) {
    cachedKey = key;
    cachedIndex = {};
    cachedReady = true;
    return { ready: true, index: cachedIndex };
  }

  const result = extractSearchTagIndex();
  if (result === null) return { ready: false, index: {} };

  cachedKey = key;
  cachedIndex = result;
  cachedReady = true;
  return { ready: true, index: cachedIndex };
}
