import { useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Quiz } from "../../types";
import { reorderQuestions, importBankToQuiz } from "../../services/api";
import { QuestionRow } from "./QuestionRow";
import { QuestionInlineForm } from "./QuestionInlineForm";
import { TemplatePanel } from "./TemplatePanel";

type Props = {
  quiz: Quiz;
  onUpdate: () => void;
};

export function QuestionManagementTab({ quiz, onUpdate }: Props) {
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | "new" | null>(null);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const questions = quiz.questions ?? [];

  function handleAddNew() {
    setExpandedQuestionId("new");
  }

  function handleToggle(questionId: number) {
    setExpandedQuestionId((prev) => (prev === questionId ? null : questionId));
  }

  function handleCollapse() {
    setExpandedQuestionId(null);
  }

  function handleSaved() {
    setExpandedQuestionId(null);
    onUpdate();
  }

  const handleReorder = useCallback(
    async (questionIndex: number, direction: "up" | "down") => {
      const targetIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1;
      if (targetIndex < 0 || targetIndex >= questions.length) return;
      setExpandedQuestionId(null);
      const ids = questions.map((q) => q.id);
      [ids[questionIndex], ids[targetIndex]] = [ids[targetIndex], ids[questionIndex]];
      try {
        await reorderQuestions(quiz.id, quiz.host_secret, ids);
        onUpdate();
      } catch {
        setError("問題の並べ替えに失敗しました");
      }
    },
    [questions, quiz.id, quiz.host_secret, onUpdate],
  );

  const handleTemplateImport = useCallback(
    async (bankQuestionIds: number[]) => {
      if (bankQuestionIds.length === 0) return;
      await importBankToQuiz(quiz.id, quiz.host_secret, bankQuestionIds);
      onUpdate();
    },
    [quiz.id, quiz.host_secret, onUpdate],
  );

  const motionTransition = prefersReducedMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 300, damping: 30 };

  return (
    <div>
      {/* アクションバー */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={handleAddNew}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-choice-blue hover:opacity-90 transition-colors duration-150 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-choice-blue/50"
        >
          + 新しい問題を追加
        </button>
        <button
          type="button"
          onClick={() => setIsTemplateOpen((prev) => !prev)}
          className="text-sm font-semibold text-purple-700 hover:text-purple-900 transition-colors duration-150 cursor-pointer py-2 px-3 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 rounded-lg"
        >
          {isTemplateOpen ? "テンプレートを閉じる" : "テンプレートから追加"}
        </button>
      </div>

      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="w-full mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200 hover:bg-red-100 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
        >
          {error}（タップで閉じる）
        </button>
      )}

      {/* テンプレートパネル */}
      <AnimatePresence>
        {isTemplateOpen && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={motionTransition}
            style={{ overflow: "hidden" }}
          >
            <TemplatePanel
              onImport={handleTemplateImport}
              onClose={() => setIsTemplateOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 問題行リスト */}
      {questions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              question={q}
              index={i}
              totalCount={questions.length}
              isExpanded={expandedQuestionId === q.id}
              onToggle={() => handleToggle(q.id)}
              onCollapse={handleCollapse}
              onReorder={handleReorder}
              quizId={quiz.id}
              hostSecret={quiz.host_secret}
              onSaved={handleSaved}
            />
          ))}
        </div>
      ) : (
        !expandedQuestionId && (
          <p className="text-center py-8 text-gray-400 text-sm">
            まだ問題がありません。上のボタンから追加してください。
          </p>
        )
      )}

      {/* 新規追加フォーム */}
      <AnimatePresence>
        {expandedQuestionId === "new" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={motionTransition}
            style={{ overflow: "hidden" }}
            className="mt-2"
          >
            <div className="border border-choice-blue rounded-lg overflow-hidden bg-white">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <span className="text-sm font-semibold text-choice-blue">新しい問題を追加</span>
              </div>
              <QuestionInlineForm
                question={null}
                quizId={quiz.id}
                hostSecret={quiz.host_secret}
                onSaved={handleSaved}
                onCancel={handleCollapse}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
