import type { FavoriteVideo } from "../../shared/favoriteFolder";
import { sendMessage } from "../../shared/messaging";
import type { FavoriteRecommendationSettings } from "../../shared/types";

const CACHE_TTL = 5 * 60_000;
const RETRY_DELAY = 30_000;

type FavoriteVideoCache = {
  videos: FavoriteVideo[];
  expiresAt: number;
  retryAfter: number;
  request?: Promise<FavoriteVideo[]>;
};

export type FavoriteRecommendationPool = {
  videos: FavoriteVideo[];
  recommendationRate: number;
};

const videoCache = new Map<string, FavoriteVideoCache>();

export function getCachedFavoriteRecommendationPool(
  settings: FavoriteRecommendationSettings,
): FavoriteRecommendationPool | null {
  if (!isRecommendationEnabled(settings)) return null;

  const videos = videoCache.get(settings.folderId)?.videos;
  if (!videos || videos.length === 0) return null;
  return { videos, recommendationRate: settings.recommendationRate };
}

export async function loadFavoriteRecommendationPool(
  settings: FavoriteRecommendationSettings,
): Promise<FavoriteRecommendationPool> {
  if (!isRecommendationEnabled(settings)) {
    return { videos: [], recommendationRate: 0 };
  }

  return {
    videos: await loadFavoriteVideos(settings.folderId),
    recommendationRate: settings.recommendationRate,
  };
}

function isRecommendationEnabled(settings: FavoriteRecommendationSettings): boolean {
  return settings.enabled && /^\d+$/.test(settings.folderId) && settings.recommendationRate > 0;
}

export function pickFavoriteRecommendation(
  pool: FavoriteRecommendationPool,
  cardKey: string,
  excludedBvid = "",
): FavoriteVideo | null {
  if (pool.videos.length === 0 || pool.recommendationRate <= 0) return null;

  const selectionRoll = hashString(`selection:${cardKey}`) / 0x100000000;
  if (selectionRoll >= pool.recommendationRate) return null;

  const startIndex = hashString(`video:${cardKey}`) % pool.videos.length;
  for (let offset = 0; offset < pool.videos.length; offset += 1) {
    const video = pool.videos[(startIndex + offset) % pool.videos.length];
    if (video && video.bvid !== excludedBvid) return video;
  }

  return null;
}

export function getFavoriteVideoUrl(video: FavoriteVideo): string {
  const webLink = getBilibiliWebVideoUrl(video.link);
  if (webLink) return webLink;
  const bvid = getBilibiliVideoId(video.bvid);
  return bvid
    ? `https://www.bilibili.com/video/${bvid}`
    : `https://www.bilibili.com/video/av${video.id}`;
}

function getBilibiliWebVideoUrl(value: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.hostname !== "www.bilibili.com" && url.hostname !== "bilibili.com") return "";
    if (!/^\/video\/(?:BV[0-9A-Za-z]+|av\d+)\/?$/.test(url.pathname)) return "";
    return value;
  } catch {
    return "";
  }
}

function getBilibiliVideoId(value: string): string {
  return /^(?:BV[0-9A-Za-z]+|av\d+)$/.test(value) ? value : "";
}

export function normalizeFavoriteCoverUrl(value: string): string {
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

async function loadFavoriteVideos(folderId: string): Promise<FavoriteVideo[]> {
  const now = Date.now();
  const cache = videoCache.get(folderId) ?? {
    videos: [],
    expiresAt: 0,
    retryAfter: 0,
  };
  videoCache.set(folderId, cache);

  if (cache.expiresAt > now) return cache.videos;
  if (cache.request) return cache.request;
  if (cache.retryAfter > now) return cache.videos;

  const request = requestFavoriteVideos(folderId);
  cache.request = request;

  try {
    cache.videos = await request;
    cache.expiresAt = Date.now() + CACHE_TTL;
    cache.retryAfter = 0;
    return cache.videos;
  } catch (error) {
    cache.retryAfter = Date.now() + RETRY_DELAY;
    console.warn("[BiliManager] 收藏夹推荐池读取失败", error);
    return cache.videos;
  } finally {
    if (cache.request === request) cache.request = undefined;
  }
}

async function requestFavoriteVideos(folderId: string): Promise<FavoriteVideo[]> {
  const response = await sendMessage({
    type: "BILI_FILTER_GET_FAVORITE_VIDEOS",
    payload: { folderId },
  });
  if (!response) throw new Error("扩展后台不可用");
  if (!response.ok) throw new Error(response.error);
  if (!("favoriteFolder" in response)) throw new Error("收藏夹响应格式无效");
  return response.favoriteFolder.videos;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
