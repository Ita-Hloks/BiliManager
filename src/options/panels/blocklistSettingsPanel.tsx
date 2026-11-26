import { ListFilter, UserX } from "lucide-react";
import type { MouseEvent } from "react";
import { useRef, useState } from "react";
import type { SearchFilterSettings } from "../../shared/types";
import type { BlockedUploader } from "../../shared/uploaderBlocklist";
import { BlocklistManagerDialog } from "../components/blocklistManagerDialog";
import type { BlocklistPanelItem } from "../components/blocklistManagerDialog";
import { Button } from "../components/button";
import { RuleListEditor } from "../components/ruleListEditor";
import { SettingRow, SettingSection } from "../components/settingPrimitives";

type ManagerId = "uploader";
type BlocklistPatternSettings = Pick<SearchFilterSettings, "titlePattern" | "uploaderPattern">;

export function BlocklistSettingsPanel(props: {
  searchFilter: BlocklistPatternSettings;
  uploaderBlocklist: BlockedUploader[];
  onSearchFilterChange: (patch: Partial<BlocklistPatternSettings>) => void;
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
          closeLabel: "关闭已屏蔽 UP 主",
          countUnit: "位 UP 主",
          dialogTitle: "已屏蔽 UP 主",
          emptyText: "没有找到匹配的 UP 主",
          items: uploaderItems,
          searchLabel: "搜索已屏蔽 UP 主",
          searchPlaceholder: "搜索 UP 主名字或 UID",
          onRemove: props.onUploaderRemove,
        }
      : null;

  function openManager(manager: ManagerId, event: MouseEvent<HTMLButtonElement>) {
    previousFocusRef.current = event.currentTarget;
    setActiveManager(manager);
  }

  return (
    <>
      <SettingSection
        description="按标题关键词、UP 主名或黑名单屏蔽，不受上方过滤开关影响"
        icon={<UserX className="h-4 w-4" />}
        id="blocklist"
        title="屏蔽规则"
      >
        <SettingRow
          description="标题包含这些词的视频会被遮住；支持用 | 一次添加多个，也支持正则"
          title="标题屏蔽词"
        >
          <RuleListEditor
            placeholder="输入关键词按回车添加，例如：震惊 | 迷惑行为 | 营销号"
            value={props.searchFilter.titlePattern}
            onChange={titlePattern => props.onSearchFilterChange({ titlePattern })}
          />
        </SettingRow>

        <SettingRow description="名字包含这些词的 UP 主会被屏蔽，支持正则" title="UP 主名称屏蔽词">
          <RuleListEditor
            placeholder="输入关键词按回车添加，例如：影视解说 | 搬运"
            value={props.searchFilter.uploaderPattern}
            onChange={uploaderPattern => props.onSearchFilterChange({ uploaderPattern })}
          />
        </SettingRow>

        <SettingRow
          control={
            <Button
              disabled={uploaderItems.length === 0}
              icon={<ListFilter className="h-4 w-4" />}
              onClick={event => openManager("uploader", event)}
            >
              查看与管理
            </Button>
          }
          description={
            props.uploaderBlocklist.length > 0
              ? `已屏蔽 ${props.uploaderBlocklist.length} 位 UP 主，可在弹窗中搜索或取消屏蔽`
              : "在搜索结果卡片右下角点「屏蔽」，就能把不想看的 UP 主加进来"
          }
          title="已屏蔽 UP 主"
        />
      </SettingSection>

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
