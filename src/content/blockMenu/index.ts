import { displayTagName, normalizeTagName } from "../../shared/tagBlocklist";
import type { UploaderIdentity } from "../../shared/uploaderBlocklist";
import { blockTag } from "../tagBlock";
import { blockUploader } from "../uploaderBlock";

export const BLOCK_MENU_CONTROL_ATTR = "data-bili-manager-block-menu-control";

const HOST_CLASSES = ["bm-relative", "bm-group/block-menu-host"] as const;
const CONTROL_CLASS =
  "bili-manager-block-menu-control bm-group/block-menu bm-absolute bm-bottom-0 bm-right-0 bm-z-[2147483647] bm-font-sans";
const TRIGGER_CLASS =
  "bili-manager-block-menu-trigger bm-pointer-events-none bm-translate-y-0.5 bm-rounded-md bm-border bm-border-slate-300 bm-bg-white/95 bm-px-2 bm-py-1 bm-text-xs bm-font-medium bm-text-slate-600 bm-opacity-0 bm-shadow-sm bm-outline-none bm-transition-all bm-duration-150 hover:bm-border-bili-pink hover:bm-text-bili-pink focus-visible:bm-border-bili-pink focus-visible:bm-text-bili-pink group-hover/block-menu-host:bm-pointer-events-auto group-hover/block-menu-host:bm-translate-y-0 group-hover/block-menu-host:bm-opacity-100 group-focus-within/block-menu:bm-pointer-events-auto group-focus-within/block-menu:bm-translate-y-0 group-focus-within/block-menu:bm-opacity-100 group-data-[open=true]/block-menu:bm-pointer-events-auto group-data-[open=true]/block-menu:bm-translate-y-0 group-data-[open=true]/block-menu:bm-opacity-100 dark:bm-border-[#3a3e47] dark:bm-bg-[#242830]/95 dark:bm-text-slate-300";
const PANEL_CLASS =
  "bili-manager-block-menu-panel bm-invisible bm-absolute bm-bottom-full bm-right-0 bm-mb-2 bm-box-border bm-flex bm-max-h-80 bm-w-64 bm-max-w-[min(16rem,calc(100vw-2rem))] bm-translate-y-1 bm-flex-col bm-overflow-hidden bm-rounded-lg bm-border bm-border-slate-200 bm-bg-white bm-text-left bm-text-slate-800 bm-opacity-0 bm-shadow-xl bm-transition-all bm-duration-150 group-data-[open=true]/block-menu:bm-visible group-data-[open=true]/block-menu:bm-translate-y-0 group-data-[open=true]/block-menu:bm-opacity-100 dark:bm-border-[#3a3e47] dark:bm-bg-[#242830] dark:bm-text-slate-100";
const ACTION_CLASS =
  "bm-flex bm-w-full bm-min-w-0 bm-items-center bm-justify-between bm-gap-3 bm-rounded-md bm-px-2.5 bm-py-2 bm-text-left bm-text-xs bm-font-medium bm-outline-none bm-transition-colors hover:bm-bg-sky-50 hover:bm-text-bili-blue focus-visible:bm-ring-2 focus-visible:bm-ring-bili-blue/40 disabled:bm-cursor-wait disabled:bm-opacity-60 dark:hover:bm-bg-bili-blue/10 dark:hover:bm-text-sky-200";

type CardBlockMenuTarget = {
  cardEl: HTMLElement;
  uploader?: UploaderIdentity | null;
  tags: string[];
};

type BlockMenuData = {
  uploader: UploaderIdentity | null;
  tags: string[];
  signature: string;
};

const dataByControl = new WeakMap<HTMLElement, BlockMenuData>();
let activeControl: HTMLElement | null = null;
let globalEventsBound = false;

export function syncBlockMenuControl(target: CardBlockMenuTarget): void {
  const existing = target.cardEl.querySelector<HTMLElement>(`[${BLOCK_MENU_CONTROL_ATTR}]`);
  const data = normalizeTarget(target);

  if (!data.uploader && data.tags.length === 0) {
    removeControl(existing, target.cardEl);
    return;
  }

  target.cardEl.classList.add(...HOST_CLASSES);
  const control = existing ?? createControl();
  control.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (dataByControl.get(control)?.signature !== data.signature) {
    if (control === activeControl) closeControl(control, false);
    dataByControl.set(control, data);
    renderActions(control, data);
  }

  if (!existing) target.cardEl.append(control);
}

export function clearBlockMenuControls(): void {
  document.querySelectorAll<HTMLElement>(`[${BLOCK_MENU_CONTROL_ATTR}]`).forEach(control => {
    removeControl(control, control.parentElement);
  });
  unbindGlobalEvents();
}

function normalizeTarget(target: CardBlockMenuTarget): BlockMenuData {
  const uploaderName = target.uploader?.name.trim().replace(/\s+/g, " ") ?? "";
  const uploaderMid = target.uploader?.mid.trim() ?? "";
  const uploader =
    uploaderName || uploaderMid
      ? { mid: uploaderMid, name: uploaderName || `UID ${uploaderMid}` }
      : null;
  const tags = new Map<string, string>();
  target.tags.forEach(value => {
    const name = displayTagName(value);
    const normalized = normalizeTagName(name);
    if (normalized) tags.set(normalized, name);
  });
  const normalizedTags = [...tags.values()];

  return {
    uploader,
    tags: normalizedTags,
    signature: JSON.stringify([uploader?.mid ?? "", uploader?.name ?? "", normalizedTags]),
  };
}

