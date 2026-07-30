import { addBlockedUploader } from "../../shared/uploaderBlocklist";
import type { UploaderIdentity } from "../../shared/uploaderBlocklist";

export const UPLOADER_BLOCK_CONTROL_ATTR = "data-bili-manager-uploader-block-control";

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
    target.cardEl.classList.remove("bili-manager-uploader-block-host");
    return;
  }

  target.cardEl.classList.add("bili-manager-uploader-block-host");
  const control = existing ?? createControl();
  control.dataset.uploaderMid = target.mid;
  control.dataset.uploaderName = target.name;
  control.querySelector<HTMLElement>(".bili-manager-uploader-block-name")!.textContent =
    target.name;
  if (!existing) target.cardEl.append(control);
}

export function clearUploaderBlockControls(): void {
  document.querySelectorAll<HTMLElement>(`[${UPLOADER_BLOCK_CONTROL_ATTR}]`).forEach(control => {
    if (control === activeControl) closeControl(control, false);
    control.parentElement?.classList.remove("bili-manager-uploader-block-host");
    control.remove();
  });
}

function createControl(): HTMLElement {
  bindGlobalEvents();

  const control = document.createElement("div");
  control.className = "bili-manager-uploader-block-control";
  control.setAttribute(UPLOADER_BLOCK_CONTROL_ATTR, "true");

  const trigger = document.createElement("button");
  trigger.className = "bili-manager-uploader-block-trigger";
  trigger.type = "button";
  trigger.textContent = "屏蔽";
  trigger.title = "屏蔽此 UP";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", "屏蔽此 UP");
  trigger.addEventListener("click", () => openControl(control));

  const panel = document.createElement("div");
  panel.className = "bili-manager-uploader-block-panel";
  panel.setAttribute("aria-label", "确认屏蔽 UP");
  panel.setAttribute("role", "dialog");

  const label = document.createElement("span");
  label.className = "bili-manager-uploader-block-label";
  label.textContent = "屏蔽 UP";

  const name = document.createElement("strong");
  name.className = "bili-manager-uploader-block-name";

  const actions = document.createElement("div");
  actions.className = "bili-manager-uploader-block-actions";

  const cancel = document.createElement("button");
  cancel.className = "bili-manager-uploader-block-cancel";
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.addEventListener("click", () => closeControl(control, true));

  const confirm = document.createElement("button");
  confirm.className = "bili-manager-uploader-block-confirm";
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
