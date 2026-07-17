import { clamp } from "../../shared/number";
import { formatClockDuration } from "../../shared/duration";

const TIMER_ROOT_ID = "bili-manager-watch-timer";
const FULLSCREEN_ATTR = "data-bili-manager-watch-timer-fullscreen";

export type WatchTimerPosition = {
  left: number;
  top: number;
};

export class WatchTimerView {
  private root: HTMLElement | undefined;
  private backdrop: HTMLElement | undefined;
  private timeText: HTMLElement | undefined;
  private todayText: HTMLElement | undefined;
  private closeButton: HTMLButtonElement | undefined;
  private closePrompt: HTMLElement | undefined;
  private cancelCloseButton: HTMLButtonElement | undefined;
  private confirmCloseButton: HTMLButtonElement | undefined;
  private closeDelayTimer: number | undefined;
  private position: WatchTimerPosition = { left: 24, top: 96 };
  private dragging: { pointerId: number; offsetX: number; offsetY: number } | undefined;

  constructor(
    private readonly savePosition: (position: WatchTimerPosition) => void,
    private readonly disableTimer: () => void,
  ) {}

  get mounted(): boolean {
    return !!this.root?.isConnected;
  }

  mount(): boolean {
    if (this.mounted) return false;

    const root = document.createElement("aside");
    root.id = TIMER_ROOT_ID;
    root.style.visibility = "hidden";
    root.setAttribute("aria-label", "播放器浏览计时器");

    this.backdrop = document.createElement("span");
    this.backdrop.className = "bili-manager-watch-timer__backdrop";
    this.backdrop.setAttribute("aria-hidden", "true");

    const handle = document.createElement("button");
    handle.className = "bili-manager-watch-timer__handle";
    handle.type = "button";
    handle.title = "拖动调整位置";
    handle.addEventListener("pointerdown", this.startDrag);

    this.closeButton = document.createElement("button");
    this.closeButton.className = "bili-manager-watch-timer__close";
    this.closeButton.type = "button";
    this.closeButton.ariaLabel = "关闭计时器";
    this.closeButton.title = "关闭计时器";
    this.closeButton.textContent = "×";
    this.closeButton.addEventListener("click", event => {
      event.stopPropagation();
      this.showClosePrompt();
    });

    this.timeText = document.createElement("strong");
    this.timeText.className = "bili-manager-watch-timer__time";

    const todayRow = document.createElement("span");
    todayRow.className = "bili-manager-watch-timer__today";
    const todayLabel = document.createElement("span");
    todayLabel.textContent = "今日：";
    this.todayText = document.createElement("span");
    todayRow.append(todayLabel, this.todayText);
    handle.append(this.timeText, todayRow);

    this.closePrompt = document.createElement("div");
    this.closePrompt.className = "bili-manager-watch-timer__prompt";
    this.closePrompt.setAttribute("aria-hidden", "true");
    this.closePrompt.setAttribute("aria-label", "关闭计时器确认");
    this.closePrompt.setAttribute("role", "alertdialog");
    this.closePrompt.inert = true;

    const promptText = document.createElement("div");
    promptText.className = "bili-manager-watch-timer__prompt-text";
    const promptTitle = document.createElement("strong");
    promptTitle.className = "bili-manager-watch-timer__prompt-title";
    promptTitle.textContent = "是否要关闭计时器？";
    const promptHint = document.createElement("span");
    promptHint.className = "bili-manager-watch-timer__prompt-hint";
    promptHint.textContent = "如需重新打开，请前往设置 → 计时器并重新启用";
    promptText.append(promptTitle, promptHint);

    const promptActions = document.createElement("div");
    promptActions.className = "bili-manager-watch-timer__prompt-actions";
    this.cancelCloseButton = document.createElement("button");
    this.cancelCloseButton.className = "bili-manager-watch-timer__prompt-button";
    this.cancelCloseButton.type = "button";
    this.cancelCloseButton.textContent = "取消";
    this.cancelCloseButton.addEventListener("click", this.hideClosePrompt);
    this.confirmCloseButton = document.createElement("button");
    this.confirmCloseButton.className =
      "bili-manager-watch-timer__prompt-button bili-manager-watch-timer__prompt-button--confirm";
    this.confirmCloseButton.type = "button";
    this.confirmCloseButton.textContent = "关闭";
    this.confirmCloseButton.addEventListener("click", this.confirmClose);
    promptActions.append(this.cancelCloseButton, this.confirmCloseButton);
    this.closePrompt.append(promptText, promptActions);

    root.addEventListener("keydown", this.handlePromptKeydown);
    root.append(this.backdrop, handle, this.closeButton, this.closePrompt);
    document.body.append(root);
    this.root = root;

    window.addEventListener("resize", this.keepInViewport);
    document.addEventListener("fullscreenchange", this.syncFullscreen);
    this.setTime(0, 0);
    this.applyPosition(this.position);
    this.syncFullscreen();
    return true;
  }

