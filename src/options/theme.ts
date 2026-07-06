import { useEffect, useState } from "react";
import type { ExtensionSettings } from "../shared/types";

export type ThemePalette = ReturnType<typeof getThemePalette>;

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

// 设置页集中样式 token；暗色态统一使用 Tailwind dark
export function getThemePalette() {
  return {
    page: "bg-[radial-gradient(circle_at_15%_12%,rgba(251,207,232,0.55),transparent_34%),radial-gradient(circle_at_82%_6%,rgba(191,219,254,0.62),transparent_32%),linear-gradient(135deg,#f8fbff_0%,#eef7ff_48%,#fff1f8_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_15%_12%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_82%_6%,rgba(244,114,182,0.16),transparent_32%),linear-gradient(135deg,#07111f_0%,#111827_52%,#1e1b2e_100%)] dark:text-slate-100",
    header:
      "mb-4 flex flex-wrap items-start justify-between gap-4 rounded-md border border-white/70 bg-white/55 px-4 py-4 shadow-[0_18px_80px_rgba(59,130,246,0.14)] backdrop-blur-xl transition-colors duration-300 ease-out sm:px-5 lg:mb-6 dark:border-white/10 dark:bg-slate-950/45 dark:shadow-[0_18px_80px_rgba(15,23,42,0.3)]",
    brandText: "text-slate-950 dark:text-white",
    sideNav:
      "flex h-fit gap-2 overflow-x-auto rounded-md border border-white/70 bg-white/45 p-2 shadow-sm backdrop-blur-xl transition-colors duration-300 ease-out xl:sticky xl:top-4 xl:flex-col xl:overflow-visible dark:border-white/10 dark:bg-slate-950/35",
    sideNavItem:
      "flex min-w-28 items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-600 transition-colors duration-300 ease-out hover:bg-white/60 hover:text-slate-900 xl:w-full xl:min-w-0 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-slate-100",
    sideNavItemActive:
      "flex min-w-28 items-center gap-2 rounded bg-sky-100 px-3 py-2 text-left text-sm font-medium text-sky-700 shadow-sm shadow-sky-100/80 transition-colors duration-300 ease-out xl:w-full xl:min-w-0 dark:bg-sky-400/15 dark:text-sky-200 dark:shadow-sky-950/20",
    panel:
      "rounded-md border border-white/70 bg-white/55 shadow-[0_18px_80px_rgba(59,130,246,0.14)] backdrop-blur-xl transition-colors duration-300 ease-out dark:border-white/10 dark:bg-slate-950/45 dark:shadow-[0_18px_80px_rgba(15,23,42,0.28)]",
    categoryHeader:
      "flex items-center justify-between gap-4 border-b border-white/70 px-4 py-4 transition-colors duration-300 ease-out sm:px-5 dark:border-white/10",
    sectionHeader:
      "flex flex-wrap items-center justify-between gap-4 px-4 py-4 transition-colors duration-300 ease-out sm:px-5",
    contentWrap: "flex w-full flex-wrap items-center justify-between gap-4",
    contentNotice: "mx-5 mb-5",
    heading: "text-slate-950 transition-colors duration-300 ease-out dark:text-white",
    label: "text-slate-800 transition-colors duration-300 ease-out dark:text-slate-100",
    mutedText: "text-slate-600 transition-colors duration-300 ease-out dark:text-slate-400",
    secondaryButton:
      "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors duration-300 ease-out hover:bg-sky-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-sky-300/10",
    notice:
      "rounded-md border border-sky-100 bg-sky-50/75 px-3 py-2 text-sm text-sky-800 transition-colors duration-300 ease-out dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100",
    textInput:
      "min-w-0 flex-1 rounded-md border border-slate-200 bg-white/75 px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-300 ease-out placeholder:text-slate-400 focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-300",
    numberInputGroup:
      "flex w-28 overflow-hidden rounded-md border border-slate-200 bg-white/75 shadow-sm transition-colors duration-300 ease-out focus-within:border-sky-400 dark:border-white/10 dark:bg-slate-950/45 dark:focus-within:border-sky-300",
    numberInputField:
      "min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-right text-sm text-slate-900 outline-none dark:text-slate-100",
    numberSuffix: "flex w-6 items-center justify-center text-sm text-slate-500 dark:text-slate-400",
    numberStepper:
      "flex w-7 flex-col border-l border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.04]",
    numberStepButton:
      "flex flex-1 items-center justify-center text-slate-500 transition-colors duration-300 ease-out hover:bg-sky-50 hover:text-sky-600 dark:text-slate-400 dark:hover:bg-sky-300/10 dark:hover:text-sky-200",
    addButton:
      "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-300 ease-out hover:bg-sky-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto dark:border-sky-300/30 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300 dark:disabled:border-white/10 dark:disabled:bg-slate-700 dark:disabled:text-slate-400",
    toggleRow:
      "flex w-full items-center justify-between gap-4 rounded-md border border-slate-200 bg-white/65 px-3 py-3 text-left text-sm text-slate-800 shadow-sm transition-colors duration-300 ease-out hover:bg-white/85 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15",
    toggleRowDisabled:
      "border-slate-200 bg-slate-100/55 text-slate-500 hover:border-slate-200 hover:bg-slate-100/55 dark:border-white/5 dark:bg-white/[0.04] dark:text-slate-500 dark:opacity-70 dark:hover:border-white/5 dark:hover:bg-white/[0.04]",
    toggleGroup:
      "overflow-hidden rounded-md border border-slate-200 bg-white/65 shadow-sm transition-colors duration-300 ease-out dark:border-white/10 dark:bg-white/10",
    toggleGroupRow:
      "flex w-full items-center justify-between gap-4 px-3 py-3 text-left text-sm text-slate-800 transition-colors duration-300 ease-out hover:bg-white/85 dark:text-slate-100 dark:hover:bg-white/[0.05]",
    toggleGroupDivider: "border-t border-slate-200 dark:border-white/10",
    toggleGroupRowDisabled:
      "bg-slate-100/55 text-slate-500 hover:bg-slate-100/55 dark:bg-white/[0.03] dark:text-slate-500 dark:opacity-75 dark:hover:bg-white/[0.03]",
    ruleChip:
      "inline-flex items-center gap-1.5 rounded-md border border-white/80 bg-white/75 px-2 py-1 text-xs text-slate-700 shadow-sm transition-colors duration-300 ease-out dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
    ruleDeleteButton:
      "text-slate-400 transition-colors duration-300 ease-out hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-300",
  };
}
