import { useMemo, useState } from "react";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";
import { motion, useReducedMotion } from "framer-motion";
import type { ParticipantInfo } from "../../types";

type Props = {
  participants: ParticipantInfo[];
  onBackToSetup?: () => void;
  onDeleteQuiz?: () => Promise<void>;
  isDisplay?: boolean;
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const PASTEL_BORDER_CLASSES = [
  "border-choice-pastel-rose",
  "border-choice-pastel-sky",
  "border-choice-pastel-mint",
  "border-choice-pastel-amber",
];

const PASTEL_BG_CLASSES = [
  "bg-choice-pastel-rose/40",
  "bg-choice-pastel-sky/40",
  "bg-choice-pastel-mint/40",
  "bg-choice-pastel-amber/40",
];

type FloatConfig = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
};

function generateFloatConfigs(participants: ParticipantInfo[]): FloatConfig[] {
  return participants.map((p) => {
    const r1 = seededRandom(p.id);
    const r2 = seededRandom(p.id + 1000);
    const r3 = seededRandom(p.id + 2000);
    const r4 = seededRandom(p.id + 3000);
    const r5 = seededRandom(p.id + 4000);
    return {
      startX: r1 * 80 + 5,
      startY: r2 * 70 + 10,
      endX: r3 * 80 + 5,
      endY: r4 * 70 + 10,
      duration: 10 + r5 * 15,
    };
  });
}

export function ThankYouScreen({ participants, onBackToSetup, onDeleteQuiz, isDisplay }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [isPendingDelete, setIsPendingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const floatConfigs = useMemo(
    () => generateFloatConfigs(participants),
    [participants]
  );

  return (
    <div className="h-[100dvh] bg-botanical flex flex-col items-center justify-center relative overflow-hidden">
      {/* タイトル */}
      <h2 className="font-script text-5xl md:text-6xl text-shimmer text-center z-10 mb-6 [text-wrap:balance] animate-fade-up drop-shadow-[0_2px_8px_rgba(107,143,113,0.12)]">
        Thank You for Playing!
      </h2>
      <div className="gold-line w-48 z-10 mb-6" />

      {/* 浮遊アバター or 静的グリッド */}
      {prefersReducedMotion ? (
        <div className="flex flex-wrap justify-center gap-3 max-w-5xl z-0 px-4">
          {participants.map((p, i) => (
            <AvatarBubble key={p.id} participant={p} index={i} />
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 z-0">
          {participants.map((p, i) => {
            const config = floatConfigs[i];
            return (
              <motion.div
                key={p.id}
                className="absolute"
                initial={{
                  left: `${config.startX}%`,
                  top: `${config.startY}%`,
                }}
                animate={{
                  left: [`${config.startX}%`, `${config.endX}%`],
                  top: [`${config.startY}%`, `${config.endY}%`],
                }}
                transition={{
                  duration: config.duration,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
              >
                <AvatarBubble participant={p} index={i} />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ホストのみ: 操作ボタン */}
      {!isDisplay && (onBackToSetup || onDeleteQuiz) && (
        <div className="mt-8 flex flex-col items-center gap-3 z-10 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          {onBackToSetup && (
            <button
              type="button"
              onClick={onBackToSetup}
              className="px-8 py-4 rounded-xl glass-card-strong text-sage-text text-lg font-bold min-h-[44px] hover:bg-white/90 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              管理画面に戻る
            </button>
          )}
          {onDeleteQuiz && !isPendingDelete && (
            <button
              type="button"
              onClick={() => setIsPendingDelete(true)}
              className="px-6 py-2 rounded-lg text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors duration-150 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              ルームを削除
            </button>
          )}
          {onDeleteQuiz && isPendingDelete && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteQuiz();
                  } catch {
                    setIsPendingDelete(false);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                {isDeleting ? "削除中…" : "本当に削除する"}
              </button>
              <button
                type="button"
                onClick={() => setIsPendingDelete(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AvatarProps = {
  participant: ParticipantInfo;
  index: number;
};

function AvatarBubble({ participant, index }: AvatarProps) {
  const borderClass = PASTEL_BORDER_CLASSES[index % PASTEL_BORDER_CLASSES.length];
  const bgClass = PASTEL_BG_CLASSES[index % PASTEL_BG_CLASSES.length];

  if (participant.selfieUrl) {
    return (
      <img
        src={sanitizeMediaUrl(participant.selfieUrl) ?? undefined}
        alt={`${participant.nickname}のアバター`}
        width={80}
        height={80}
        className={`w-14 h-14 md:w-20 md:h-20 rounded-full object-cover border-[3px] ${borderClass} shadow-lg`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold ${bgClass} text-gray-900 border-[3px] ${borderClass} shadow-lg`}
    >
      {participant.nickname?.[0] || "?"}
    </div>
  );
}
