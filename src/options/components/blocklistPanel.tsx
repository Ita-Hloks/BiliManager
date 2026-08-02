import { ChevronLeft, ChevronRight, ListFilter, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

const PAGE_SIZE = 30;

export type BlocklistPanelItem = {
  id: string;
  primary: string;
  secondary?: string;
  searchText: string;
  removeLabel: string;
};

export function BlocklistPanel(props: {
  id: string;
  title: string;
  icon: ReactNode;
  countUnit: string;
  dialogTitle: string;
  closeLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  items: BlocklistPanelItem[];
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
    if (!keyword) return props.items;
    return props.items.filter(item => item.searchText.toLocaleLowerCase("zh-CN").includes(keyword));
  }, [props.items, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
      <section id={props.id} className="bm-panel scroll-mt-6">
        <div className="bm-section-header">
          <div className="flex items-start gap-3">
            {props.icon}
            <div>
              <h2 className="bm-text-heading text-base font-medium">{props.title}</h2>
              <p className="bm-text-muted mt-1 text-sm">
                已拦截 {props.items.length} {props.countUnit}
              </p>
            </div>
          </div>
          <Button
            disabled={props.items.length === 0}
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
              aria-label={props.dialogTitle}
              aria-modal="true"
              className="flex max-h-[calc(100vh-2rem)] min-h-96 w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-[#30343c] dark:bg-[#1c1f26]"
              role="dialog"
            >
              <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 dark:border-[#30343c]">
                <div className="min-w-0">
                  <h3 className="bm-text-heading text-sm font-semibold">{props.dialogTitle}</h3>
                  <p className="bm-text-muted mt-0.5 text-xs">
                    {props.items.length} {props.countUnit}
                  </p>
                </div>
                <button
                  aria-label={props.closeLabel}
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
                    aria-label={props.searchLabel}
                    className="bm-text-input w-full pl-9"
                    placeholder={props.searchPlaceholder}
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
                {visibleItems.map(item => (
                  <div
                    key={item.id}
                    className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="bm-text-label truncate text-sm font-medium">{item.primary}</p>
                      {item.secondary && (
                        <p className="bm-text-muted mt-0.5 truncate text-xs">{item.secondary}</p>
                      )}
                    </div>
                    <button
                      aria-label={`解除屏蔽 ${item.removeLabel}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:text-slate-500 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
                      title="解除屏蔽"
                      type="button"
                      onClick={() => props.onRemove(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {visibleItems.length === 0 && (
                  <p className="bm-text-muted px-4 py-12 text-center text-sm">{props.emptyText}</p>
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
