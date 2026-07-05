import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import prettier from "prettier";

const root = process.cwd();
await mkdir(resolve(root, "dist"), { recursive: true });
await copyFile(resolve(root, "manifest.json"), resolve(root, "dist/manifest.json"));
await mkdir(resolve(root, "dist/assets"), { recursive: true });
await copyFile(resolve(root, "src/content/style.css"), resolve(root, "dist/assets/content.css"));

// Chrome users often select the project folder instead of dist/.
await rm(resolve(root, "assets"), { recursive: true, force: true });
await mkdir(resolve(root, "assets"), { recursive: true });
await copyFile(resolve(root, "dist/popup.html"), resolve(root, "popup.html"));
await copyFile(resolve(root, "dist/options.html"), resolve(root, "options.html"));
await formatHtml(resolve(root, "popup.html"));
await formatHtml(resolve(root, "options.html"));

const assetFiles = await readdir(resolve(root, "dist/assets"));

for (const file of assetFiles) {
  await copyFile(resolve(root, `dist/assets/${file}`), resolve(root, `assets/${file}`));
}

await copyFile(resolve(root, "src/content/style.css"), resolve(root, "assets/content.css"));

async function formatHtml(filePath) {
  const config = await prettier.resolveConfig(filePath);
  const input = await import("node:fs/promises").then(fs => fs.readFile(filePath, "utf8"));
  const output = await prettier.format(input, { ...config, filepath: filePath });
  await import("node:fs/promises").then(fs => fs.writeFile(filePath, output));
}
