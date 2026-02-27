/**
 * メディアURLサニタイズ: javascript: / data: 等の危険なスキームを排除。
 * サーバー返却値を img src 等に渡す前に検証する。
 */
export function sanitizeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // 相対パス（/api/media/...）は許可
  if (url.startsWith("/")) return url;

  // http(s) のみ許可
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    // 不正なURL
  }

  return null;
}
