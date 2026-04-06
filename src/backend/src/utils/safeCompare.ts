import { timingSafeEqual } from "crypto";

/** タイミングセーフな文字列比較 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
