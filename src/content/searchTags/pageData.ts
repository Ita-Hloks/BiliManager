import { displayTagName, normalizeTagName } from "../../shared/tagBlocklist";
import type { SearchTagIndex } from "../../shared/searchTags";

const PINIA_MARKER = "window.__pinia=";
const SEARCH_RESPONSE_MARKER = /return\s*\{\s*searchResponse\s*:/;

type SearchRecordFrame = {
  bvid: string;
  tag: string;
};

type ParsedString = {
  value: string;
  end: number;
};

/**
 * Search results are serialized into the page before the result cards mount.
 * Reading that script keeps the tag list aligned with exactly the cards shown
 * by Bilibili, without a second search request or one request per BV.
 */
export function extractSearchTagIndex(root: ParentNode = document): SearchTagIndex | null {
  const script = [...root.querySelectorAll<HTMLScriptElement>("script")].find(element =>
    element.textContent?.includes(PINIA_MARKER),
  );
  if (!script?.textContent) return null;

  return parseSearchState(script.textContent);
}

function parseSearchState(source: string): SearchTagIndex | null {
  const marker = SEARCH_RESPONSE_MARKER.exec(source);
  if (!marker) return null;

  const byBvid: SearchTagIndex = {};
  const frames: SearchRecordFrame[] = [];
  let index = marker.index + marker[0].length - 1;

  while (index < source.length) {
    const current = source[index];

    if (current === '"' || current === "'") {
      index = readString(source, index).end;
      continue;
    }

    if (current === "{") {
      frames.push({ bvid: "", tag: "" });
      index += 1;
      continue;
    }

    if (current === "}") {
      const frame = frames.pop();
      if (frame) addRecord(byBvid, frame);
      index += 1;
      continue;
    }

    if (current === "/" && source[index + 1] === "*") {
      index = skipBlockComment(source, index);
      continue;
    }

    if (current === "/" && source[index + 1] === "/") {
      index = skipLineComment(source, index);
      continue;
    }

    if (isIdentifierStart(current)) {
      const keyStart = index;
      index += 1;
      while (index < source.length && isIdentifierPart(source[index])) index += 1;

      const key = source.slice(keyStart, index);
      if ((key === "bvid" || key === "tag") && frames.length > 0) {
        const valueStart = skipWhitespace(source, index);
        if (source[valueStart] === ":") {
          const quoteStart = skipWhitespace(source, valueStart + 1);
          if (source[quoteStart] === '"' || source[quoteStart] === "'") {
            const parsed = readString(source, quoteStart);
            frames[frames.length - 1][key] = parsed.value;
            index = parsed.end;
          }
        }
      }
      continue;
    }

    index += 1;
  }

  return byBvid;
}

function addRecord(index: SearchTagIndex, frame: SearchRecordFrame): void {
  const bvid = frame.bvid.trim().toUpperCase();
  if (!/^BV[0-9A-Z]+$/.test(bvid)) return;

  const tags = new Map<string, string>();
  frame.tag.split(",").forEach(value => {
    const name = displayTagName(value);
    const normalized = normalizeTagName(name);
    if (normalized && name.length <= 80) tags.set(normalized, name);
  });

  if (tags.size > 0) index[bvid] = [...tags.values()];
}

function readString(source: string, start: number): ParsedString {
  const quote = source[start];
  let value = "";
  let index = start + 1;

  while (index < source.length) {
    const current = source[index];
    if (current === quote) return { value, end: index + 1 };
    if (current !== "\\") {
      value += current;
      index += 1;
      continue;
    }

    index += 1;
    if (index >= source.length) break;
    const escaped = source[index];
    index += 1;
    if (escaped === "n") value += "\n";
    else if (escaped === "r") value += "\r";
    else if (escaped === "t") value += "\t";
    else if (escaped === "b") value += "\b";
    else if (escaped === "f") value += "\f";
    else if (escaped === "v") value += "\v";
    else if (escaped === "0") value += "\0";
    else if (escaped === "u") {
      const hex = source.slice(index, index + 4);
      if (/^[0-9a-f]{4}$/i.test(hex)) {
        value += String.fromCharCode(Number.parseInt(hex, 16));
        index += 4;
      } else {
        value += escaped;
      }
    } else if (escaped === "x") {
      const hex = source.slice(index, index + 2);
      if (/^[0-9a-f]{2}$/i.test(hex)) {
        value += String.fromCharCode(Number.parseInt(hex, 16));
        index += 2;
      } else {
        value += escaped;
      }
    } else if (escaped !== "\n" && escaped !== "\r") {
      value += escaped;
    }
  }

  return { value, end: index };
}

function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function skipBlockComment(source: string, start: number): number {
  const end = source.indexOf("*/", start + 2);
  return end < 0 ? source.length : end + 2;
}

function skipLineComment(source: string, start: number): number {
  const end = source.indexOf("\n", start + 2);
  return end < 0 ? source.length : end + 1;
}

function isIdentifierStart(value: string | undefined): boolean {
  return !!value && /[a-z_$]/i.test(value);
}

function isIdentifierPart(value: string | undefined): boolean {
  return !!value && /[\w$]/.test(value);
}
