import { useState, useEffect, useCallback } from "react";
import type { QuizSummary, Quiz, QuestionBankItem } from "../../types";
import { QuizStatus } from "../../types";
import { getQuiz, listBankQuestions } from "../../services/api";
import { cn } from "../../utils/cn";
import { CHOICE_LABELS } from "./constants";
import { QuestionInlineForm } from "./QuestionInlineForm";

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
  const [expandedBankId, setExpandedBankId] = useState<number | "new" | null>(null);

  const loadBank = useCallback(async () => {
    setIsLoadingBank(true);
    try {
      const data = await listBankQuestions();
      setBankQuestions(data);
    } catch {
      setError("テンプレートの読み込みに失敗しました");
    } finally {
      setIsLoadingBank(false);
    }
  }, []);

  const loadPastQuizzes = useCallback(async () => {
    setIsLoadingPast(true);
    const finished = quizList.filter((q) => q.status === QuizStatus.Finished && q.question_count > 0);

    const settled = await Promise.allSettled(finished.map((q) => getQuiz(q.id)));
    const results = settled
      .filter((r): r is PromiseFulfilledResult<Quiz> => r.status === "fulfilled")
      .map((r) => r.value);

    setPastQuizzes(results);
    setIsLoadingPast(false);
  }, [quizList]);

  useEffect(() => {
    loadBank();
    loadPastQuizzes();
  }, [loadBank, loadPastQuizzes]);

  function handleBankSaved() {
    setExpandedBankId(null);
    loadBank();
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">テンプレート</h2>
          <button
            type="button"
            onClick={() => setExpandedBankId(expandedBankId === "new" ? null : "new")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold text-white bg-choice-blue hover:opacity-90 transition-colors duration-150 min-h-[44px] cursor-pointer",
              btnFocus,
            )}
          >
            + 新規追加
          </button>
        </div>

        {/* 新規追加フォーム */}
        {expandedBankId === "new" && (
          <div className="mb-4 border border-choice-blue rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-semibold text-choice-blue">新しいテンプレートを追加</span>
            </div>
            <QuestionInlineForm
              key="new"
              mode="bank"
              question={null}
              onSaved={handleBankSaved}
              onCancel={() => setExpandedBankId(null)}
            />
          </div>
        )}

        {isLoadingBank ? (
          <p className="text-sm text-gray-500 text-center py-4">読み込み中…</p>
        ) : bankQuestions.length === 0 && expandedBankId !== "new" ? (
          <p className="text-sm text-gray-500 text-center py-4">
            テンプレートに問題がありません。上のボタンから追加できます。
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {bankQuestions.map((q) => (
              <div key={q.id}>
                {expandedBankId === q.id ? (
                  <div className="border border-accent rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-accent/5 border-b border-accent/20">
                      <span className="text-sm font-semibold text-gray-700">テンプレートを編集</span>
                    </div>
                    <QuestionInlineForm
                      key={q.id}
                      mode="bank"
                      question={q}
                      onSaved={handleBankSaved}
                      onCancel={() => setExpandedBankId(null)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setExpandedBankId(q.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 transition-colors duration-150 cursor-pointer",
                      btnFocus,
                    )}
                  >
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
                  </button>
                )}
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
