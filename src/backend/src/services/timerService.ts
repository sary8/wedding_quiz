// サーバーサイドタイマー管理
// process.hrtime.bigint() で高精度タイミングを実現

type TimerCallback = (remaining: number) => void;
type TimerEndCallback = () => void;

type ActiveTimer = {
  intervalId: ReturnType<typeof setInterval>;
  startTime: bigint;
  durationMs: number;
};

const activeTimers = new Map<string, ActiveTimer>();

export function startTimer(
  key: string,
  durationSeconds: number,
  onTick: TimerCallback,
  onEnd: TimerEndCallback
): void {
  stopTimer(key);

  const durationMs = durationSeconds * 1000;
  const startTime = process.hrtime.bigint();

  // 初回tickを即時発火（クライアントに初期値を送信）
  onTick(durationSeconds);

  const intervalId = setInterval(() => {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const remaining = Math.max(0, durationSeconds - elapsed / 1000);

    if (remaining <= 0) {
      stopTimer(key);
      onEnd();
    } else {
      onTick(Math.ceil(remaining));
    }
  }, 1000);

  activeTimers.set(key, { intervalId, startTime, durationMs });
}

export function stopTimer(key: string): void {
  const timer = activeTimers.get(key);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(key);
  }
}

export function getElapsedMs(key: string): number | null {
  const timer = activeTimers.get(key);
  if (!timer) return null;
  return Number(process.hrtime.bigint() - timer.startTime) / 1_000_000;
}

export function getRemainingSeconds(key: string): number | null {
  const timer = activeTimers.get(key);
  if (!timer) return null;
  const elapsed = Number(process.hrtime.bigint() - timer.startTime) / 1_000_000;
  return Math.max(0, Math.ceil(timer.durationMs / 1000 - elapsed / 1000));
}
