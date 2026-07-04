import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Monitor,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import "../styles/globals.css";
import { defaultSettings, getSettings, saveSettings } from "../shared/storage";
import type {
  ExtensionSettings,
  PlayerPersonalizationSettings,
  SearchFilterSettings,
} from "../shared/types";

type ThemePalette = ReturnType<typeof getThemePalette>;
type SectionId = "search-filter" | "personalization" | "data";

function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [importMessage, setImportMessage] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("search-filter");
  const [filterAnimationKey, setFilterAnimationKey] = useState(0);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isDark = useEffectiveDarkTheme(settings.theme);
  const palette = getThemePalette(isDark);
  const ratePercent = toRatePercent(settings.searchFilter.minDanmakuViewRate);
  const rangeStyle = {
    "--bm-range-progress": `${ratePercent * 100}%`,
  } as React.CSSProperties;

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  async function updateSettings(next: ExtensionSettings) {
    setSettings(next);
    await saveSettings(next);
  }

  async function updateSearchFilter(patch: Partial<SearchFilterSettings>) {
    const enabled = patch.enabled ?? settings.searchFilter.enabled;
    await updateSettings({
      ...settings,
      features: {
        ...settings.features,
        searchFilter: enabled,
      },
      searchFilter: {
        ...settings.searchFilter,
        ...patch,
        enabled,
      },
    });
  }

  async function updatePersonalization(patch: Partial<PlayerPersonalizationSettings>) {
    const personalization = {
      ...settings.personalization,
      ...patch,
    };
    const enabled =
      personalization.blockRelatedVideos || personalization.disableRecommendationAutoplay;

    await updateSettings({
      ...settings,
      features: {
        ...settings.features,
        personalization: enabled,
      },
      personalization,
    });
  }

  async function updateTheme(theme: ExtensionSettings["theme"]) {
    await updateSettings({ ...settings, theme });
  }

  function toggleSearchFilter() {
    setFilterAnimationKey(key => key + 1);
    void updateSearchFilter({
      enabled: !settings.searchFilter.enabled,
    });
  }

  function stepRatePercent(delta: number) {
    const nextPercent = clamp(Number((ratePercent + delta).toFixed(2)), 0, 1);
    void updateSearchFilter({
      minDanmakuViewRate: fromRatePercent(nextPercent.toString()),
    });
  }

  function scrollToSection(sectionId: SectionId) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function importSettings(file: File) {
    try {
      const next = parseImportedSettings(await file.text(), settings);
      await updateSettings(next);
      setImportMessage("已导入完整配置");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function exportSettings() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `bili-manager-settings-${formatDateForFile(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setImportMessage("已导出完整配置");
  }

  return (
    <main
      className={`min-h-screen px-3 py-4 transition-colors duration-300 ease-out sm:px-4 lg:px-6 ${palette.page}`}
    >
      <div className="mx-auto w-full max-w-[80rem]">
        <header className={palette.header}>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-normal">
                <span className="text-bili-blue">Bili</span>{" "}
                <span className={palette.brandText}>Manager</span>
              </h1>
            </div>
            <p className={`mt-2 text-sm ${palette.mutedText}`}>
              规则会自动保存，并同步到已经打开的 B 站页面。
            </p>
          </div>
          <ThemeSwitch value={settings.theme} isDark={isDark} onChange={updateTheme} />
        </header>

        <div className="grid gap-4 xl:grid-cols-[12rem_minmax(0,1fr)]">
          <nav className={palette.sideNav} aria-label="偏好分类">
            <button
              className={
                activeSection === "search-filter" ? palette.sideNavItemActive : palette.sideNavItem
              }
              onClick={() => scrollToSection("search-filter")}
              type="button"
            >
              <Filter className="h-4 w-4" />
              过滤搜索
            </button>
            <button
              className={
                activeSection === "personalization"
                  ? palette.sideNavItemActive
                  : palette.sideNavItem
              }
              onClick={() => scrollToSection("personalization")}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              个性化
            </button>
            <button
              className={activeSection === "data" ? palette.sideNavItemActive : palette.sideNavItem}
              onClick={() => scrollToSection("data")}
              type="button"
            >
              <Download className="h-4 w-4" />
              配置
            </button>
          </nav>

          <div className="space-y-4">
            <section id="search-filter" className={`${palette.panel} scroll-mt-6`}>
              <div className={palette.categoryHeader}>
                <button
                  aria-label={settings.searchFilter.enabled ? "关闭过滤" : "开启过滤"}
                  className={[
                    "bm-filter-toggle-button",
                    palette.categoryFilterButton,
                    settings.searchFilter.enabled
                      ? palette.categoryFilterButtonEnabled
                      : palette.categoryFilterButtonDisabled,
                  ].join(" ")}
                  data-enabled={settings.searchFilter.enabled ? "true" : "false"}
                  onClick={toggleSearchFilter}
                  type="button"
                >
                  <span
                    key={filterAnimationKey}
                    className={[
                      "bm-filter-toggle-icon",
                      settings.searchFilter.enabled ? "bm-filter-toggle-icon--enabled" : "",
                    ].join(" ")}
                  >
                    <Filter className="relative z-10 h-6 w-6" strokeWidth={2.2} />
                  </span>
                </button>
                <div>
                  <h2 className={`text-base font-medium ${palette.heading}`}>过滤搜索</h2>
                  <p className={`mt-1 text-sm ${palette.mutedText}`}>减少低相关搜索结果</p>
                </div>
              </div>

              <div className="space-y-5 px-4 py-5 sm:px-5">
                <RuleListEditor
                  label="标题过滤词正则"
                  palette={palette}
                  placeholder="输入后按回车，例如：猎奇|剧透|标题党"
                  value={settings.searchFilter.titlePattern}
                  onChange={titlePattern => void updateSearchFilter({ titlePattern })}
                />
                <RuleListEditor
                  label="UP 主过滤词正则"
                  palette={palette}
                  placeholder="输入后按回车，例如：营销号|搬运|切片"
                  value={settings.searchFilter.uploaderPattern}
                  onChange={uploaderPattern => void updateSearchFilter({ uploaderPattern })}
                />
                <label className="block">
                  <span className={`mb-2 block text-sm font-medium ${palette.label}`}>
                    最低弹幕 / 播放互动率
                  </span>
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      className="bm-range flex-1"
                      max="1"
                      min="0"
                      step="0.01"
                      style={rangeStyle}
                      type="range"
                      value={ratePercent.toString()}
                      onChange={event =>
                        void updateSearchFilter({
                          minDanmakuViewRate: fromRatePercent(event.target.value),
                        })
                      }
                    />
                    <div className={palette.numberInputGroup}>
                      <input
                        className={`bm-number-input ${palette.numberInputField}`}
                        max="1"
                        min="0"
                        step="0.01"
                        type="number"
                        value={ratePercent.toString()}
                        onChange={event =>
                          void updateSearchFilter({
                            minDanmakuViewRate: fromRatePercent(event.target.value),
                          })
                        }
                      />
                      <span className={palette.numberSuffix}>%</span>
                      <div className={palette.numberStepper}>
                        <button
                          aria-label="增加互动率阈值"
                          className={palette.numberStepButton}
                          onClick={() => stepRatePercent(0.01)}
                          type="button"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          aria-label="减少互动率阈值"
                          className={palette.numberStepButton}
                          onClick={() => stepRatePercent(-0.01)}
                          type="button"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <span className={`mt-1 block text-xs ${palette.mutedText}`}>
                    取值范围 0-1%；弹幕为 0 时不会触发互动率过低。
                  </span>
                </label>
                <button
                  className={palette.toggleRow}
                  onClick={() =>
                    void updateSearchFilter({
                      filterMissingTitleHighlight:
                        !settings.searchFilter.filterMissingTitleHighlight,
                    })
                  }
                  type="button"
                >
                  <span>
                    <span className="block font-medium">过滤无粉色命中标题</span>
                    <span className={`mt-1 block text-xs ${palette.mutedText}`}>
                      搜索词没有出现在标题高亮里时，标记为低相关结果。
                    </span>
                  </span>
                  <Switch enabled={settings.searchFilter.filterMissingTitleHighlight} />
                </button>
              </div>
            </section>

            <section id="personalization" className={`${palette.panel} scroll-mt-6`}>
              <div className={palette.sectionHeader}>
                <div className={palette.contentWrap}>
                  <div>
                    <h2 className={`text-base font-medium ${palette.heading}`}>个性化</h2>
                    <p className={`mt-1 text-sm ${palette.mutedText}`}>
                      控制播放器页推荐列表和播完后的推荐连播。
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 px-4 pb-5 sm:px-5">
                <button
                  className={palette.toggleRow}
                  onClick={() =>
                    void updatePersonalization({
                      blockRelatedVideos: !settings.personalization.blockRelatedVideos,
                    })
                  }
                  type="button"
                >
                  <span>
                    <span className="block font-medium">拦截推荐视频列表</span>
                    <span className={`mt-1 block text-xs ${palette.mutedText}`}>
                      隐藏播放器右侧相关推荐、相关视频、接下来播放等推荐区，保留分集/选集。
                    </span>
                  </span>
                  <Switch enabled={settings.personalization.blockRelatedVideos} />
                </button>

                <button
                  className={palette.toggleRow}
                  onClick={() =>
                    void updatePersonalization({
                      disableRecommendationAutoplay:
                        !settings.personalization.disableRecommendationAutoplay,
                    })
                  }
                  type="button"
                >
                  <span>
                    <span className="block font-medium">关闭推荐自动连播</span>
                    <span className={`mt-1 block text-xs ${palette.mutedText}`}>
                      自动关闭播放器页的推荐/接下来播放连播，不主动禁用分集切换。
                    </span>
                  </span>
                  <Switch enabled={settings.personalization.disableRecommendationAutoplay} />
                </button>
              </div>
            </section>

            <section id="data" className={`${palette.panel} scroll-mt-6`}>
              <div className={palette.sectionHeader}>
                <div className={palette.contentWrap}>
                  <div>
                    <h2 className={`text-base font-medium ${palette.heading}`}>配置管理</h2>
                    <p className={`mt-1 text-sm ${palette.mutedText}`}>
                      导出备份或从 JSON / TXT 文件导入规则。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <input
                      ref={importInputRef}
                      accept="application/json,.json,.txt"
                      className="hidden"
                      type="file"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) void importSettings(file);
                      }}
                    />
                    <button
                      className={palette.secondaryButton}
                      onClick={() => importInputRef.current?.click()}
                      type="button"
                    >
                      <Upload className="h-4 w-4" />
                      导入
                    </button>
                    <button
                      className={palette.secondaryButton}
                      onClick={exportSettings}
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      导出
                    </button>
                  </div>
                </div>
              </div>
              {importMessage && (
                <p className={`${palette.contentNotice} ${palette.notice}`}>{importMessage}</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function RuleListEditor(props: {
  label: string;
  palette: ThemePalette;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const rules = splitRules(props.value);

  function addRule() {
    const trimmed = draft.trim();
    if (!trimmed || rules.includes(trimmed)) return;
    props.onChange([...rules, trimmed].join("|"));
    setDraft("");
  }

  function removeRule(rule: string) {
    props.onChange(rules.filter(item => item !== rule).join("|"));
  }

  return (
    <div>
      <label className="block">
        <span className={`mb-2 block text-sm font-medium ${props.palette.label}`}>
          {props.label}
        </span>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <input
            className={props.palette.textInput}
            placeholder={props.placeholder}
            type="text"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addRule();
            }}
          />
          <button
            aria-label={`添加${props.label}`}
            className={props.palette.addButton}
            disabled={!draft.trim() || rules.includes(draft.trim())}
            onClick={addRule}
            type="button"
          >
            <Plus className="h-4 w-4" />
            添加
          </button>
        </div>
      </label>
      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rules.map(rule => (
            <span key={rule} className={props.palette.ruleChip}>
              {rule}
              <button
                className={props.palette.ruleDeleteButton}
                onClick={() => removeRule(rule)}
                title="删除"
                type="button"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeSwitch(props: {
  value: ExtensionSettings["theme"];
  isDark: boolean;
  onChange: (theme: ExtensionSettings["theme"]) => void;
}) {
  const options = [
    { value: "system", label: "系统", icon: Monitor },
    { value: "light", label: "亮色", icon: Sun },
    { value: "dark", label: "暗色", icon: Moon },
  ] as const;

  return (
    <div
      className={[
        "inline-flex rounded-md border p-1 shadow-sm backdrop-blur transition-colors duration-300 ease-out",
        props.isDark ? "border-white/10 bg-slate-950/35" : "border-white/70 bg-white/55",
      ].join(" ")}
    >
      {options.map(option => {
        const Icon = option.icon;
        const selected = props.value === option.value;

        return (
          <button
            key={option.value}
            className={[
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors duration-300 ease-out",
              selected
                ? props.isDark
                  ? "bg-sky-400 text-slate-950"
                  : "bg-sky-500 text-white"
                : props.isDark
                  ? "text-slate-300 hover:bg-white/10"
                  : "text-slate-600 hover:bg-white/75",
            ].join(" ")}
            onClick={() => props.onChange(option.value)}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch(props: { enabled: boolean }) {
  return (
    <span
      className={[
        "h-5 w-9 rounded-full p-0.5 transition-colors duration-300 ease-out",
        props.enabled ? "bg-sky-500" : "bg-slate-300",
      ].join(" ")}
    >
      <span
        className={[
          "block h-4 w-4 rounded-full bg-white transition-transform duration-300 ease-out shadow-sm",
          props.enabled ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </span>
  );
}

function useEffectiveDarkTheme(theme: ExtensionSettings["theme"]) {
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

function getThemePalette(isDark: boolean) {
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
        "grid items-center gap-4 border-b border-white/10 px-4 py-4 transition-colors duration-300 ease-out sm:grid-cols-[40px_minmax(0,1fr)] sm:px-5",
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
        "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100 shadow-sm transition-colors duration-300 ease-out hover:border-sky-300/40 hover:bg-sky-300/10",
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
        "flex w-full items-center justify-between gap-4 rounded-md border border-white/10 bg-white/10 px-3 py-3 text-left text-sm text-slate-100 shadow-sm transition-colors duration-300 ease-out hover:border-sky-300/40 hover:bg-white/15",
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
      "grid items-center gap-4 border-b border-white/70 px-4 py-4 transition-colors duration-300 ease-out sm:grid-cols-[40px_minmax(0,1fr)] sm:px-5",
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
      "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors duration-300 ease-out hover:border-sky-200 hover:bg-sky-50",
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
      "flex w-full items-center justify-between gap-4 rounded-md border border-slate-200 bg-white/65 px-3 py-3 text-left text-sm text-slate-800 shadow-sm transition-colors duration-300 ease-out hover:border-sky-200 hover:bg-white/85",
    ruleChip:
      "inline-flex items-center gap-1.5 rounded-md border border-white/80 bg-white/75 px-2 py-1 text-xs text-slate-700 shadow-sm transition-colors duration-300 ease-out",
    ruleDeleteButton: "text-slate-400 transition-colors duration-300 ease-out hover:text-rose-500",
  };
}

function splitRules(value: string) {
  return value
    .split("|")
    .map(rule => rule.trim())
    .filter(Boolean);
}

function parseImportedSettings(
  text: string,
  currentSettings: ExtensionSettings,
): ExtensionSettings {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("导入文件为空");

  try {
    const payload = JSON.parse(trimmed) as Partial<ExtensionSettings> & {
      settings?: Partial<ExtensionSettings>;
      searchFilter?: { titlePattern?: unknown; uploaderPattern?: unknown };
      titlePattern?: unknown;
      uploaderPattern?: unknown;
      titleRules?: unknown;
      uploaderRules?: unknown;
    };
    const candidate = payload.settings ?? payload;

    if (hasSettingsShape(candidate)) return normalizeSettings(candidate, currentSettings);
    return normalizeLegacyRuleImport(payload, currentSettings);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        ...currentSettings,
        searchFilter: {
          ...currentSettings.searchFilter,
          titlePattern: splitRules(trimmed.replace(/\r?\n/g, "|")).join("|"),
        },
        updatedAt: new Date().toISOString(),
      };
    }

    throw error;
  }
}

function hasSettingsShape(value: Partial<ExtensionSettings>) {
  return !!value.searchFilter || !!value.personalization || !!value.features || !!value.theme;
}

function normalizeSettings(
  value: Partial<ExtensionSettings>,
  currentSettings: ExtensionSettings,
): ExtensionSettings {
  const theme = normalizeTheme(value.theme, currentSettings.theme);
  const searchFilter = normalizeSearchFilter(value.searchFilter, currentSettings.searchFilter);
  const personalization = normalizePersonalization(
    value.personalization,
    currentSettings.personalization,
  );
  const searchFilterEnabled = value.features?.searchFilter ?? searchFilter.enabled;
  const personalizationEnabled =
    value.features?.personalization ??
    (personalization.blockRelatedVideos || personalization.disableRecommendationAutoplay);

  return {
    ...currentSettings,
    ...value,
    features: {
      ...currentSettings.features,
      ...value.features,
      searchFilter: searchFilterEnabled,
      personalization: personalizationEnabled,
    },
    searchFilter: {
      ...searchFilter,
      enabled: searchFilterEnabled,
    },
    personalization,
    theme,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSearchFilter(
  value: Partial<SearchFilterSettings> | undefined,
  currentSearchFilter: SearchFilterSettings,
): SearchFilterSettings {
  return {
    ...currentSearchFilter,
    ...value,
    enabled: typeof value?.enabled === "boolean" ? value.enabled : currentSearchFilter.enabled,
    titlePattern: getStringPattern(value?.titlePattern) || currentSearchFilter.titlePattern,
    uploaderPattern:
      getStringPattern(value?.uploaderPattern) || currentSearchFilter.uploaderPattern,
    minDanmakuViewRate:
      typeof value?.minDanmakuViewRate === "number"
        ? clamp(value.minDanmakuViewRate, 0, 0.01)
        : currentSearchFilter.minDanmakuViewRate,
    filterMissingTitleHighlight:
      typeof value?.filterMissingTitleHighlight === "boolean"
        ? value.filterMissingTitleHighlight
        : currentSearchFilter.filterMissingTitleHighlight,
  };
}

function normalizePersonalization(
  value: Partial<PlayerPersonalizationSettings> | undefined,
  currentPersonalization: PlayerPersonalizationSettings,
): PlayerPersonalizationSettings {
  return {
    ...currentPersonalization,
    blockRelatedVideos:
      typeof value?.blockRelatedVideos === "boolean"
        ? value.blockRelatedVideos
        : currentPersonalization.blockRelatedVideos,
    disableRecommendationAutoplay:
      typeof value?.disableRecommendationAutoplay === "boolean"
        ? value.disableRecommendationAutoplay
        : currentPersonalization.disableRecommendationAutoplay,
  };
}

function normalizeLegacyRuleImport(
  payload: {
    searchFilter?: { titlePattern?: unknown; uploaderPattern?: unknown };
    titlePattern?: unknown;
    uploaderPattern?: unknown;
    titleRules?: unknown;
    uploaderRules?: unknown;
  },
  currentSettings: ExtensionSettings,
) {
  return {
    ...currentSettings,
    searchFilter: {
      ...currentSettings.searchFilter,
      titlePattern: normalizeImportedRules(
        payload.titleRules,
        getStringPattern(payload.titlePattern ?? payload.searchFilter?.titlePattern),
      ).join("|"),
      uploaderPattern: normalizeImportedRules(
        payload.uploaderRules,
        getStringPattern(payload.uploaderPattern ?? payload.searchFilter?.uploaderPattern),
      ).join("|"),
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTheme(value: unknown, fallback: ExtensionSettings["theme"]) {
  return value === "system" || value === "light" || value === "dark" ? value : fallback;
}

function getStringPattern(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeImportedRules(value: unknown, fallbackPattern: string) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map(rule => rule.trim())
      .filter(Boolean);
  }

  return splitRules(fallbackPattern);
}

function formatDateForFile(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toRatePercent(rate: number) {
  return Number(clamp(rate * 100, 0, 1).toFixed(2));
}

function fromRatePercent(value: string) {
  return clamp(Number(value), 0, 1) / 100;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
