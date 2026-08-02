import { addBlockedUploader } from "../../shared/uploaderBlocklist";
import type { UploaderIdentity } from "../../shared/uploaderBlocklist";

export async function blockUploader(uploader: UploaderIdentity): Promise<void> {
  await addBlockedUploader(uploader);
}
