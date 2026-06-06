/** Allow only http(s) links in user-facing anchors. */
export function safeExternalHref(
  url: string | null | undefined
): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
