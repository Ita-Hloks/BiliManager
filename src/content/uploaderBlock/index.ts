import { addBlockedUploader } from "../../shared/uploaderBlocklist";
import type { UploaderIdentity } from "../../shared/uploaderBlocklist";

export const UPLOADER_BLOCK_CONTROL_ATTR = "data-bili-manager-uploader-block-control";

const HOST_CLASSES = ["bm-relative", "bm-group/uploader-host"] as const;
const CONTROL_CLASS =
  "bili-manager-uploader-block-control bm-group/uploader-control bm-absolute bm-bottom-0 bm-right-0 bm-z-[2147483647] bm-font-sans";
const TRIGGER_CLASS =
  "bili-manager-uploader-block-trigger bm-pointer-events-none bm-translate-y-0.5 bm-rounded-md bm-border bm-border-slate-300 bm-bg-white/95 bm-px-2 bm-py-1 bm-text-xs bm-font-medium bm-text-slate-600 bm-opacity-0 bm-shadow-sm bm-outline-none bm-transition-all bm-duration-150 hover:bm-border-bili-pink hover:bm-text-bili-pink focus-visible:bm-border-bili-pink focus-visible:bm-text-bili-pink group-hover/uploader-host:bm-pointer-events-auto group-hover/uploader-host:bm-translate-y-0 group-hover/uploader-host:bm-opacity-100 group-focus-within/uploader-control:bm-pointer-events-auto group-focus-within/uploader-control:bm-translate-y-0 group-focus-within/uploader-control:bm-opacity-100 group-data-[open=true]/uploader-control:bm-pointer-events-auto group-data-[open=true]/uploader-control:bm-translate-y-0 group-data-[open=true]/uploader-control:bm-opacity-100 dark:bm-border-[#3a3e47] dark:bm-bg-[#242830]/95 dark:bm-text-slate-300";
const PANEL_CLASS =
  "bili-manager-uploader-block-panel bm-invisible bm-absolute bm-bottom-full bm-right-0 bm-mb-2 bm-box-border bm-w-56 bm-translate-y-1 bm-rounded-lg bm-border bm-border-slate-200 bm-bg-white bm-p-3 bm-text-left bm-text-slate-800 bm-opacity-0 bm-shadow-xl bm-transition-all bm-duration-150 group-data-[open=true]/uploader-control:bm-visible group-data-[open=true]/uploader-control:bm-translate-y-0 group-data-[open=true]/uploader-control:bm-opacity-100 dark:bm-border-[#3a3e47] dark:bm-bg-[#242830] dark:bm-text-slate-100";
const BUTTON_BASE_CLASS =
  "bm-rounded-md bm-px-2.5 bm-py-1.5 bm-text-xs bm-font-medium bm-outline-none bm-transition-colors focus-visible:bm-ring-2 focus-visible:bm-ring-bili-blue/40";

type UploaderBlockTarget = UploaderIdentity & {
  cardEl: HTMLElement;
};

let activeControl: HTMLElement | null = null;
let globalEventsBound = false;

export function syncUploaderBlockControl(target: UploaderBlockTarget, enabled: boolean): void {
  const existing = target.cardEl.querySelector<HTMLElement>(`[${UPLOADER_BLOCK_CONTROL_ATTR}]`);
  if (!enabled || !target.name) {
    if (existing && existing === activeControl) closeControl(existing, false);
    existing?.remove();
    target.cardEl.classList.remove(...HOST_CLASSES);
    return;
  }

  target.cardEl.classList.add(...HOST_CLASSES);
  const control = existing ?? createControl();
  control.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
  control.dataset.uploaderMid = target.mid;
  control.dataset.uploaderName = target.name;
  control.querySelector<HTMLElement>(".bili-manager-uploader-block-name")!.textContent =
    target.name;
  if (!existing) target.cardEl.append(control);
}

export function clearUploaderBlockControls(): void {
  document.querySelectorAll<HTMLElement>(`[${UPLOADER_BLOCK_CONTROL_ATTR}]`).forEach(control => {
    if (control === activeControl) closeControl(control, false);
    control.parentElement?.classList.remove(...HOST_CLASSES);
    control.remove();
  });
  unbindGlobalEvents();
}

function createControl(): HTMLElement {
  bindGlobalEvents();

  const control = document.createElement("div");
  control.className = CONTROL_CLASS;
  control.setAttribute(UPLOADER_BLOCK_CONTROL_ATTR, "true");

  const trigger = document.createElement("button");
  trigger.className = TRIGGER_CLASS;
  trigger.type = "button";
  trigger.textContent = "屏蔽";
  trigger.title = "屏蔽此 UP";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", "屏蔽此 UP");
  trigger.addEventListener("click", () => openControl(control));

  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.setAttribute("aria-label", "确认屏蔽 UP");
  panel.setAttribute("role", "dialog");

  const label = document.createElement("span");
  label.className = "bm-block bm-text-xs bm-text-slate-500 dark:bm-text-slate-400";
  label.textContent = "屏蔽 UP";

  const name = document.createElement("strong");
  name.className =
    "bili-manager-uploader-block-name bm-mt-1 bm-block bm-text-sm bm-font-semibold bm-text-slate-800 [overflow-wrap:anywhere] dark:bm-text-slate-100";

  const actions = document.createElement("div");
  actions.className = "bm-mt-3 bm-flex bm-justify-end bm-gap-2";

  const cancel = document.createElement("button");
  cancel.className = `${BUTTON_BASE_CLASS} bm-bg-slate-100 bm-text-slate-600 hover:bm-bg-slate-200 dark:bm-bg-white/10 dark:bm-text-slate-300 dark:hover:bm-bg-white/15`;
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.addEventListener("click", () => closeControl(control, true));

  const confirm = document.createElement("button");
  confirm.className = `${BUTTON_BASE_CLASS} bili-manager-uploader-block-confirm bm-bg-bili-pink bm-text-white hover:bm-bg-[#e85f8b] disabled:bm-cursor-wait disabled:bm-opacity-60`;
  confirm.type = "button";
  confirm.textContent = "确认屏蔽";
  confirm.addEventListener("click", () => void confirmBlock(control, confirm));

  actions.append(cancel, confirm);
  panel.append(label, name, actions);
  control.append(trigger, panel);
  control.addEventListener("click", stopCardEvent);
  control.addEventListener("auxclick", stopCardEvent);
  control.addEventListener("pointerdown", stopCardEvent);
  control.addEventListener("contextmenu", stopCardEvent);
  return control;
}

function openControl(control: HTMLElement): void {
  if (activeControl && activeControl !== control) closeControl(activeControl, false);
  activeControl = control;
  control.dataset.open = "true";
  control.querySelector("button")?.setAttribute("aria-expanded", "true");
  control.querySelector<HTMLButtonElement>(".bili-manager-uploader-block-confirm")?.focus();
}

function closeControl(control: HTMLElement, restoreFocus: boolean): void {
  delete control.dataset.open;
  const trigger = control.querySelector<HTMLButtonElement>(".bili-manager-uploader-block-trigger");
  trigger?.setAttribute("aria-expanded", "false");
  if (activeControl === control) activeControl = null;
  if (restoreFocus) trigger?.focus();
}

async function confirmBlock(control: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const uploader = {
    mid: control.dataset.uploaderMid ?? "",
    name: control.dataset.uploaderName ?? "",
  };
  if (!uploader.name) return;

  button.disabled = true;
  try {
    await addBlockedUploader(uploader);
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
