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

// 设置页的集中样式 token，面板只消费 palette，避免大段主题 class 回流到 main.tsx。
export function getThemePalette(isDark: boolean) {
  if (isDark) {
    return {
      page: "bg-[radial-gradient(circle_at_15%_12%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_82%_6%,rgba(244,114,182,0.16),transparent_32%),linear-gradient(135deg,#07111f_0%,#111827_52%,#1e1b2e_100%)] text-slate-100",
      header:
        "mb-4 flex flex-wrap items-start justify-between gap-4 rounded-md border border-white/10 bg-slate-950/45 px-4 py-4 shadow-[0_18px_80px_rgba(15,23,42,0.3)] backdrop-blur-xl transition-colors duration-300 ease-out sm:px-5 lg:mb-6",
      headerBadge:
        "rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-slate-300",
      brandText: "text-white",
      sideNav:
        "flex h-fit gap-2 overflow-x-auto rounded-md border border-white/10 bg-slate-950/35 p-2 shadow-sm backdrop-blur-xl transition-colors duration-300 ease-out xl:sticky xl:top-4 xl:flex-col xl:overflow-visible",
      sideNavItem:
        "flex min-w-28 items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-400 transition-colors duration-300 ease-out hover:bg-white/[0.08] hover:text-slate-100 xl:w-full xl:min-w-0",
      sideNavItemActive:
        "flex min-w-28 items-center gap-2 rounded bg-sky-400/15 px-3 py-2 text-left text-sm font-medium text-sky-200 shadow-sm shadow-sky-950/20 transition-colors duration-300 ease-out xl:w-full xl:min-w-0",
      panel:
        "rounded-md border border-white/10 bg-slate-950/45 shadow-[0_18px_80px_rgba(15,23,42,0.28)] backdrop-blur-xl transition-colors duration-300 ease-out",
      categoryHeader:
        "flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 transition-colors duration-300 ease-out sm:px-5",
      sectionHeader:
        "flex flex-wrap items-center justify-between gap-4 px-4 py-4 transition-colors duration-300 ease-out sm:px-5",
      contentWrap: "flex w-full flex-wrap items-center justify-between gap-4",
      contentNotice: "mx-5 mb-5",
      categoryFilterButton:
        "group flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 transition duration-300 ease-out hover:-translate-y-0.5",
      categoryFilterButtonEnabled: "text-sky-200",
      categoryFilterButtonDisabled: "text-slate-500 hover:text-slate-300",
      heading: "text-white transition-colors duration-300 ease-out",
      label: "text-slate-100 transition-colors duration-300 ease-out",
      mutedText: "text-slate-400 transition-colors duration-300 ease-out",
      secondaryButton:
        "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100 shadow-sm transition-colors duration-300 ease-out hover:bg-sky-300/10",
      notice:
        "rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-sm text-sky-100 transition-colors duration-300 ease-out",
      textInput:
        "min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-slate-100 outline-none transition-colors duration-300 ease-out placeholder:text-slate-500 focus:border-sky-300",
      numberInputGroup:
        "flex w-28 overflow-hidden rounded-md border border-white/10 bg-slate-950/45 shadow-sm transition-colors duration-300 ease-out focus-within:border-sky-300",
      numberInputField:
        "min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-right text-sm text-slate-100 outline-none",
      numberSuffix: "flex w-6 items-center justify-center text-sm text-slate-400",
      numberStepper: "flex w-7 flex-col border-l border-white/10 bg-white/[0.04]",
      numberStepButton:
        "flex flex-1 items-center justify-center text-slate-400 transition-colors duration-300 ease-out hover:bg-sky-300/10 hover:text-sky-200",
      addButton:
        "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-300/30 bg-sky-400 px-3 py-2 text-sm font-medium text-slate-950 shadow-sm transition-colors duration-300 ease-out hover:bg-sky-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto",
      toggleRow:
        "flex w-full items-center justify-between gap-4 rounded-md border border-white/10 bg-white/10 px-3 py-3 text-left text-sm text-slate-100 shadow-sm transition-colors duration-300 ease-out hover:bg-white/15",
      toggleRowDisabled:
        "border-white/5 bg-white/[0.04] text-slate-500 opacity-70 hover:border-white/5 hover:bg-white/[0.04]",
      toggleGroup:
        "overflow-hidden rounded-md border border-white/10 bg-white/10 shadow-sm transition-colors duration-300 ease-out",
      toggleGroupRow:
        "flex w-full items-center justify-between gap-4 px-3 py-3 text-left text-sm text-slate-100 transition-colors duration-300 ease-out hover:bg-white/[0.05]",
      toggleGroupDivider: "border-t border-white/10",
      toggleGroupRowDisabled: "bg-white/[0.03] text-slate-500 opacity-75 hover:bg-white/[0.03]",
      ruleChip:
        "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-xs text-slate-200 shadow-sm transition-colors duration-300 ease-out",
      ruleDeleteButton:
        "text-slate-500 transition-colors duration-300 ease-out hover:text-rose-300",
    };
  }

  return {
    page: "bg-[radial-gradient(circle_at_15%_12%,rgba(251,207,232,0.55),transparent_34%),radial-gradient(circle_at_82%_6%,rgba(191,219,254,0.62),transparent_32%),linear-gradient(135deg,#f8fbff_0%,#eef7ff_48%,#fff1f8_100%)] text-slate-900",
    header:
      "mb-4 flex flex-wrap items-start justify-between gap-4 rounded-md border border-white/70 bg-white/55 px-4 py-4 shadow-[0_18px_80px_rgba(59,130,246,0.14)] backdrop-blur-xl transition-colors duration-300 ease-out sm:px-5 lg:mb-6",
    headerBadge:
      "rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500",
    brandText: "text-slate-950",
    sideNav:
      "flex h-fit gap-2 overflow-x-auto rounded-md border border-white/70 bg-white/45 p-2 shadow-sm backdrop-blur-xl transition-colors duration-300 ease-out xl:sticky xl:top-4 xl:flex-col xl:overflow-visible",
    sideNavItem:
      "flex min-w-28 items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-600 transition-colors duration-300 ease-out hover:bg-white/60 hover:text-slate-900 xl:w-full xl:min-w-0",
    sideNavItemActive:
      "flex min-w-28 items-center gap-2 rounded bg-sky-100 px-3 py-2 text-left text-sm font-medium text-sky-700 shadow-sm shadow-sky-100/80 transition-colors duration-300 ease-out xl:w-full xl:min-w-0",
    panel:
      "rounded-md border border-white/70 bg-white/55 shadow-[0_18px_80px_rgba(59,130,246,0.14)] backdrop-blur-xl transition-colors duration-300 ease-out",
    categoryHeader:
      "flex items-center justify-between gap-4 border-b border-white/70 px-4 py-4 transition-colors duration-300 ease-out sm:px-5",
    sectionHeader:
      "flex flex-wrap items-center justify-between gap-4 px-4 py-4 transition-colors duration-300 ease-out sm:px-5",
    contentWrap: "flex w-full flex-wrap items-center justify-between gap-4",
    contentNotice: "mx-5 mb-5",
    categoryFilterButton:
      "group flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 transition duration-300 ease-out hover:-translate-y-0.5",
    categoryFilterButtonEnabled: "text-sky-600 hover:text-sky-700",
    categoryFilterButtonDisabled: "text-slate-400 hover:text-slate-600",
    heading: "text-slate-950 transition-colors duration-300 ease-out",
    label: "text-slate-800 transition-colors duration-300 ease-out",
    mutedText: "text-slate-600 transition-colors duration-300 ease-out",
    secondaryButton:
      "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors duration-300 ease-out hover:bg-sky-50",
    notice:
      "rounded-md border border-sky-100 bg-sky-50/75 px-3 py-2 text-sm text-sky-800 transition-colors duration-300 ease-out",
    textInput:
      "min-w-0 flex-1 rounded-md border border-slate-200 bg-white/75 px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-300 ease-out placeholder:text-slate-400 focus:border-sky-400",
    numberInputGroup:
      "flex w-28 overflow-hidden rounded-md border border-slate-200 bg-white/75 shadow-sm transition-colors duration-300 ease-out focus-within:border-sky-400",
    numberInputField:
      "min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-right text-sm text-slate-900 outline-none",
    numberSuffix: "flex w-6 items-center justify-center text-sm text-slate-500",
    numberStepper: "flex w-7 flex-col border-l border-slate-200 bg-slate-50/80",
    numberStepButton:
      "flex flex-1 items-center justify-center text-slate-500 transition-colors duration-300 ease-out hover:bg-sky-50 hover:text-sky-600",
    addButton:
      "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-300 ease-out hover:bg-sky-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto",
    toggleRow:
      "flex w-full items-center justify-between gap-4 rounded-md border border-slate-200 bg-white/65 px-3 py-3 text-left text-sm text-slate-800 shadow-sm transition-colors duration-300 ease-out hover:bg-white/85",
    toggleRowDisabled:
      "border-slate-200 bg-slate-100/55 text-slate-500 hover:border-slate-200 hover:bg-slate-100/55",
    toggleGroup:
      "overflow-hidden rounded-md border border-slate-200 bg-white/65 shadow-sm transition-colors duration-300 ease-out",
    toggleGroupRow:
      "flex w-full items-center justify-between gap-4 px-3 py-3 text-left text-sm text-slate-800 transition-colors duration-300 ease-out hover:bg-white/85",
    toggleGroupDivider: "border-t border-slate-200",
    toggleGroupRowDisabled: "bg-slate-100/55 text-slate-500 hover:bg-slate-100/55",
    ruleChip:
      "inline-flex items-center gap-1.5 rounded-md border border-white/80 bg-white/75 px-2 py-1 text-xs text-slate-700 shadow-sm transition-colors duration-300 ease-out",
    ruleDeleteButton: "text-slate-400 transition-colors duration-300 ease-out hover:text-rose-500",
  };
}
