import { timingSafeEqual } from "crypto";

/** タイミングセーフな文字列比較 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // バイト長で比較する。文字列長（UTF-16単位）が同じでもマルチバイトで
  // バイト長が異なると timingSafeEqual が例外（RangeError）を投げるため（L-5）。
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
