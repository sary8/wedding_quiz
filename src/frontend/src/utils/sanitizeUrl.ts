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

/**
 * メディアURLにサムネイル指定(?v=thumb)を付ける。
 * /api/media/ を含むURLにのみ付与し、blob: や外部URL・空値はそのまま返す。
 * sanitizeMediaUrl の前段で使う想定: sanitizeMediaUrl(withThumb(url))。
 * バックエンドは ?v=thumb でWebPサムネを返し、未生成なら自動でオリジナルにフォールバックする。
 */
export function withThumb(url: string | null | undefined): string | null | undefined {
  if (!url || !url.includes("/api/media/")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=thumb`;
}
