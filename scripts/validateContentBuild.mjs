import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const contentPath = resolve(process.cwd(), "dist/assets/content.js");
const content = await readFile(contentPath, "utf8");

if (/^\s*(?:import|export)\b/m.test(content)) {
  throw new Error("content.js 包含浏览器 content script 不支持的顶层模块语法");
}

if (!content.trim()) {
  throw new Error("content.js 构建产物为空");
}
