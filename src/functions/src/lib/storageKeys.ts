// selfie の blob キーと、そのサムネイル（WebP）キーの対応を扱う純粋関数群。
// backend の routes/media.ts / storage の命名（selfies/{roomCode}/... ）と対になる。

/**
 * サムネ生成の対象となる selfie 画像かどうか。
 * thumbnails/ 配下（＝生成物）は対象外にし、Blobトリガーの再発火（無限ループ）を防ぐ。
 */
export function isSelfieBlob(key: string): boolean {
  return key.startsWith("selfies/") && !key.includes("thumbnails/");
}

/**
 * selfie の blob キーから、対応するサムネイル（WebP）のキーを導出する。
 * 例: selfies/AB12/selfie_AB12_xxx.jpg -> thumbnails/selfies/AB12/selfie_AB12_xxx.webp
 * 拡張子のないキーはそのまま .webp を付す。
 */
export function thumbnailKeyFor(selfieKey: string): string {
  const withoutExt = selfieKey.replace(/\.[^./]+$/, "");
  return `thumbnails/${withoutExt}.webp`;
}
