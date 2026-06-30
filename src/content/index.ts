import { sendMessage } from "../shared/messaging";
import type { RuntimeSnapshot } from "../shared/types";

function getSnapshot(): RuntimeSnapshot {
  return {
    url: location.href,
    title: document.title,
    isBilibili: location.hostname.includes("bilibili.com"),
    detectedAt: new Date().toISOString(),
  };
}

function mountBadge() {
  if (document.getElementById("bili-filter-extension-badge")) return;

  const badge = document.createElement("button");
  badge.id = "bili-filter-extension-badge";
  badge.type = "button";
  badge.textContent = "BF";
  badge.title = "Bili Filter 扩展 Demo 已注入";
  badge.addEventListener("click", () => {
    badge.classList.toggle("bili-filter-extension-badge--active");
  });

  document.documentElement.appendChild(badge);
}

async function boot() {
  mountBadge();
  await sendMessage({ type: "BILI_FILTER_HELLO", payload: getSnapshot() });
}

void boot();
