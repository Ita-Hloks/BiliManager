import { Folder, Link2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";

export type FavoriteFolderRefreshResult =
  | { folderId: string; ok: true; videoCount: number }
  | { folderId: string; ok: false; error: string };

// 收藏夹输入统一在 UI 边界解析为纯数字 ID，避免把链接格式带入存储和后台消息。
export function parseFavoriteFolderId(value: string): string | null {
  const input = value.trim();
  if (/^\d+$/.test(input)) return input;

  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (isBilibiliHost(url.hostname)) {
      const queryId = url.searchParams.get("fid");
      if (queryId && /^\d+$/.test(queryId)) return queryId;

      const pathId = url.pathname.match(/(?:^|\/)ml(\d+)(?:\/|$)/i)?.[1];
      if (pathId) return pathId;
    }
  } catch {
    // 粘贴 `fid=123` 这类未完整展开的链接时继续使用下面的兼容解析。
  }

  const fid = input.match(/(?:^|[?&#\s])fid=(\d+)/i)?.[1];
  return fid ?? null;
}

export function FavoriteFolderManager(props: {
  folderIds: string[];
  onChange: (folderIds: string[]) => void;
  onRefresh: (folderIds: string[]) => Promise<FavoriteFolderRefreshResult[]>;
}) {
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshResults, setRefreshResults] = useState<Record<string, FavoriteFolderRefreshResult>>(
    {},
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  function addFolder() {
    const folderId = parseFavoriteFolderId(draft);
    if (!folderId) {
      setInputError("请输入数字 ID，或粘贴包含 fid 参数的收藏夹链接");
      return;
    }
    if (props.folderIds.includes(folderId)) {
      setInputError(`收藏夹 ID ${folderId} 已添加`);
      return;
    }

    props.onChange([...props.folderIds, folderId]);
    setDraft("");
    setInputError("");
    setRefreshMessage("");
  }

  function removeFolder(folderId: string) {
    props.onChange(props.folderIds.filter(id => id !== folderId));
    setRefreshResults(current => {
      const next = { ...current };
      delete next[folderId];
      return next;
    });
    setRefreshMessage("");
  }

  async function refreshFolders() {
    if (isRefreshing) return;
    if (props.folderIds.length === 0) {
      setRefreshMessage("请先添加至少一个收藏夹 ID");
      return;
    }

    setIsRefreshing(true);
    setRefreshMessage("");
    try {
      const results = await props.onRefresh(props.folderIds);
      setRefreshResults(
        results.reduce<Record<string, FavoriteFolderRefreshResult>>((resultMap, result) => {
          resultMap[result.folderId] = result;
          return resultMap;
        }, {}),
      );
      const successCount = results.filter(result => result.ok).length;
      setRefreshMessage(`已获取 ${successCount}/${results.length} 个收藏夹的视频`);
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "收藏夹获取失败");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="favorite-folder-input">
          收藏夹 ID 或链接
        </label>
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="favorite-folder-input"
            aria-describedby={inputError ? "favorite-folder-input-error" : undefined}
            className="bm-text-input w-full pl-9"
            inputMode="numeric"
            placeholder="输入收藏夹 ID 或粘贴链接"
            type="text"
            value={draft}
            onChange={event => {
              setDraft(event.target.value);
              if (inputError) setInputError("");
            }}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addFolder();
            }}
          />
        </div>
        <Button
          aria-label="添加收藏夹"
          className="shrink-0 sm:w-auto"
          disabled={!draft.trim()}
          icon={<Plus className="h-4 w-4" />}
          size="full"
          variant="primary"
          onClick={addFolder}
        >
          添加收藏夹
        </Button>
      </div>

      {inputError && (
        <p
          id="favorite-folder-input-error"
          className="text-xs text-rose-600 dark:text-rose-300"
          role="alert"
        >
          {inputError}
        </p>
      )}

      {props.folderIds.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-[#30343c] dark:border-[#30343c]">
          {props.folderIds.map((folderId, index) => {
            const result = refreshResults[folderId];
            return (
              <li
                key={folderId}
                className="flex min-w-0 items-start justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="bm-text-label flex items-center gap-2 text-sm font-medium">
                    <Folder className="h-4 w-4 shrink-0 text-bili-blue" />
                    收藏夹 {index + 1}
                  </p>
                  <p className="bm-text-muted mt-1 truncate pl-6 text-xs">ID {folderId}</p>
                  {result && (
                    <p
                      className={
                        result.ok
                          ? "mt-1 pl-6 text-xs text-emerald-600 dark:text-emerald-300"
                          : "mt-1 pl-6 text-xs text-rose-600 dark:text-rose-300"
                      }
                      role={result.ok ? undefined : "alert"}
                    >
                      {result.ok ? `已获取 ${result.videoCount} 个视频` : result.error}
                    </p>
                  )}
                </div>
                <Button
                  aria-label={`删除收藏夹 ${folderId}`}
                  className="h-8 w-8 shrink-0"
                  icon={<Trash2 className="h-4 w-4" />}
                  size="sm"
                  title="删除收藏夹"
                  variant="icon"
                  onClick={() => removeFolder(folderId)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bm-text-muted rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm dark:border-[#30343c]">
          尚未添加收藏夹
        </p>
      )}

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <Button
          disabled={isRefreshing || props.folderIds.length === 0}
          icon={<RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
          size="full"
          variant="secondary"
          onClick={() => void refreshFolders()}
        >
          {isRefreshing ? "获取中" : "获取收藏夹视频"}
        </Button>
        {refreshMessage && (
          <span className="bm-text-muted text-xs" role="status">
            {refreshMessage}
          </span>
        )}
      </div>
    </div>
  );
}

function isBilibiliHost(hostname: string): boolean {
  return hostname === "bilibili.com" || hostname.endsWith(".bilibili.com");
}
