export function hasChromeLocalStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}
