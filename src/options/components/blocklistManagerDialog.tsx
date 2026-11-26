import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type BlocklistManagerDialogProps = {
  closeLabel: string;
  countUnit: string;
  dialogTitle: string;
  emptyText: string;
  items: BlocklistPanelItem[];
  returnFocusRef?: RefObject<HTMLElement | null>;
  searchLabel: string;
  searchPlaceholder: string;
  onClose: () => void;
  onRemove: (id: string) => void;
};

export function BlocklistManagerDialog(props: BlocklistManagerDialogProps) {
  const { onClose, returnFocusRef } = props;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const closeDialog = useCallback(() => {
    setQuery("");
    setPage(1);
    onClose();
    window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }, [onClose, returnFocusRef]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    if (!keyword) return props.items;
    return props.items.filter(item => item.searchText.toLocaleLowerCase("zh-CN").includes(keyword));
  }, [props.items, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
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
  }, [closeDialog]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        ref={dialogRef}
        aria-label={props.dialogTitle}
        aria-modal="true"
        className="flex max-h-[calc(100vh-2rem)] min-h-96 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--bm-border)] bg-[var(--bm-surface)] shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[var(--bm-divider)] px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="bm-text-heading text-sm font-semibold">{props.dialogTitle}</h3>
            <p className="bm-text-muted mt-0.5 text-xs">
              {props.items.length} {props.countUnit}
            </p>
          </div>
          <button
            aria-label={props.closeLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--bm-text-tertiary)] transition-colors hover:bg-[var(--bm-surface-hover)] hover:text-[var(--bm-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
            type="button"
            onClick={closeDialog}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-[var(--bm-divider)] px-5 py-3.5">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bm-text-tertiary)]" />
            <input
              ref={searchInputRef}
              aria-label={props.searchLabel}
              className="bm-text-input w-full pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
              placeholder={props.searchPlaceholder}
              type="search"
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            {query.length > 0 && (
              <button
                aria-label="清空搜索"
                className="absolute right-2 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--bm-text-tertiary)] transition-colors hover:bg-[var(--bm-surface-hover)] hover:text-[var(--bm-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
                type="button"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                  searchInputRef.current?.focus();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="bm-scrollbar min-h-0 flex-1 divide-y divide-[var(--bm-divider)] overflow-y-auto">
          {visibleItems.map(item => (
            <div
              key={item.id}
              className="flex min-w-0 items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--bm-surface-hover)]"
            >
              <div className="min-w-0">
                <p className="bm-text-label truncate text-sm font-medium">{item.primary}</p>
                {item.secondary && (
                  <p className="bm-text-muted mt-0.5 truncate text-xs">{item.secondary}</p>
                )}
              </div>
              <button
                aria-label={`解除屏蔽 ${item.removeLabel}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--bm-text-tertiary)] transition-colors hover:bg-rose-500/10 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
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
          <footer className="flex items-center justify-between gap-4 border-t border-[var(--bm-divider)] px-5 py-3">
            <span className="bm-text-muted text-xs tabular-nums">
              {safePage} / {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <Button
                aria-label="上一页"
                disabled={safePage <= 1}
                icon={<ChevronLeft className="h-4 w-4" />}
                size="sm"
                variant="icon"
                onClick={() => setPage(Math.max(1, safePage - 1))}
              />
              <Button
                aria-label="下一页"
                disabled={safePage >= pageCount}
                icon={<ChevronRight className="h-4 w-4" />}
                size="sm"
                variant="icon"
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
              />
            </div>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
