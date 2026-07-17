const REMINDER_ROOT_ID = "bili-manager-watch-reminder";

export class WatchReminderView {
  private root: HTMLElement | undefined;

  show(limitMinutes: number): void {
    this.hide();

    const root = document.createElement("div");
    root.id = REMINDER_ROOT_ID;
    root.setAttribute("role", "alertdialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "观看时间过长");

    const panel = document.createElement("div");
    panel.className = "bili-manager-watch-reminder__panel";

    const title = document.createElement("strong");
    title.className = "bili-manager-watch-reminder__title";
    title.textContent = "观看时间过长";

    const message = document.createElement("span");
    message.className = "bili-manager-watch-reminder__message";
    message.textContent = `已连续播放 ${limitMinutes} 分钟，视频已暂停`;

    const confirmButton = document.createElement("button");
    confirmButton.className = "bili-manager-watch-reminder__button";
    confirmButton.type = "button";
    confirmButton.textContent = "知道了";
    confirmButton.addEventListener("click", this.hide);

    panel.append(title, message, confirmButton);
    root.append(panel);
    document.body.append(root);
    this.root = root;
    confirmButton.focus();
    document.addEventListener("keydown", this.handleKeydown);
  }

  hide = (): void => {
    document.removeEventListener("keydown", this.handleKeydown);
    this.root?.remove();
    this.root = undefined;
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.hide();
  };
}
