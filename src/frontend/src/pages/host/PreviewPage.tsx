import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getQuiz } from "../../services/api";
import type { Quiz, Question, QuestionData } from "../../types";
import { ChoiceButton } from "../../components/quiz/ChoiceButton";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";

const CHOICE_COLORS = ["red", "blue", "green", "yellow"] as const;
const NOOP = () => {};

function questionToPreviewData(question: Question, index: number, total: number): QuestionData {
  return {
    questionId: question.id,
    questionIndex: index,
    totalQuestions: total,
    text: question.text,
    mediaType: question.media_type,
    mediaUrl: question.media_url,
    choiceType: question.choice_type,
    choices: [question.choice1, question.choice2, question.choice3, question.choice4],
    choiceImageUrls: [question.choice1_image_url, question.choice2_image_url, question.choice3_image_url, question.choice4_image_url],
    timeLimitSeconds: question.time_limit_seconds,
    points: question.points,
  };
}

export function PreviewPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    getQuiz(Number(quizId))
      .then(setQuiz)
      .catch(() => setError("クイズの取得に失敗しました"));
  }, [quizId]);

  if (error) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900 gap-4">
        <p className="text-xl text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate(`/host/setup${quizId ? `?view=edit&quizId=${quizId}` : ""}`)}
          className="px-6 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold min-h-[44px] hover:bg-gray-300 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          ホスト画面に戻る
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-gradient-to-b from-blush to-white">
        <p className="text-lg text-gray-500">読み込み中…</p>
      </div>
    );
  }

  const questions = quiz.questions ?? [];
  if (questions.length === 0) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900 gap-4">
        <p className="text-xl">問題がありません</p>
        <button
          type="button"
          onClick={() => navigate(`/host/setup${quizId ? `?view=edit&quizId=${quizId}` : ""}`)}
          className="px-6 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold min-h-[44px] hover:bg-gray-300 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          ホスト画面に戻る
        </button>
      </div>
    );
  }

  const question = questionToPreviewData(questions[currentIndex], currentIndex, questions.length);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="h-[100dvh] flex flex-col bg-blush">
      {/* プレビューバナー */}
      <div className="bg-amber-100 text-amber-800 text-center py-2 text-sm font-bold">
        プレビューモード（参加者視点）
      </div>

      {/* ヘッダー: 問題番号 + 制限時間 */}
      <header className="flex justify-between items-center px-4 py-3 text-gray-900">
        <span className="text-sm">
          Q{question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <div className="text-4xl font-bold text-gray-900">
          {question.timeLimitSeconds}
        </div>
      </header>

      {/* 問題文 */}
      <div className="px-4 py-2 text-gray-900 text-center">
        {sanitizeMediaUrl(question.mediaUrl) && question.mediaType === "image" ? (
          <img
            src={sanitizeMediaUrl(question.mediaUrl)!}
            alt="問題の画像"
            className="max-w-[80%] max-h-[25vh] rounded-lg mb-2 object-cover mx-auto"
          />
        ) : null}
        <p className="text-xl font-bold">{question.text}</p>
      </div>

      {/* 4色回答ボタン（プレビュー：正解をハイライト） */}
      <div className="flex-1 grid grid-cols-2 gap-2 p-2" role="group" aria-label="回答選択肢プレビュー">
        {question.choices.map((choice, i) => {
          const choiceIndex = i + 1;
          const isCorrect = questions[currentIndex].correct_choice === choiceIndex;

          return (
            <ChoiceButton
              key={`preview-${currentIndex}-${i}`}
              choice={choice}
              color={CHOICE_COLORS[i]}
              isSelected={isCorrect}
              disabled={true}
              choiceIndex={choiceIndex}
              choiceImageUrl={question.choiceImageUrls?.[i]}
              onClick={NOOP}
              aria-label={`選択肢${choiceIndex}: ${choice || `画像${choiceIndex}`}${isCorrect ? "（正解）" : ""}`}
            />
          );
        })}
      </div>

      {/* ナビゲーション */}
      <nav className="flex justify-between items-center px-4 py-3 border-t border-gray-200 bg-white/80">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => i - 1)}
          disabled={isFirst}
          className={`px-6 py-3 rounded-xl font-bold min-h-[44px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
            isFirst
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300 cursor-pointer"
          }`}
        >
          前へ
        </button>
        <button
          type="button"
          onClick={() => navigate(`/host/setup?view=edit&quizId=${quizId}`)}
          className="px-6 py-3 rounded-xl bg-amber-200 text-amber-900 font-bold min-h-[44px] hover:bg-amber-300 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
        >
          ホスト画面に戻る
        </button>
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => i + 1)}
          disabled={isLast}
          className={`px-6 py-3 rounded-xl font-bold min-h-[44px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
            isLast
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300 cursor-pointer"
          }`}
        >
          次へ
        </button>
      </nav>
    </div>
  );
}