  show(): void {
    if (this.root) this.root.style.visibility = "visible";
  }

  unmount(): void {
    window.removeEventListener("resize", this.keepInViewport);
    document.removeEventListener("fullscreenchange", this.syncFullscreen);
    this.root?.remove();
    window.clearTimeout(this.closeDelayTimer);
    this.closeDelayTimer = undefined;
    this.root = undefined;
    this.backdrop = undefined;
    this.timeText = undefined;
    this.todayText = undefined;
    this.closeButton = undefined;
    this.closePrompt = undefined;
    this.cancelCloseButton = undefined;
    this.confirmCloseButton = undefined;
    this.dragging = undefined;
    document.documentElement.removeAttribute(FULLSCREEN_ATTR);
  }

  setTime(elapsedMs: number, todayElapsedMs: number): void {
    if (this.timeText) this.timeText.textContent = formatClockDuration(elapsedMs);
    if (this.todayText) this.todayText.textContent = formatClockDuration(todayElapsedMs);
  }

  setOpacity(opacity: number): void {
    if (this.backdrop) this.backdrop.style.opacity = clamp(opacity, 0.45, 1).toString();
  }

  applyPosition(position: WatchTimerPosition): void {
    this.position = this.clampPosition(position);
    if (!this.root) return;
    this.root.style.left = `${this.position.left}px`;
    this.root.style.top = `${this.position.top}px`;
  }

  private readonly keepInViewport = () => this.applyPosition(this.position);

  private readonly syncFullscreen = () => {
    document.documentElement.toggleAttribute(FULLSCREEN_ATTR, !!document.fullscreenElement);
  };

  private showClosePrompt(): void {
    if (!this.root || !this.closePrompt) return;
    this.root.classList.add("bili-manager-watch-timer--confirming");
    this.closePrompt.setAttribute("aria-hidden", "false");
    this.closePrompt.inert = false;
    this.applyPosition(this.position);
    this.cancelCloseButton?.focus();
  }

  private readonly hideClosePrompt = (): void => {
    if (!this.root || !this.closePrompt || this.closeDelayTimer) return;
    this.root.classList.remove("bili-manager-watch-timer--confirming");
    this.closePrompt.setAttribute("aria-hidden", "true");
    this.closePrompt.inert = true;
    this.applyPosition(this.position);
    this.closeButton?.focus();
  };

  private readonly confirmClose = (): void => {
    if (!this.root || this.closeDelayTimer) return;
    this.root.classList.add("bili-manager-watch-timer--closing");
    if (this.cancelCloseButton) this.cancelCloseButton.disabled = true;
    if (this.confirmCloseButton) this.confirmCloseButton.disabled = true;
    this.closeDelayTimer = window.setTimeout(() => {
      this.closeDelayTimer = undefined;
      this.disableTimer();
    }, 180);
  };

  private readonly handlePromptKeydown = (event: KeyboardEvent): void => {
    if (
      event.key !== "Escape" ||
      !this.root?.classList.contains("bili-manager-watch-timer--confirming")
    )
      return;
    event.preventDefault();
    this.hideClosePrompt();
  };

  private readonly startDrag = (event: PointerEvent) => {
    if (!this.root) return;
    const rect = this.root.getBoundingClientRect();
    this.dragging = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    this.root.setPointerCapture(event.pointerId);
    this.root.addEventListener("pointermove", this.drag);
    this.root.addEventListener("pointerup", this.finishDrag);
    this.root.addEventListener("pointercancel", this.finishDrag);
  };

  private readonly drag = (event: PointerEvent) => {
    if (!this.dragging || event.pointerId !== this.dragging.pointerId) return;
    this.applyPosition({
      left: event.clientX - this.dragging.offsetX,
      top: event.clientY - this.dragging.offsetY,
    });
  };

  private readonly finishDrag = (event: PointerEvent) => {
    if (!this.root || !this.dragging || event.pointerId !== this.dragging.pointerId) return;
    this.root.releasePointerCapture(event.pointerId);
    this.root.removeEventListener("pointermove", this.drag);
    this.root.removeEventListener("pointerup", this.finishDrag);
    this.root.removeEventListener("pointercancel", this.finishDrag);
    this.dragging = undefined;
    this.savePosition(this.position);
  };

  private clampPosition(position: WatchTimerPosition): WatchTimerPosition {
    const maxLeft = Math.max(8, window.innerWidth - (this.root?.offsetWidth ?? 148) - 8);
    const maxTop = Math.max(8, window.innerHeight - (this.root?.offsetHeight ?? 86) - 8);
    return {
      left: clamp(position.left, 8, maxLeft),
      top: clamp(position.top, 8, maxTop),
    };
  }
}
