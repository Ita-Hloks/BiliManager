import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
        contentStyle: resolve(__dirname, "src/content/style.css"),
      },
      output: {
        entryFileNames: chunk => {
          if (chunk.name === "background") return "assets/background.js";
          if (chunk.name === "content") return "assets/content.js";
          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: assetInfo => {
          if (assetInfo.name === "contentStyle.css") return "assets/content.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
