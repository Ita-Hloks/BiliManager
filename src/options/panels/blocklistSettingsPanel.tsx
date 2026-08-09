import { ListFilter, UserX } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import type { BlockedUploader } from "../../shared/uploaderBlocklist";
import { BlocklistManagerDialog } from "../components/blocklistManagerDialog";
import type { BlocklistPanelItem } from "../components/blocklistManagerDialog";

type ManagerId = "uploader";

export function BlocklistSettingsPanel(props: {
  uploaderBlocklist: BlockedUploader[];
  onUploaderRemove: (id: string) => void;
}) {
  const [activeManager, setActiveManager] = useState<ManagerId | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const uploaderItems: BlocklistPanelItem[] = props.uploaderBlocklist.map(uploader => ({
    id: uploader.id,
    primary: uploader.name,
    secondary: uploader.mid ? `UID ${uploader.mid}` : undefined,
    searchText: `${uploader.name} ${uploader.mid}`,
    removeLabel: uploader.name,
  }));
  const activeDialog =
    activeManager === "uploader"
      ? {
          closeLabel: "关闭 UP 拦截管理",
          countUnit: "个 UP",
          dialogTitle: "已拦截 UP",
          emptyText: "没有匹配的 UP",
          items: uploaderItems,
          searchLabel: "搜索已拦截 UP",
          searchPlaceholder: "搜索 UP 名称或 UID",
          onRemove: props.onUploaderRemove,
        }
      : null;

  function openManager(manager: ManagerId, event: MouseEvent<HTMLButtonElement>) {
    previousFocusRef.current = event.currentTarget;
    setActiveManager(manager);
  }

  return (
    <>
      <section id="blocklist" className="bm-panel scroll-mt-6">
        <div className="bm-section-header">
          <div className="flex items-start gap-3">
            <UserX className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
            <div>
              <h2 className="bm-text-heading text-base font-medium">屏蔽列表</h2>
              <p className="bm-text-muted mt-1 text-sm">{props.uploaderBlocklist.length} 个 UP</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#30343c]">
          <BlocklistEntry
            count={props.uploaderBlocklist.length}
            disabled={uploaderItems.length === 0}
            icon={<UserX className="h-4 w-4" />}
            label="UP 拦截"
            unit="个 UP"
            onClick={event => openManager("uploader", event)}
          />
        </div>
      </section>

      {activeDialog && (
        <BlocklistManagerDialog
          {...activeDialog}
          returnFocusRef={previousFocusRef}
          onClose={() => setActiveManager(null)}
        />
      )}
    </>
  );
}

function BlocklistEntry(props: {
  count: number;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  unit: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-bili-blue/10"
      disabled={props.disabled}
      type="button"
      onClick={props.onClick}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-50 text-bili-blue dark:bg-bili-blue/10 dark:text-sky-200">
          {props.icon}
        </span>
        <span className="min-w-0">
          <span className="bm-text-label block text-sm font-medium">{props.label}</span>
          <span className="bm-text-muted mt-0.5 block text-xs">
            {props.count} {props.unit}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-bili-blue dark:text-sky-200">
        <ListFilter className="h-4 w-4" />
        管理
      </span>
    </button>
  );
}
