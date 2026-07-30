import { Search, UserX, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { BlockedUploader } from "../../shared/uploaderBlocklist";

export function UploaderBlockPanel(props: {
  blocklist: BlockedUploader[];
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    if (!keyword) return props.blocklist;
    return props.blocklist.filter(
      uploader =>
        uploader.name.toLocaleLowerCase("zh-CN").includes(keyword) ||
        uploader.mid.includes(keyword),
    );
  }, [props.blocklist, query]);

  return (
    <section id="uploader-block" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <div className="flex items-start gap-3">
          <UserX className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
          <div>
            <h2 className="bm-text-heading text-base font-medium">UP 拦截</h2>
            <p className="bm-text-muted mt-1 text-sm">已拦截 {props.blocklist.length} 个 UP</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            aria-label="搜索已拦截 UP"
            className="bm-text-input w-full pl-9"
            placeholder="搜索 UP 名称或 UID"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>

        <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-[#30343c] dark:border-[#30343c]">
          {filtered.map(uploader => (
            <div
              key={uploader.id}
              className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="bm-text-label truncate text-sm font-medium">{uploader.name}</p>
                {uploader.mid && (
                  <p className="bm-text-muted mt-0.5 truncate text-xs">UID {uploader.mid}</p>
                )}
              </div>
              <button
                aria-label={`解除屏蔽 ${uploader.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:text-slate-500 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
                title="解除屏蔽"
                type="button"
                onClick={() => props.onRemove(uploader.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="bm-text-muted px-3 py-8 text-center text-sm">
              {props.blocklist.length === 0 ? "暂无已拦截 UP" : "没有匹配的 UP"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
