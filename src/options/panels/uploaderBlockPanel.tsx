import { ChevronLeft, ChevronRight, ListFilter, Search, UserX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BlockedUploader } from "../../shared/uploaderBlocklist";
import { Button } from "../components/button";

const PAGE_SIZE = 30;

export function UploaderBlockPanel(props: {
  blocklist: BlockedUploader[];
  onRemove: (id: string) => void;
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    if (!keyword) return props.blocklist;
    return props.blocklist.filter(
      uploader =>
        uploader.name.toLocaleLowerCase("zh-CN").includes(keyword) ||
        uploader.mid.includes(keyword),
    );
  }, [props.blocklist, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleUploaders = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (!managerOpen) return;

    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeManager();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled)",
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.documentElement.classList.add("bm-dialog-open");
    document.addEventListener("keydown", handleDialogKeydown);
    searchInputRef.current?.focus();

    return () => {
      document.documentElement.classList.remove("bm-dialog-open");
      document.removeEventListener("keydown", handleDialogKeydown);
    };
  }, [managerOpen]);

  function openManager() {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setManagerOpen(true);
  }

  function closeManager() {
    setManagerOpen(false);
    setQuery("");
    setPage(1);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }

  return (
    <>
      <section id="uploader-block" className="bm-panel scroll-mt-6">
        <div className="bm-section-header">
          <div className="flex items-start gap-3">
            <UserX className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
            <div>
              <h2 className="bm-text-heading text-base font-medium">UP 拦截</h2>
              <p className="bm-text-muted mt-1 text-sm">已拦截 {props.blocklist.length} 个 UP</p>
            </div>
          </div>
          <Button
            disabled={props.blocklist.length === 0}
            icon={<ListFilter className="h-4 w-4" />}
            onClick={openManager}
            size="sm"
          >
            管理
          </Button>
        </div>
      </section>

      {managerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onMouseDown={event => {
              if (event.target === event.currentTarget) closeManager();
            }}
          >
            <section
              ref={dialogRef}
              aria-label="管理已拦截 UP"
              aria-modal="true"
              className="flex max-h-[calc(100vh-2rem)] min-h-96 w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-[#30343c] dark:bg-[#1c1f26]"
              role="dialog"
            >
              <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 dark:border-[#30343c]">
                <div className="min-w-0">
                  <h3 className="bm-text-heading text-sm font-semibold">已拦截 UP</h3>
                  <p className="bm-text-muted mt-0.5 text-xs">{props.blocklist.length} 个</p>
                </div>
                <button
                  aria-label="关闭 UP 拦截管理"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  type="button"
                  onClick={closeManager}
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="border-b border-slate-100 p-4 dark:border-[#30343c]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    aria-label="搜索已拦截 UP"
                    className="bm-text-input w-full pl-9"
                    placeholder="搜索 UP 名称或 UID"
                    type="search"
                    value={query}
                    onChange={event => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
              </div>

              <div className="bm-scrollbar min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-[#30343c]">
                {visibleUploaders.map(uploader => (
                  <div
                    key={uploader.id}
                    className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5"
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

                {visibleUploaders.length === 0 && (
                  <p className="bm-text-muted px-4 py-12 text-center text-sm">没有匹配的 UP</p>
                )}
              </div>

              {filtered.length > PAGE_SIZE && (
                <footer className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3 dark:border-[#30343c]">
                  <span className="bm-text-muted text-xs tabular-nums">
                    {safePage} / {pageCount}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label="上一页"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-sky-50 hover:text-bili-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-bili-blue/10 dark:hover:text-sky-200"
                      disabled={safePage <= 1}
                      type="button"
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="下一页"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-sky-50 hover:text-bili-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-bili-blue/10 dark:hover:text-sky-200"
                      disabled={safePage >= pageCount}
                      type="button"
                      onClick={() => setPage(Math.min(pageCount, safePage + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </footer>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
