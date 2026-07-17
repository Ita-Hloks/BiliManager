import type { FavoriteFolderResult, FavoriteVideo } from "../shared/favoriteFolder";

const FAVORITE_LIST_ENDPOINT = "https://api.bilibili.com/x/v3/fav/resource/list";
const PAGE_SIZE = 20;
const MAX_PAGE_COUNT = 100;
const INVALID_TITLES = new Set(["已失效视频", "视频已失效"]);

type FavoriteResourceRecord = {
  id?: number | string;
  attr?: number;
  title?: string;
  cover?: string;
  bvid?: string;
  bv_id?: string;
  upper?: {
    name?: string;
  } | null;
};

type FavoriteListResponse = {
  code?: number;
  message?: string;
  data?: {
    medias?: FavoriteResourceRecord[] | null;
    has_more?: boolean;
  } | null;
};

export async function fetchFavoriteVideos(folderId: string): Promise<FavoriteFolderResult> {
  if (!/^\d+$/.test(folderId)) throw new Error("收藏夹 ID 无效");

  const videos = new Map<string, FavoriteVideo>();

  for (let pageNumber = 1; pageNumber <= MAX_PAGE_COUNT; pageNumber += 1) {
    const page = await fetchFavoritePage(folderId, pageNumber);
    const medias = (page.data?.medias ?? []).filter(isFavoriteResourceRecord);

    for (const media of medias) {
      const video = toFavoriteVideo(media);
      if (video) videos.set(video.bvid || video.id, video);
    }

    if (!page.data?.has_more || medias.length < PAGE_SIZE) break;
  }

  return {
    folderId,
    videos: [...videos.values()],
  };
}

async function fetchFavoritePage(
  folderId: string,
  pageNumber: number,
): Promise<FavoriteListResponse> {
  const url = new URL(FAVORITE_LIST_ENDPOINT);
  url.search = new URLSearchParams({
    media_id: folderId,
    pn: pageNumber.toString(),
    ps: PAGE_SIZE.toString(),
    keyword: "",
    order: "mtime",
    type: "0",
    tid: "0",
    platform: "web",
  }).toString();

  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`收藏夹请求失败：HTTP ${response.status}`);

  const payload = await response.json();
  if (!isFavoriteListResponse(payload)) throw new Error("收藏夹响应格式无效");
  if (payload.code !== 0) {
    throw new Error(payload.message || `收藏夹请求失败：${payload.code ?? "未知错误"}`);
  }

  return payload;
}

function isFavoriteListResponse(value: unknown): value is FavoriteListResponse {
  if (!value || typeof value !== "object") return false;

  const response = value as FavoriteListResponse;
  if (typeof response.code !== "number") return false;
  if (response.data === undefined || response.data === null) return true;
  if (typeof response.data !== "object") return false;
  return (
    response.data.medias === undefined ||
    response.data.medias === null ||
    Array.isArray(response.data.medias)
  );
}

function isFavoriteResourceRecord(value: unknown): value is FavoriteResourceRecord {
  return !!value && typeof value === "object";
}

function toFavoriteVideo(resource: FavoriteResourceRecord): FavoriteVideo | null {
  const id = resource.id === undefined ? "" : String(resource.id);
  const bvid = (resource.bvid || resource.bv_id || "").trim().toUpperCase();
  const title = resource.title?.trim() ?? "";
  if ((!id && !bvid) || !title || resource.attr === 9 || INVALID_TITLES.has(title)) return null;

  return {
    id,
    bvid,
    title,
    coverUrl: resource.cover?.trim() ?? "",
    uploader: resource.upper?.name?.trim() ?? "",
  };
}
