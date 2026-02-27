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
  const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
  if (stored !== null) {
    const v = Number(stored);
    if (!Number.isNaN(v) && v >= 0 && v <= 1) return v;
  }
  return 0.5;
}

function loadMuted(): boolean {
  return localStorage.getItem(STORAGE_KEY_MUTED) === "true";
}

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTrackRef = useRef<BgmTrack | null>(null);
  const [volume, setVolumeState] = useState(loadVolume);
  const [isMuted, setIsMutedState] = useState(loadMuted);

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
    audio.volume = isMuted ? 0 : volume;
    audio.play().catch(() => {
      // ユーザー操作前の自動再生ブロック — 無視
    });
  }, [volume, isMuted]);

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
    localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMutedState((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY_MUTED, String(next));
      return next;
    });
  }, []);

  return useMemo(() => ({ play, stop, fadeOut, volume, setVolume, isMuted, toggleMute }), [play, stop, fadeOut, volume, setVolume, isMuted, toggleMute]);
}
