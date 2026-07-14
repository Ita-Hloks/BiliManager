import { createRoot } from "react-dom/client";
import "../styles/globals.css";
import { defaultSettings, getSettings } from "../shared/storage";
import { isEffectiveDarkTheme } from "../shared/useEffectiveDarkTheme";
import { PopupApp } from "./popupApp";

applyPopupTheme(isEffectiveDarkTheme("system"));
void bootPopup();

async function bootPopup() {
  const initialSettings = await getSettings().catch(() => defaultSettings);
  applyPopupTheme(isEffectiveDarkTheme(initialSettings.theme));
  createRoot(document.getElementById("root")!).render(
    <PopupApp initialSettings={initialSettings} />,
  );
}

function applyPopupTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}
