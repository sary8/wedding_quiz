import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Question } from "../../types";
import { cn } from "../../utils/cn";
import { QuestionInlineForm } from "./QuestionInlineForm";

type Props = {
  question: Question;
  index: number;
  totalCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onReorder: (index: number, direction: "up" | "down") => void;
  quizId: number;
  hostSecret: string;
  onSaved: () => void;
};

export function QuestionRow({
  question,
  index,
  totalCount,
  isExpanded,
  onToggle,
  onCollapse,
  onReorder,
  quizId,
  hostSecret,
  onSaved,
}: Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* コンパクト行 */}
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
          isExpanded && "bg-gray-50",
        )}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`問題${index + 1}: ${question.text}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="text-sm font-bold text-gray-400 shrink-0">[{index + 1}]</span>
        <span className="flex-1 text-sm font-medium text-gray-800 truncate min-w-0">{question.text}</span>
        {question.media_url && question.media_type === "image" && (
          <span className="text-xs text-gray-400 shrink-0" aria-hidden="true">画像</span>
        )}
        {/* 並べ替えボタン */}
        <div
          className="flex gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onReorder(index, "up")}
            disabled={index === 0}
            aria-label={`問題${index + 1}を上へ移動`}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded text-sm transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              index === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-500 hover:bg-gray-200 cursor-pointer",
            )}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onReorder(index, "down")}
            disabled={index === totalCount - 1}
            aria-label={`問題${index + 1}を下へ移動`}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded text-sm transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              index === totalCount - 1
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-500 hover:bg-gray-200 cursor-pointer",
            )}
          >
            ↓
          </button>
        </div>
        {/* 展開/折りたたみインジケーター */}
        <span className="text-gray-400 text-sm shrink-0" aria-hidden="true">{isExpanded ? "▲" : "▼"}</span>
      </div>

      {/* アコーディオン展開 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
            style={{ overflow: "hidden" }}
          >
            <QuestionInlineForm
              question={question}
              quizId={quizId}
              hostSecret={hostSecret}
              onSaved={onSaved}
              onCancel={onCollapse}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
