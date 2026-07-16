// サーバーサイドタイマー管理
// process.hrtime.bigint() で高精度タイミングを実現
import { logger } from "../utils/logger.js";

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
    try {
      const elapsed = Number(process.hrtime.bigint() - startTime) / 1_000_000;
      const remaining = Math.max(0, durationSeconds - elapsed / 1000);

      if (remaining <= 0) {
        stopTimer(key);
        // onEnd は async（結果配信）。同期・非同期どちらの例外も握りつぶさず
        // ログするため Promise.resolve でラップして catch する。これがないと
        // tick中の未捕捉例外/rejection でプロセス全体が落ち、全roomが消える。
        Promise.resolve(onEnd()).catch((e) => {
          logger.error("timer onEnd error", { key, error: e instanceof Error ? e.message : String(e) });
        });
      } else {
        onTick(Math.ceil(remaining));
      }
    } catch (e) {
      logger.error("timer tick error", { key, error: e instanceof Error ? e.message : String(e) });
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
