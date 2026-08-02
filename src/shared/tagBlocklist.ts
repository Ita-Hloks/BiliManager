import { hasChromeLocalStorage } from "./chromeStorage";

export const TAG_BLOCKLIST_KEY = "biliFilter.tagBlocklist";

export type BlockedTag = {
  id: string;
  name: string;
  normalized: string;
  addedAt: number;
};

export type TagIdentity = Pick<BlockedTag, "name">;

export async function getTagBlocklist(): Promise<BlockedTag[]> {
  if (!hasChromeLocalStorage()) return [];
  const result = await chrome.storage.local.get(TAG_BLOCKLIST_KEY);
  return normalizeTagBlocklist(result[TAG_BLOCKLIST_KEY]);
}

export async function addBlockedTag(tag: TagIdentity): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const entry = normalizeTag(tag);
  if (!entry) return;

  const current = await getTagBlocklist();
  const next = [entry, ...current.filter(item => item.id !== entry.id)];
  await chrome.storage.local.set({ [TAG_BLOCKLIST_KEY]: next });
}

export async function removeBlockedTag(id: string): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const current = await getTagBlocklist();
  await chrome.storage.local.set({
    [TAG_BLOCKLIST_KEY]: current.filter(item => item.id !== id),
  });
}

export function findBlockedTag(blocklist: BlockedTag[], tags: string[]): BlockedTag | undefined {
  const normalizedTags = new Set(tags.map(normalizeTagName).filter(Boolean));
  return blocklist.find(item => normalizedTags.has(item.normalized));
}

export function normalizeTagName(value: string): string {
  return value
    .trim()
    .replace(/^#+|#+$/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("zh-CN");
}

export function displayTagName(value: string): string {
  return value
    .trim()
    .replace(/^#+|#+$/g, "")
    .replace(/\s+/g, " ");
}

function normalizeTag(value: TagIdentity): BlockedTag | null {
  const name = displayTagName(value.name);
  const normalized = normalizeTagName(name);
  if (!normalized) return null;

  return {
    id: `tag:${normalized}`,
    name,
    normalized,
    addedAt: Date.now(),
  };
}

function normalizeTagBlocklist(value: unknown): BlockedTag[] {
  if (!Array.isArray(value)) return [];

  const entries = new Map<string, BlockedTag>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Partial<BlockedTag>;
    const entry = normalizeTag({ name: typeof record.name === "string" ? record.name : "" });
    if (!entry) continue;
    entries.set(entry.id, {
      ...entry,
      addedAt:
        typeof record.addedAt === "number" && Number.isFinite(record.addedAt)
          ? record.addedAt
          : entry.addedAt,
    });
  }

  return [...entries.values()].sort((left, right) => right.addedAt - left.addedAt);
}
