import { addBlockedTag } from "../../shared/tagBlocklist";
import type { TagIdentity } from "../../shared/tagBlocklist";

export async function blockTag(tag: TagIdentity): Promise<void> {
  await addBlockedTag(tag);
}
