// スコア計算: 正解時 1000 * (1 - responseTime / (timeLimit * 2)) × 倍率 → (500~1000) × multiplier
export function calculateScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitSeconds: number,
  pointMultiplier: number = 1
): number {
  if (!isCorrect) return 0;
  const timeLimitMs = timeLimitSeconds * 1000;
  const ratio = responseTimeMs / (timeLimitMs * 2);
  const baseScore = Math.max(500, Math.min(1000, Math.round(1000 * (1 - ratio))));
  return Math.round(baseScore * pointMultiplier);
}
