import { useEffect, useState } from "react";
import type { ExtensionSettings } from "../shared/types";

// 解析用户主题选择；system 模式会订阅系统色彩变化，让设置页即时跟随。
export function useEffectiveDarkTheme(theme: ExtensionSettings["theme"]) {
  const [systemDark, setSystemDark] = useState(() => getSystemDarkTheme());

  useEffect(() => {
    if (!window.matchMedia) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => setSystemDark(media.matches);

    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  return theme === "dark" || (theme === "system" && systemDark);
}

function getSystemDarkTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}
