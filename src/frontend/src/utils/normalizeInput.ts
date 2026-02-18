/**
 * 全角数字を半角に変換する。
 * 例: "１２３" → "123"
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * ルームコード用の正規化: 全角→半角変換 + 数字のみ抽出
 */
export function normalizeRoomCode(raw: string): string {
  return toHalfWidth(raw).replace(/[^0-9]/g, "");
}
