import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: false,
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/content/index.ts"),
      formats: ["iife"],
      name: "BiliManagerContent",
      fileName: () => "assets/content.js",
    },
  },
});
