// スコア計算: 正解時 1000 * (1 - responseTime / (timeLimit * 2)) → 500~1000点
export function calculateScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitSeconds: number
): number {
  if (!isCorrect) return 0;
  const timeLimitMs = timeLimitSeconds * 1000;
  const ratio = responseTimeMs / (timeLimitMs * 2);
  const score = Math.round(1000 * (1 - ratio));
  return Math.max(500, Math.min(1000, score));
}
