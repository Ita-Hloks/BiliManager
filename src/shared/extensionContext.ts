export function hasExtensionContext(): boolean {
  try {
    return typeof chrome !== "undefined" && typeof chrome.runtime?.id === "string";
  } catch {
    return false;
  }
}

export function isExtensionContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Extension context invalidated");
}
