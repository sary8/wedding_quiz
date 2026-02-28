import { useRef, useState, useCallback, useEffect, useMemo } from "react";

const BgmTrack = {
  Lobby: "lobby",
  Question: "question",
  Results: "results",
} as const;
type BgmTrack = (typeof BgmTrack)[keyof typeof BgmTrack];

export type { BgmTrack };
export { BgmTrack as BgmTrackValues };

const STORAGE_KEY_VOLUME = "bgm_volume";
const STORAGE_KEY_MUTED = "bgm_muted";
const FADE_DURATION_MS = 1000;
const FADE_INTERVAL_MS = 50;

function loadVolume(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
    if (stored !== null) {
      const v = Number(stored);
      if (!Number.isNaN(v) && v >= 0 && v <= 1) return v;
    }
  } catch {
    // localStorage unavailable
  }
  return 0.5;
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_MUTED) === "true";
  } catch {
    return false;
  }
}

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTrackRef = useRef<BgmTrack | null>(null);
  const [volume, setVolumeState] = useState(loadVolume);
  const [isMuted, setIsMutedState] = useState(loadMuted);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  // audio要素の初期化（volumeは下のuseEffectで同期される）
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // volume/mute変更をaudio要素に反映
  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const play = useCallback((track: BgmTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    // 同一トラックなら何もしない
    if (currentTrackRef.current === track && !audio.paused) return;

    // フェード中ならキャンセル
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    currentTrackRef.current = track;
    audio.src = `/audio/${track}.mp3`;
    audio.volume = isMutedRef.current ? 0 : volumeRef.current;
    audio.play().catch(() => {
      // ユーザー操作前の自動再生ブロック — 無視
    });
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    audio.pause();
    audio.src = "";
    currentTrackRef.current = null;
  }, []);

  const fadeOut = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
    }

    const steps = FADE_DURATION_MS / FADE_INTERVAL_MS;
    const decrement = audio.volume / steps;

    fadeTimerRef.current = setInterval(() => {
      if (audio.volume <= decrement) {
        audio.volume = 0;
        audio.pause();
        audio.src = "";
        currentTrackRef.current = null;
        if (fadeTimerRef.current) {
          clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
      } else {
        audio.volume -= decrement;
      }
    }, FADE_INTERVAL_MS);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    try { localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped)); } catch { /* storage unavailable */ }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMutedState((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY_MUTED, String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  return useMemo(() => ({ play, stop, fadeOut, volume, setVolume, isMuted, toggleMute }), [play, stop, fadeOut, volume, setVolume, isMuted, toggleMute]);
}
