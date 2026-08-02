import { Tag } from "lucide-react";
import type { BlockedTag } from "../../shared/tagBlocklist";
import { BlocklistPanel } from "../components/blocklistPanel";

export function TagBlockPanel(props: { blocklist: BlockedTag[]; onRemove: (id: string) => void }) {
  return (
    <BlocklistPanel
      closeLabel="关闭 TAG 拦截管理"
      countUnit="个 TAG"
      dialogTitle="已拦截 TAG"
      emptyText="没有匹配的 TAG"
      icon={<Tag className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />}
      id="tag-block"
      items={props.blocklist.map(tag => ({
        id: tag.id,
        primary: `#${tag.name}`,
        searchText: tag.name,
        removeLabel: tag.name,
      }))}
      searchLabel="搜索已拦截 TAG"
      searchPlaceholder="搜索 TAG 名称"
      title="TAG 拦截"
      onRemove={props.onRemove}
    />
  );
}
