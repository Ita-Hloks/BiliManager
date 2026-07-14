import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./popup.html", "./options.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bili: {
          blue: "#00aeec",
          pink: "#fb7299",
          ink: "#15161a",
          canvas: "#f7f9fc",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
