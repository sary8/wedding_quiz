// 保持期限（retention）の判定ロジック。Blobの lastModified だけで判定し DB は参照しない。

const DAY_MS = 24 * 60 * 60 * 1000;

/** lastModified が retentionDays を「超えて」古ければ期限切れ（ちょうど境界は未超過扱い）。 */
export function isExpired(lastModified: Date, retentionDays: number, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - lastModified.getTime();
  return ageMs > retentionDays * DAY_MS;
}

export interface BlobInfo {
  name: string;
  lastModified?: Date;
}

/**
 * 保持期限を過ぎた selfie の blob 名だけを返す。
 * - thumbnails/ 配下は除外（サムネは selfie 削除時に連動削除するため、二重に列挙しない）
 * - lastModified が不明なものは安全側に倒して対象外
 */
export function selectExpiredNames(
  blobs: BlobInfo[],
  retentionDays: number,
  now: Date = new Date()
): string[] {
  return blobs
    .filter((b) => b.name.startsWith("selfies/") && !b.name.includes("thumbnails/"))
    .filter((b) => b.lastModified !== undefined && isExpired(b.lastModified, retentionDays, now))
    .map((b) => b.name);
}
