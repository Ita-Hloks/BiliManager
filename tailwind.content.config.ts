import type { Config } from "tailwindcss";
import baseConfig from "./tailwind.config";

export default {
  ...baseConfig,
  prefix: "bm-",
  content: ["./src/content/**/*.{ts,tsx}"],
} satisfies Config;
