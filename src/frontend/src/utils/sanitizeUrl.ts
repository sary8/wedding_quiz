/**
 * メディアURLサニタイズ: javascript: / data: 等の危険なスキームを排除。
 * サーバー返却値を img src 等に渡す前に検証する。
 * あわせて、SWA + App Service の別オリジン構成では相対パス（/api/media/...）を
 * VITE_API_URL 前置の絶対URLに解決する（未設定=同一オリジン/ローカルdevではそのまま）。
 */
export function sanitizeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // ローカルプレビュー用に自前で生成した objectURL は許可
  if (url.startsWith("blob:")) return url;

  // 相対パス（/api/media/...）は許可し、APIオリジンが設定されていれば絶対URL化
  if (url.startsWith("/")) {
    const origin = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
    return origin ? `${origin}${url}` : url;
  }

  // http(s) のみ許可
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    // 不正なURL
  }

  return null;
}
