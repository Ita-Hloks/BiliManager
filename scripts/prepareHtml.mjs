import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

await copyFile(resolve(root, "src/popup/index.html"), resolve(root, "popup.html"));
await copyFile(resolve(root, "src/options/index.html"), resolve(root, "options.html"));
