import { UserX } from "lucide-react";
import type { BlockedUploader } from "../../shared/uploaderBlocklist";
import { BlocklistPanel } from "../components/blocklistPanel";

export function UploaderBlockPanel(props: {
  blocklist: BlockedUploader[];
  onRemove: (id: string) => void;
}) {
  return (
    <BlocklistPanel
      closeLabel="关闭 UP 拦截管理"
      countUnit="个 UP"
      dialogTitle="已拦截 UP"
      emptyText="没有匹配的 UP"
      icon={<UserX className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />}
      id="uploader-block"
      items={props.blocklist.map(uploader => ({
        id: uploader.id,
        primary: uploader.name,
        secondary: uploader.mid ? `UID ${uploader.mid}` : undefined,
        searchText: `${uploader.name} ${uploader.mid}`,
        removeLabel: uploader.name,
      }))}
      searchLabel="搜索已拦截 UP"
      searchPlaceholder="搜索 UP 名称或 UID"
      title="UP 拦截"
      onRemove={props.onRemove}
    />
  );
}
