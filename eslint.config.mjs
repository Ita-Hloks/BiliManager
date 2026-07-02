import antfu from "@antfu/eslint-config";
import prettierConflicts from "eslint-config-prettier";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default antfu(
  {
    type: "app",
    react: true,
    typescript: true,
    stylistic: false,
    formatters: false,
    ignores: ["dist/**", "assets/**", "node_modules/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: "readonly",
      },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["vite.config.ts", "tailwind.config.ts", "scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      "jsonc/sort-keys": "off",
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "node/prefer-global/process": "off",
      "perfectionist/sort-imports": "off",
      "ts/consistent-type-definitions": "off",
      "ts/no-unused-vars": "off",
    },
  },
  prettierConflicts,
);
