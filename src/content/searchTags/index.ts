import type { SearchTagIndex } from "../../shared/searchTags";
import { extractSearchTagIndex } from "./pageData";

let cachedKey = "";
let cachedIndex: SearchTagIndex = {};

export function loadSearchTagIndex(url = location.href): SearchTagIndex {
  const parsed = new URL(url);
  const keyword = parsed.searchParams.get("keyword")?.trim() ?? "";
  if (!keyword) return {};

  const pageValue = Number.parseInt(parsed.searchParams.get("page") ?? "1", 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const key = `${parsed.pathname}\n${keyword}\n${page}`;
  if (cachedKey === key) return cachedIndex;
  const result = extractSearchTagIndex();
  if (result === null) return {};

  cachedKey = key;
  cachedIndex = result;
  return result;
}
