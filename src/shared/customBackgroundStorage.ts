import { hasChromeLocalStorage } from "./chromeStorage";

export const CUSTOM_BACKGROUND_IMAGE_KEY = "biliManager.customBackgroundImage";

export type StoredCustomBackgroundImage = {
  dataUrl: string;
  revision: number;
  width?: number;
  height?: number;
};

const BACKGROUND_IMAGE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function isValidBackgroundImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && BACKGROUND_IMAGE_DATA_URL_PATTERN.test(value);
}

export async function getCustomBackgroundImage(): Promise<StoredCustomBackgroundImage | null> {
  if (!hasChromeLocalStorage()) return null;

  const result = await chrome.storage.local.get(CUSTOM_BACKGROUND_IMAGE_KEY);
  const raw = result[CUSTOM_BACKGROUND_IMAGE_KEY];
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Partial<StoredCustomBackgroundImage>;
  if (!isValidBackgroundImageDataUrl(record.dataUrl)) return null;

  const revision = normalizeRevision(record.revision, 0);
  const width = normalizePositiveDimension(record.width);
  const height = normalizePositiveDimension(record.height);

  return {
    dataUrl: record.dataUrl,
    revision,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

export async function saveCustomBackgroundImage(image: StoredCustomBackgroundImage): Promise<void> {
  if (!isValidBackgroundImageDataUrl(image.dataUrl)) {
    throw new Error("图片格式无效");
  }
  if (!hasChromeLocalStorage()) return;

  const width = normalizePositiveDimension(image.width);
  const height = normalizePositiveDimension(image.height);
  const payload: StoredCustomBackgroundImage = {
    dataUrl: image.dataUrl,
    revision: normalizeRevision(image.revision, 0),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  try {
    await chrome.storage.local.set({ [CUSTOM_BACKGROUND_IMAGE_KEY]: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/quota_bytes|quota/i.test(message)) {
      throw new Error("本地存储空间不足，请换一张更小的图片或清理部分观看历史后重试");
    }
    throw error;
  }
}

export async function clearCustomBackgroundImage(): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  await chrome.storage.local.remove(CUSTOM_BACKGROUND_IMAGE_KEY);
}

function normalizeRevision(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function normalizePositiveDimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
