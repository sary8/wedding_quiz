import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ParticipantInfo } from "../../types";

type Props = {
  participants: ParticipantInfo[];
  onBackToSetup?: () => void;
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

export function ThankYouScreen({ participants, onBackToSetup, isDisplay }: Props) {
  const prefersReducedMotion = useReducedMotion();

  const floatConfigs = useMemo(
    () => generateFloatConfigs(participants),
    [participants]
  );

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* タイトル */}
      <h2 className="font-script text-4xl md:text-5xl text-amber-800 text-center z-10 mb-4">
        ご参加ありがとうございました！
      </h2>

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

      {/* ホストのみ: 管理画面に戻るボタン */}
      {onBackToSetup && !isDisplay && (
        <button
          type="button"
          onClick={onBackToSetup}
          className="mt-8 px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-lg font-bold min-h-[44px] hover:bg-amber-200 transition-colors duration-200 z-10 cursor-pointer"
        >
          管理画面に戻る
        </button>
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
        src={participant.selfieUrl}
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
