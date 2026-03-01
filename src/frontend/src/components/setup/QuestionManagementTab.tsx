import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
  const questionsRef = useRef(questions);
  useEffect(() => {
    questionsRef.current = questions;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const current = questionsRef.current;
      const oldIndex = current.findIndex((q) => q.id === active.id);
      const newIndex = current.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      setExpandedQuestionId(null);
      const ids = current.map((q) => q.id);
      const [moved] = ids.splice(oldIndex, 1);
      ids.splice(newIndex, 0, moved);
      try {
        await reorderQuestions(quiz.id, ids);
        onUpdate();
      } catch {
        setError("問題の並べ替えに失敗しました");
      }
    },
    [quiz.id, onUpdate],
  );

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
      const current = questionsRef.current;
      const targetIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return;
      setExpandedQuestionId(null);
      const ids = current.map((q) => q.id);
      [ids[questionIndex], ids[targetIndex]] = [ids[targetIndex], ids[questionIndex]];
      try {
        await reorderQuestions(quiz.id, ids);
        onUpdate();
      } catch {
        setError("問題の並べ替えに失敗しました");
      }
    },
    [quiz.id, onUpdate],
  );

  const handleTemplateImport = useCallback(
    async (bankQuestionIds: number[]) => {
      if (bankQuestionIds.length === 0) return;
      await importBankToQuiz(quiz.id, bankQuestionIds);
      onUpdate();
    },
    [quiz.id, onUpdate],
  );

  const motionTransition = useMemo(
    () => prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" as const },
    [prefersReducedMotion],
  );

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
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={motionTransition}
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
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
                  onSaved={handleSaved}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={motionTransition}
            className="mt-2"
          >
            <div className="border border-choice-blue rounded-lg overflow-hidden bg-white">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <span className="text-sm font-semibold text-choice-blue">新しい問題を追加</span>
              </div>
              <QuestionInlineForm
                question={null}
                quizId={quiz.id}
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
