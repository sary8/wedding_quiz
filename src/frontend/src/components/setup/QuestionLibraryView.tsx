import { useState, useEffect } from "react";
import type { QuizSummary, Quiz, QuestionBankItem } from "../../types";
import { QuizStatus } from "../../types";
import { getQuiz, listBankQuestions, deleteBankQuestion } from "../../services/api";
import { cn } from "../../utils/cn";
import { CHOICE_LABELS } from "./constants";

type Props = {
  quizList: QuizSummary[];
};

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

export function QuestionLibraryView({ quizList }: Props) {
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([]);
  const [pastQuizzes, setPastQuizzes] = useState<Quiz[]>([]);
  const [isLoadingBank, setIsLoadingBank] = useState(true);
  const [isLoadingPast, setIsLoadingPast] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    loadBank();
    loadPastQuizzes();
  }, []);

  async function loadBank() {
    setIsLoadingBank(true);
    try {
      const data = await listBankQuestions();
      setBankQuestions(data);
    } catch {
      setError("テンプレートの読み込みに失敗しました");
    } finally {
      setIsLoadingBank(false);
    }
  }

  async function loadPastQuizzes() {
    setIsLoadingPast(true);
    const finished = quizList.filter((q) => q.status === QuizStatus.Finished && q.question_count > 0);
    const results: Quiz[] = [];

    for (const q of finished) {
      try {
        const quiz = await getQuiz(q.id);
        results.push(quiz);
      } catch {
        // skip quizzes we can't load
      }
    }

    setPastQuizzes(results);
    setIsLoadingPast(false);
  }

  async function handleDeleteBank(id: number) {
    setPendingDeleteId(null);
    try {
      await deleteBankQuestion(id);
      setBankQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch {
      setError("テンプレートからの削除に失敗しました");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* テンプレート */}
      <section className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-3 text-gray-800">テンプレート</h2>
        {isLoadingBank ? (
          <p className="text-sm text-gray-500 text-center py-4">読み込み中…</p>
        ) : bankQuestions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            テンプレートに問題がありません。問題の編集画面から「テンプレートに保存」で追加できます。
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {bankQuestions.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800">{q.text}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    正解: {CHOICE_LABELS[q.correct_choice - 1]} ・ {q.time_limit_seconds}秒 ・ {q.points}点
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {[q.choice1, q.choice2, q.choice3, q.choice4].map((c, ci) => (
                      <span key={ci} className={ci + 1 === q.correct_choice ? "font-semibold text-gray-600" : ""}>
                        {CHOICE_LABELS[ci]}.{c}{ci < 3 ? " / " : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0">
                  {pendingDeleteId === q.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteBank(q.id)}
                        aria-label={`「${q.text}」を削除`}
                        className={cn("px-3 py-1.5 rounded text-xs text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                      >
                        確認
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className={cn("px-3 py-1.5 rounded text-xs text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                      >
                        戻る
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(q.id)}
                      aria-label={`「${q.text}」を削除`}
                      className={cn("px-3 py-1.5 rounded text-xs text-red-500 hover:bg-red-50 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 過去の問題 */}
      <section className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-3 text-gray-800">過去の問題</h2>
        {isLoadingPast ? (
          <p className="text-sm text-gray-500 text-center py-4">読み込み中…</p>
        ) : pastQuizzes.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            完了済みのクイズがありません
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pastQuizzes.map((quiz) => (
              <div key={quiz.id}>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">{quiz.title}</h3>
                <div className="flex flex-col gap-1">
                  {quiz.questions?.map((question, qi) => (
                    <div key={question.id} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="text-sm text-gray-800">
                        <span className="text-gray-400 mr-1">Q{qi + 1}.</span>
                        {question.text}
                      </div>
                      {question.media_url && (
                        <img
                          src={question.media_url}
                          alt={`Q${qi + 1}の画像`}
                          className="mt-2 max-h-32 rounded-lg object-contain"
                        />
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {[question.choice1, question.choice2, question.choice3, question.choice4].map((c, ci) => (
                          <span key={ci} className={ci + 1 === question.correct_choice ? "font-semibold text-green-700" : ""}>
                            {CHOICE_LABELS[ci]}.{c}{ci < 3 ? " / " : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
