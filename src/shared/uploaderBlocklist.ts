import { hasChromeLocalStorage } from "./chromeStorage";

export const UPLOADER_BLOCKLIST_KEY = "biliFilter.uploaderBlocklist";

export type BlockedUploader = {
  id: string;
  mid: string;
  name: string;
  addedAt: number;
};

export type UploaderIdentity = Pick<BlockedUploader, "mid" | "name">;

export async function getUploaderBlocklist(): Promise<BlockedUploader[]> {
  if (!hasChromeLocalStorage()) return [];
  const result = await chrome.storage.local.get(UPLOADER_BLOCKLIST_KEY);
  return normalizeUploaderBlocklist(result[UPLOADER_BLOCKLIST_KEY]);
}

export async function addBlockedUploader(uploader: UploaderIdentity): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const entry = normalizeUploader(uploader);
  if (!entry) return;

  const current = await getUploaderBlocklist();
  const next = [entry, ...current.filter(item => item.id !== entry.id)];
  await chrome.storage.local.set({ [UPLOADER_BLOCKLIST_KEY]: next });
}

export async function removeBlockedUploader(id: string): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const current = await getUploaderBlocklist();
  await chrome.storage.local.set({
    [UPLOADER_BLOCKLIST_KEY]: current.filter(item => item.id !== id),
  });
}

export function findBlockedUploader(
  blocklist: BlockedUploader[],
  uploader: UploaderIdentity,
): BlockedUploader | undefined {
  const mid = normalizeMid(uploader.mid);
  const name = normalizeName(uploader.name);

  if (mid) return blocklist.find(item => item.mid === mid);
  if (!name) return undefined;
  return blocklist.find(item => !item.mid && normalizeName(item.name) === name);
}

function normalizeUploader(value: UploaderIdentity): BlockedUploader | null {
  const mid = normalizeMid(value.mid);
  const name = value.name.trim().replace(/\s+/g, " ");
  if (!mid && !name) return null;

  return {
    id: mid ? `mid:${mid}` : `name:${normalizeName(name)}`,
    mid,
    name: name || `UID ${mid}`,
    addedAt: Date.now(),
  };
}

function normalizeUploaderBlocklist(value: unknown): BlockedUploader[] {
  if (!Array.isArray(value)) return [];

  const entries = new Map<string, BlockedUploader>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Partial<BlockedUploader>;
    const entry = normalizeUploader({
      mid: typeof record.mid === "string" ? record.mid : "",
      name: typeof record.name === "string" ? record.name : "",
    });
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

function normalizeMid(value: string): string {
  const normalized = value.trim();
  return /^\d+$/.test(normalized) ? normalized : "";
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}
