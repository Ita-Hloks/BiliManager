import { addBlockedUploader } from "../../shared/uploaderBlocklist";
import type { UploaderIdentity } from "../../shared/uploaderBlocklist";

export const UPLOADER_BLOCK_CONTROL_ATTR = "data-bili-manager-uploader-block-control";

const HOST_CLASSES = ["relative", "group/uploader-host"] as const;
const CONTROL_CLASS =
  "bili-manager-uploader-block-control group/uploader-control absolute bottom-0 right-0 z-[2147483647] font-sans";
const TRIGGER_CLASS =
  "bili-manager-uploader-block-trigger pointer-events-none translate-y-0.5 rounded-md border border-slate-300 bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 opacity-0 shadow-sm outline-none transition-all duration-150 hover:border-bili-pink hover:text-bili-pink focus-visible:border-bili-pink focus-visible:text-bili-pink group-hover/uploader-host:pointer-events-auto group-hover/uploader-host:translate-y-0 group-hover/uploader-host:opacity-100 group-focus-within/uploader-control:pointer-events-auto group-focus-within/uploader-control:translate-y-0 group-focus-within/uploader-control:opacity-100 group-data-[open=true]/uploader-control:pointer-events-auto group-data-[open=true]/uploader-control:translate-y-0 group-data-[open=true]/uploader-control:opacity-100 dark:border-[#3a3e47] dark:bg-[#242830]/95 dark:text-slate-300";
const PANEL_CLASS =
  "bili-manager-uploader-block-panel invisible absolute bottom-full right-0 mb-2 box-border w-56 translate-y-1 rounded-lg border border-slate-200 bg-white p-3 text-left text-slate-800 opacity-0 shadow-xl transition-all duration-150 group-data-[open=true]/uploader-control:visible group-data-[open=true]/uploader-control:translate-y-0 group-data-[open=true]/uploader-control:opacity-100 dark:border-[#3a3e47] dark:bg-[#242830] dark:text-slate-100";
const BUTTON_BASE_CLASS =
  "rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bili-blue/40";

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
  label.className = "block text-xs text-slate-500 dark:text-slate-400";
  label.textContent = "屏蔽 UP";

  const name = document.createElement("strong");
  name.className =
    "bili-manager-uploader-block-name mt-1 block text-sm font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100";

  const actions = document.createElement("div");
  actions.className = "mt-3 flex justify-end gap-2";

  const cancel = document.createElement("button");
  cancel.className = `${BUTTON_BASE_CLASS} bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15`;
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.addEventListener("click", () => closeControl(control, true));

  const confirm = document.createElement("button");
  confirm.className = `${BUTTON_BASE_CLASS} bili-manager-uploader-block-confirm bg-bili-pink text-white hover:bg-[#e85f8b] disabled:cursor-wait disabled:opacity-60`;
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

  document.addEventListener(
    "pointerdown",
    event => {
      if (!activeControl || activeControl.contains(event.target as Node)) return;
      closeControl(activeControl, false);
    },
    true,
  );
  document.addEventListener(
    "focusin",
    event => {
      if (!activeControl || activeControl.contains(event.target as Node)) return;
      closeControl(activeControl, false);
    },
    true,
  );
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !activeControl) return;
    closeControl(activeControl, true);
  });
  globalEventsBound = true;
}

function stopCardEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
