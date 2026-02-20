import { useRef, useCallback, useMemo } from "react";

function getAudioContext(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

function playNote(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.3
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = getAudioContext();
    }
    if (ctxRef.current?.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // C5→E5→G5 上昇チャイム
  const playJoinChime = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playNote(ctx, 523, t, 0.15);
    playNote(ctx, 659, t + 0.1, 0.15);
    playNote(ctx, 784, t + 0.2, 0.2);
  }, [ensureCtx]);

  // 緊張感のある A4-B4 パターン
  const playQuestionStart = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playNote(ctx, 440, t, 0.12, "square", 0.2);
    playNote(ctx, 494, t + 0.12, 0.12, "square", 0.2);
    playNote(ctx, 440, t + 0.24, 0.12, "square", 0.2);
    playNote(ctx, 494, t + 0.36, 0.2, "square", 0.25);
  }, [ensureCtx]);

  // 880Hz 短パルス（カウントダウン用）
  const playTick = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    playNote(ctx, 880, ctx.currentTime, 0.08, "sine", 0.25);
  }, [ensureCtx]);

  // 200Hz+150Hz のこぎり波ブザー
  const playBuzzer = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playNote(ctx, 200, t, 0.4, "sawtooth", 0.25);
    playNote(ctx, 150, t, 0.4, "sawtooth", 0.15);
  }, [ensureCtx]);

  // E5→G5→C6 上昇音
  const playResultReveal = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playNote(ctx, 659, t, 0.15);
    playNote(ctx, 784, t + 0.12, 0.15);
    playNote(ctx, 1047, t + 0.24, 0.3);
  }, [ensureCtx]);

  // C5→E5→G5→C6 アルペジオ
  const playRankingFanfare = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    playNote(ctx, 523, t, 0.15, "triangle", 0.3);
    playNote(ctx, 659, t + 0.12, 0.15, "triangle", 0.3);
    playNote(ctx, 784, t + 0.24, 0.15, "triangle", 0.3);
    playNote(ctx, 1047, t + 0.36, 0.4, "triangle", 0.35);
  }, [ensureCtx]);

  // 150Hz 連続パルス（ドラムロール風）
  const playDrumRoll = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 16; i++) {
      playNote(ctx, 150, t + i * 0.06, 0.05, "triangle", 0.2 + i * 0.01);
    }
  }, [ensureCtx]);

  // ランク別ファンファーレ（3=ブロンズ、2=シルバー、1=ゴールド）
  const playFanfare = useCallback((rank: number) => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;

    if (rank === 3) {
      // ブロンズ: シンプルな2音
      playNote(ctx, 330, t, 0.2, "triangle", 0.3);
      playNote(ctx, 440, t + 0.2, 0.4, "triangle", 0.35);
    } else if (rank === 2) {
      // シルバー: 3音アルペジオ
      playNote(ctx, 440, t, 0.15, "triangle", 0.3);
      playNote(ctx, 554, t + 0.15, 0.15, "triangle", 0.3);
      playNote(ctx, 659, t + 0.3, 0.4, "triangle", 0.35);
    } else if (rank === 1) {
      // ゴールド: 豪華な4音 + オクターブ
      playNote(ctx, 523, t, 0.15, "triangle", 0.3);
      playNote(ctx, 659, t + 0.15, 0.15, "triangle", 0.3);
      playNote(ctx, 784, t + 0.3, 0.15, "triangle", 0.35);
      playNote(ctx, 1047, t + 0.45, 0.5, "triangle", 0.4);
      playNote(ctx, 1047, t + 0.45, 0.5, "sine", 0.2);
    }
  }, [ensureCtx]);

  return useMemo(() => ({
    playJoinChime,
    playQuestionStart,
    playTick,
    playBuzzer,
    playResultReveal,
    playRankingFanfare,
    playDrumRoll,
    playFanfare,
  }), [playJoinChime, playQuestionStart, playTick, playBuzzer, playResultReveal, playRankingFanfare, playDrumRoll, playFanfare]);
}
