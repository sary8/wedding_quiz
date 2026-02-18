import type { Question } from "../../types";
import { cn } from "../../utils/cn";
import { CHOICE_BG_CLASSES, CHOICE_LABELS } from "./constants";

type Props = {
  question: Question;
  index: number;
  totalCount: number;
  onEdit: (question: Question) => void;
  onReorder: (index: number, direction: "up" | "down") => void;
};

export function QuestionCard({ question, index, totalCount, onEdit, onReorder }: Props) {
  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100",
        "hover:border-accent/40 hover:shadow-md transition-all duration-150 cursor-pointer",
      )}
      onClick={() => onEdit(question)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(question);
        }
      }}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-2">
          {question.media_url && question.media_type === "image" && (
            <img
              src={question.media_url}
              alt="問題画像"
              width={64}
              height={48}
              loading="lazy"
              className="w-16 h-12 object-cover rounded shrink-0"
            />
          )}
          <div className="font-semibold text-base text-gray-800">
            Q{index + 1}. {question.text}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {[question.choice1, question.choice2, question.choice3, question.choice4].map((c, ci) => {
            const isCorrect = ci + 1 === question.correct_choice;
            return (
              <div
                key={ci}
                className={cn(
                  "px-2.5 py-1 rounded text-sm",
                  isCorrect
                    ? `${CHOICE_BG_CLASSES[ci]} text-white font-semibold`
                    : "bg-gray-100 text-gray-600",
                )}
              >
                {CHOICE_LABELS[ci]}. {c}
              </div>
            );
          })}
        </div>

        <div className="text-xs text-gray-400 mt-1.5">
          制限時間: {question.time_limit_seconds}秒 ・ 配点: {question.points}点
        </div>

        <div className="text-xs text-accent/60 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          クリックして編集
        </div>
      </div>

      {/* Reorder buttons */}
      <div
        className="flex flex-col gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onReorder(index, "up")}
          disabled={index === 0}
          aria-label="上へ移動"
          className={cn(
            "px-2 py-1 rounded text-sm transition-colors duration-150 min-h-[32px]",
            index === 0
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-500 hover:bg-gray-100 cursor-pointer",
          )}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onReorder(index, "down")}
          disabled={index === totalCount - 1}
          aria-label="下へ移動"
          className={cn(
            "px-2 py-1 rounded text-sm transition-colors duration-150 min-h-[32px]",
            index === totalCount - 1
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-500 hover:bg-gray-100 cursor-pointer",
          )}
        >
          ↓
        </button>
      </div>
    </div>
  );
}
