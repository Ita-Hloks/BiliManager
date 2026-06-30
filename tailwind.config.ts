import type { Config } from "tailwindcss";

export default {
  content: ["./popup.html", "./options.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bili: {
          blue: "#00a1d6",
          pink: "#fb7299",
          ink: "#15161a"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
