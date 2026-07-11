import { clamp } from "../../shared/number";

const TIMER_ROOT_ID = "bili-manager-watch-timer";
const FULLSCREEN_ATTR = "data-bili-manager-watch-timer-fullscreen";

export type WatchTimerPosition = {
  left: number;
  top: number;
};

export class WatchTimerView {
  private root: HTMLElement | undefined;
  private timeText: HTMLElement | undefined;
  private todayText: HTMLElement | undefined;
  private position: WatchTimerPosition = { left: 24, top: 96 };
  private dragging: { pointerId: number; offsetX: number; offsetY: number } | undefined;

  constructor(private readonly savePosition: (position: WatchTimerPosition) => void) {}

  get mounted(): boolean {
    return !!this.root?.isConnected;
  }

  mount(): boolean {
    if (this.mounted) return false;

    const root = document.createElement("aside");
    root.id = TIMER_ROOT_ID;
    root.setAttribute("aria-label", "播放器浏览计时器");

    const handle = document.createElement("button");
    handle.className = "bili-manager-watch-timer__handle";
    handle.type = "button";
    handle.title = "拖动调整位置";
    handle.addEventListener("pointerdown", this.startDrag);

    this.timeText = document.createElement("strong");
    this.timeText.className = "bili-manager-watch-timer__time";

    const todayRow = document.createElement("span");
    todayRow.className = "bili-manager-watch-timer__today";
    const todayLabel = document.createElement("span");
    todayLabel.textContent = "今日：";
    this.todayText = document.createElement("span");
    todayRow.append(todayLabel, this.todayText);
    handle.append(this.timeText, todayRow);
    root.append(handle);
    document.body.append(root);
    this.root = root;

    window.addEventListener("resize", this.keepInViewport);
    document.addEventListener("fullscreenchange", this.syncFullscreen);
    this.setTime(0, 0);
    this.applyPosition(this.position);
    this.syncFullscreen();
    return true;
  }

  unmount(): void {
    window.removeEventListener("resize", this.keepInViewport);
    document.removeEventListener("fullscreenchange", this.syncFullscreen);
    this.root?.remove();
    this.root = undefined;
    this.timeText = undefined;
    this.todayText = undefined;
    this.dragging = undefined;
    document.documentElement.removeAttribute(FULLSCREEN_ATTR);
  }

  setTime(elapsedMs: number, todayElapsedMs: number): void {
    if (this.timeText) this.timeText.textContent = formatDuration(elapsedMs);
    if (this.todayText) this.todayText.textContent = formatDuration(todayElapsedMs);
  }

  setOpacity(opacity: number): void {
    if (this.root) this.root.style.opacity = clamp(opacity, 0.45, 1).toString();
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

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteSecond = `${padTime(minutes)}:${padTime(seconds)}`;
  return hours > 0 ? `${hours}:${minuteSecond}` : minuteSecond;
}

function padTime(value: number): string {
  return value.toString().padStart(2, "0");
}