function createControl(): HTMLElement {
  bindGlobalEvents();

  const control = document.createElement("div");
  control.className = CONTROL_CLASS;
  control.setAttribute(BLOCK_MENU_CONTROL_ATTR, "true");

  const trigger = document.createElement("button");
  trigger.className = TRIGGER_CLASS;
  trigger.type = "button";
  trigger.textContent = "屏蔽";
  trigger.title = "屏蔽此 UP 或 TAG";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", "打开屏蔽菜单");
  trigger.addEventListener("click", () => toggleControl(control));

  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.setAttribute("aria-label", "选择要屏蔽的内容");
  panel.setAttribute("role", "dialog");

  const header = document.createElement("div");
  header.className =
    "bm-border-b bm-border-slate-100 bm-px-3 bm-py-2.5 bm-text-xs bm-font-semibold dark:bm-border-[#3a3e47]";
  header.textContent = "选择要屏蔽的内容";

  const body = document.createElement("div");
  body.className =
    "bili-manager-block-menu-body bm-min-h-0 bm-flex-1 bm-overscroll-contain bm-overflow-y-auto bm-p-2";

  panel.append(header, body);
  control.append(trigger, panel);
  control.addEventListener("click", stopCardEvent);
  control.addEventListener("auxclick", stopCardEvent);
  control.addEventListener("pointerdown", stopCardEvent);
  control.addEventListener("contextmenu", stopCardEvent);
  control.addEventListener("wheel", event => event.stopPropagation());
  return control;
}

function renderActions(control: HTMLElement, data: BlockMenuData): void {
  const body = control.querySelector<HTMLElement>(".bili-manager-block-menu-body");
  if (!body) return;
  const content = document.createDocumentFragment();

  if (data.uploader) {
    content.append(createSectionLabel("屏蔽此 UP"));
    const uploaderButton = createActionButton(data.uploader.name);
    uploaderButton.title = `屏蔽 UP：${data.uploader.name}`;
    uploaderButton.addEventListener("click", () => {
      void runAction(control, uploaderButton, () => blockUploader(data.uploader!));
    });
    content.append(uploaderButton);
  }

  if (data.tags.length > 0) {
    content.append(createSectionLabel("精确屏蔽 TAG", !!data.uploader));
    const tagList = document.createElement("div");
    tagList.className = "bm-space-y-1";
    data.tags.forEach(tag => {
      const tagButton = createActionButton(`#${tag}`);
      tagButton.title = `精确屏蔽 TAG：${tag}`;
      tagButton.addEventListener("click", () => {
        void runAction(control, tagButton, () => blockTag({ name: tag }));
      });
      tagList.append(tagButton);
    });
    content.append(tagList);
  }

  body.replaceChildren(content);
}

function createSectionLabel(text: string, separated = false): HTMLElement {
  const label = document.createElement("p");
  label.className = `${separated ? "bm-mt-2 bm-border-t bm-border-slate-100 bm-pt-2 dark:bm-border-[#3a3e47] " : ""}bm-mb-1 bm-px-2 bm-text-[11px] bm-text-slate-500 dark:bm-text-slate-400`;
  label.textContent = text;
  return label;
}

function createActionButton(text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = ACTION_CLASS;
  button.type = "button";

  const value = document.createElement("span");
  value.className = "bm-min-w-0 bm-flex-1 bm-truncate";
  value.textContent = text;

  button.append(value);
  return button;
}

function toggleControl(control: HTMLElement): void {
  if (activeControl === control) {
    closeControl(control, true);
    return;
  }

  if (activeControl) closeControl(activeControl, false);
  activeControl = control;
  control.dataset.open = "true";
  control.querySelector("button")?.setAttribute("aria-expanded", "true");
  control.querySelector<HTMLButtonElement>(".bili-manager-block-menu-body button")?.focus();
}

function closeControl(control: HTMLElement, restoreFocus: boolean): void {
  delete control.dataset.open;
  const trigger = control.querySelector<HTMLButtonElement>(".bili-manager-block-menu-trigger");
  trigger?.setAttribute("aria-expanded", "false");
  if (activeControl === control) activeControl = null;
  if (restoreFocus) trigger?.focus();
}

function removeControl(control: HTMLElement | null, host: Element | null): void {
  if (control && control === activeControl) closeControl(control, false);
  control?.remove();
  host?.classList.remove(...HOST_CLASSES);
}

async function runAction(
  control: HTMLElement,
  button: HTMLButtonElement,
  action: () => Promise<void>,
): Promise<void> {
  button.disabled = true;
  try {
    await action();
    closeControl(control, false);
  } finally {
    button.disabled = false;
  }
}

function bindGlobalEvents(): void {
  if (globalEventsBound) return;

  document.addEventListener("pointerdown", handleGlobalPointerDown, true);
  document.addEventListener("focusin", handleGlobalFocusIn, true);
  document.addEventListener("keydown", handleGlobalKeydown);
  globalEventsBound = true;
}

function unbindGlobalEvents(): void {
  if (!globalEventsBound) return;

  document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
  document.removeEventListener("focusin", handleGlobalFocusIn, true);
  document.removeEventListener("keydown", handleGlobalKeydown);
  activeControl = null;
  globalEventsBound = false;
}

function handleGlobalPointerDown(event: Event): void {
  if (!activeControl || activeControl.contains(event.target as Node)) return;
  closeControl(activeControl, false);
}

function handleGlobalFocusIn(event: FocusEvent): void {
  if (!activeControl || activeControl.contains(event.target as Node)) return;
  closeControl(activeControl, false);
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !activeControl) return;
  closeControl(activeControl, true);
}

function stopCardEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
