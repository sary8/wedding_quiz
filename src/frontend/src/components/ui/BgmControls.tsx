import { useState } from "react";

type Props = {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
};

function SpeakerIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export function BgmControls({ volume, isMuted, onVolumeChange, onToggleMute }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg p-3 flex items-center gap-3 min-w-[180px]">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? "ミュート解除" : "ミュート"}
            className="p-1 text-gray-700 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <SpeakerIcon muted={isMuted} />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              onVolumeChange(v);
              if (isMuted && v > 0) onToggleMute();
            }}
            className="flex-1 h-2 accent-pink-500"
            aria-label="BGM音量"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "BGMコントロールを閉じる" : "BGMコントロールを開く"}
        className="w-12 h-12 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-white transition-colors"
      >
        <SpeakerIcon muted={isMuted} />
      </button>
    </div>
  );
}
