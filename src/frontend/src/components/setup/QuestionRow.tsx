import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  onSaved,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("border border-gray-200 rounded-lg overflow-hidden bg-white", isDragging && "shadow-lg")}>
      {/* コンパクト行 */}
      <div
        className={cn(
          "w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3",
          isExpanded && "bg-gray-50",
        )}
      >
        {/* ドラッグハンドル */}
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors duration-150 p-2 shrink-0 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={`問題${index + 1}をドラッグして並べ替え`}
          {...attributes}
          {...listeners}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
          </svg>
        </button>
        {/* トグル部分 */}
        <button
          type="button"
          className={cn(
            "flex-1 flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-gray-50 transition-colors duration-150 text-left min-w-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded",
          )}
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={`問題${index + 1}: ${question.text}`}
        >
          <span className="text-sm font-bold text-gray-400 shrink-0">[{index + 1}]</span>
          <span className="flex-1 text-sm font-medium text-gray-800 truncate min-w-0">{question.text}</span>
          {question.media_url && question.media_type === "image" && (
            <span className="text-xs text-gray-400 shrink-0" aria-hidden="true">画像</span>
          )}
          {/* 展開/折りたたみインジケーター */}
          <span className="text-gray-400 shrink-0" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform duration-200", isExpanded && "rotate-180")}><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </button>
        {/* 並べ替えボタン */}
        <div className="flex gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onReorder(index, "up")}
            disabled={index === 0}
            aria-label={`問題${index + 1}を上へ移動`}
            className={cn(
              "min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-sm transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              index === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-500 hover:bg-gray-200 cursor-pointer",
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button
            type="button"
            onClick={() => onReorder(index, "down")}
            disabled={index === totalCount - 1}
            aria-label={`問題${index + 1}を下へ移動`}
            className={cn(
              "min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-sm transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              index === totalCount - 1
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-500 hover:bg-gray-200 cursor-pointer",
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
      </div>

      {/* アコーディオン展開 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" as const }}
          >
            <QuestionInlineForm
              key={question.id}
              question={question}
              quizId={quizId}
              onSaved={onSaved}
              onCancel={onCollapse}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
