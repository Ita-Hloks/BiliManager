import { copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
await mkdir(resolve(root, "dist"), { recursive: true });
await copyFile(resolve(root, "manifest.json"), resolve(root, "dist/manifest.json"));

// Chrome users often select the project folder instead of dist/.
await rm(resolve(root, "assets"), { recursive: true, force: true });
await mkdir(resolve(root, "assets"), { recursive: true });
await copyFile(resolve(root, "dist/popup.html"), resolve(root, "popup.html"));
await copyFile(resolve(root, "dist/options.html"), resolve(root, "options.html"));

const assetFiles = [
  "background.js",
  "content.css",
  "content.js",
  "options.js",
  "popup.js",
  "storage.css",
  "storage.js",
];

for (const file of assetFiles) {
  await copyFile(resolve(root, `dist/assets/${file}`), resolve(root, `assets/${file}`));
}
