import { useState, useCallback } from "react";
import type { Quiz, Question } from "../../types";
import { reorderQuestions, importBankToQuiz } from "../../services/api";
import { QuestionCard } from "./QuestionCard";
import { QuestionFormModal } from "./QuestionFormModal";
import { QuestionBankModal } from "./QuestionBankModal";

type Props = {
  quiz: Quiz;
  onUpdate: () => void;
};

export function QuestionList({ quiz, onUpdate }: Props) {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = quiz.questions ?? [];

  function handleAddNew() {
    setEditingQuestion(null);
    setFormModalOpen(true);
  }

  function handleEdit(question: Question) {
    setEditingQuestion(question);
    setFormModalOpen(true);
  }

  function handleFormClose() {
    setFormModalOpen(false);
    setEditingQuestion(null);
  }

  const handleReorder = useCallback(
    async (questionIndex: number, direction: "up" | "down") => {
      const targetIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1;
      if (targetIndex < 0 || targetIndex >= questions.length) return;
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

  const handleBankImport = useCallback(
    async (bankQuestionIds: number[]) => {
      if (bankQuestionIds.length === 0) return;
      await importBankToQuiz(quiz.id, quiz.host_secret, bankQuestionIds);
      onUpdate();
    },
    [quiz.id, quiz.host_secret, onUpdate],
  );

  return (
    <div>
      {/* Action bar */}
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={handleAddNew}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1e88e5] hover:opacity-90 transition-colors duration-150 min-h-[44px] cursor-pointer"
        >
          + 新しい問題を追加
        </button>
        <button
          type="button"
          onClick={() => setBankModalOpen(true)}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors duration-150 min-h-[44px]"
        >
          問題バンクから追加
        </button>
      </div>

      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="w-full mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200 hover:bg-red-100 transition-colors duration-150"
        >
          {error}（タップで閉じる）
        </button>
      )}

      {/* Question cards */}
      {questions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              totalCount={questions.length}
              onEdit={handleEdit}
              onReorder={handleReorder}
            />
          ))}
        </div>
      ) : (
        <p className="text-center py-8 text-gray-400 text-sm">
          まだ問題がありません。上のボタンから追加してください。
        </p>
      )}

      {/* Modals */}
      <QuestionFormModal
        isOpen={formModalOpen}
        onClose={handleFormClose}
        question={editingQuestion}
        quizId={quiz.id}
        hostSecret={quiz.host_secret}
        onSaved={onUpdate}
      />
      <QuestionBankModal
        isOpen={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        onImport={handleBankImport}
      />
    </div>
  );
}
