import { useState, useEffect, useRef } from "react";
import type { Question } from "../../types";
import { uploadMedia, addQuestion, updateQuestion, deleteQuestion, addBankQuestion } from "../../services/api";
import { cn } from "../../utils/cn";
import { CHOICE_BG_CLASSES, CHOICE_BORDER_CLASSES, CHOICE_TEXT_CLASSES, CHOICE_BG_LIGHT_CLASSES, CHOICE_LABELS } from "./constants";

type Props = {
  question: Question | null;
  quizId: number;
  hostSecret: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function QuestionInlineForm({ question, quizId, hostSecret, onSaved, onCancel }: Props) {
  const [text, setText] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctChoice, setCorrectChoice] = useState(1);
  const [timeLimit, setTimeLimit] = useState(20);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [savedToTemplate, setSavedToTemplate] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);

  const isEditing = question !== null;
  const formId = question ? `edit-${question.id}` : "new";

  useEffect(() => {
    if (question) {
      setText(question.text);
      setChoices([question.choice1, question.choice2, question.choice3, question.choice4]);
      setCorrectChoice(question.correct_choice);
      setTimeLimit(question.time_limit_seconds);
      if (question.media_url) {
        setPreviewUrl(question.media_url);
        setMediaUrl(question.media_url);
      } else {
        clearImage();
      }
    } else {
      resetForm();
    }
    setError(null);
    setPendingDelete(false);
    setSavedToTemplate(false);
  }, [question]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  function resetForm() {
    setText("");
    setChoices(["", "", "", ""]);
    setCorrectChoice(1);
    setTimeLimit(20);
    clearImage();
  }

  function clearImage() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setMediaUrl(null);
    setUploadError(null);
    setIsUploading(false);
    setFileInputKey((k) => k + 1);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setMediaUrl(null);
    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await uploadMedia(file);
      setMediaUrl(result.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました");
      setMediaUrl(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave() {
    if (!text.trim() || choices.some((c) => !c.trim())) return;
    if (isUploading || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await updateQuestion(question.id, {
          key: hostSecret,
          text: text.trim(),
          choice1: choices[0].trim(),
          choice2: choices[1].trim(),
          choice3: choices[2].trim(),
          choice4: choices[3].trim(),
          correctChoice,
          timeLimitSeconds: timeLimit,
          mediaType: mediaUrl ? "image" : "none",
          mediaUrl: mediaUrl,
        });
      } else {
        await addQuestion({
          quizId,
          key: hostSecret,
          text: text.trim(),
          choice1: choices[0].trim(),
          choice2: choices[1].trim(),
          choice3: choices[2].trim(),
          choice4: choices[3].trim(),
          correctChoice,
          timeLimitSeconds: timeLimit,
          mediaType: mediaUrl ? "image" : undefined,
          mediaUrl: mediaUrl ?? undefined,
        });
      }
      onSaved();
    } catch {
      setError(isEditing ? "問題の更新に失敗しました" : "問題の追加に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!question) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteQuestion(question.id, hostSecret);
      onSaved();
    } catch {
      setError("問題の削除に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveToTemplate() {
    if (!question) return;
    try {
      await addBankQuestion({
        text: question.text,
        choice1: question.choice1,
        choice2: question.choice2,
        choice3: question.choice3,
        choice4: question.choice4,
        correctChoice: question.correct_choice,
        timeLimitSeconds: question.time_limit_seconds,
        points: question.points,
        mediaType: question.media_type,
        mediaUrl: question.media_url ?? undefined,
      });
      setSavedToTemplate(true);
      setTimeout(() => setSavedToTemplate(false), 2000);
    } catch {
      setError("テンプレートへの保存に失敗しました");
    }
  }

  const canSave = text.trim() && choices.every((c) => c.trim()) && !isSaving && !isUploading;
  const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

  return (
    <div className="p-4 border-t border-gray-100">
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className={cn("w-full mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200 hover:bg-red-100 transition-colors duration-150 cursor-pointer", btnFocus)}
        >
          {error}（タップで閉じる）
        </button>
      )}

      {/* 問題文 */}
      <div className="mb-4">
        <label htmlFor={`question-text-${formId}`} className="block text-sm text-gray-600 mb-1 font-semibold">
          問題文
        </label>
        <input
          id={`question-text-${formId}`}
          type="text"
          name={`question-text-${formId}`}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例：新郎の出身地はどこ？…"
          className="w-full px-3.5 py-2.5 rounded-lg border-2 border-gray-200 text-base focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-[border-color,box-shadow] duration-200"
        />
      </div>

      {/* 画像アップロード */}
      <div className="mb-4">
        <span className="block text-sm text-gray-600 mb-2 font-semibold">問題画像（任意）</span>
        <input
          key={fileInputKey}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp"
          className="sr-only"
          id={`question-image-${formId}`}
          onChange={handleFileSelect}
        />
        {!previewUrl ? (
          <label
            htmlFor={`question-image-${formId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer hover:border-accent hover:text-accent transition-colors duration-150 min-h-[44px]"
          >
            画像を選択
          </label>
        ) : (
          <div className="flex items-start gap-3">
            <div className="relative inline-block">
              <img
                src={previewUrl}
                alt="プレビュー"
                width={120}
                height={80}
                loading="lazy"
                className="w-30 h-20 object-cover rounded-lg border border-gray-200"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                  <span className="text-white text-xs font-semibold">アップロード中…</span>
                </div>
              )}
              {!isUploading && mediaUrl && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center">
                  <span className="text-white text-xs font-bold" aria-hidden="true">✓</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={clearImage}
                className={cn("px-3 py-2 rounded text-sm text-red-600 border border-red-300 hover:bg-red-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
              >
                削除
              </button>
              {!isUploading && !uploadError && (
                <label
                  htmlFor={`question-image-${formId}`}
                  className="px-3 py-2 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 cursor-pointer text-center min-h-[44px] flex items-center justify-center"
                >
                  変更
                </label>
              )}
            </div>
          </div>
        )}
        {uploadError && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {uploadError}
          </p>
        )}
      </div>

      {/* 選択肢 */}
      <fieldset className="mb-4">
        <legend className="block text-sm text-gray-600 mb-2 font-semibold">
          選択肢（正解をクリックして選択）
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {choices.map((c, i) => {
            const isSelected = correctChoice === i + 1;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-[border-color,background-color] duration-150",
                  isSelected
                    ? `${CHOICE_BORDER_CLASSES[i]} ${CHOICE_BG_LIGHT_CLASSES[i]}`
                    : "border-gray-300 bg-white hover:border-gray-400",
                )}
              >
                <button
                  type="button"
                  onClick={() => setCorrectChoice(i + 1)}
                  aria-label={`選択肢${CHOICE_LABELS[i]}を正解に設定`}
                  aria-pressed={isSelected}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 cursor-pointer",
                    btnFocus,
                    isSelected ? CHOICE_BG_CLASSES[i] : "bg-gray-300 hover:bg-gray-400",
                  )}
                >
                  {CHOICE_LABELS[i]}
                </button>
                <input
                  type="text"
                  name={`choice-${CHOICE_LABELS[i]}-${formId}`}
                  autoComplete="off"
                  value={c}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                  placeholder={`選択肢${CHOICE_LABELS[i]}…`}
                  aria-label={`選択肢${CHOICE_LABELS[i]}のテキスト`}
                  className="flex-1 bg-transparent border-none text-sm py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded min-w-0"
                />
                {isSelected && (
                  <span aria-hidden="true" className={`text-xs font-bold shrink-0 ${CHOICE_TEXT_CLASSES[i]}`}>
                    正解
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* 制限時間 */}
      <fieldset className="flex flex-wrap gap-3 items-center mb-4">
        <legend className="text-sm text-gray-600 font-semibold">制限時間:</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="制限時間">
          {[10, 15, 20, 30, 45, 60].map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={timeLimit === t}
              onClick={() => setTimeLimit(t)}
              className={cn(
                "px-3.5 py-2 rounded-full text-sm border transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
                timeLimit === t
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
              )}
            >
              {t}秒
            </button>
          ))}
        </div>
      </fieldset>

      {/* 編集時のみ: テンプレート保存 + 削除 */}
      {isEditing && (
        <div className="pt-4 border-t border-gray-100 flex flex-wrap justify-between items-center gap-2 mb-4">
          <button
            type="button"
            onClick={handleSaveToTemplate}
            className={cn(
              "px-4 py-2 rounded-lg text-sm border transition-colors duration-150 min-h-[44px] cursor-pointer",
              btnFocus,
              savedToTemplate
                ? "text-green-600 border-green-600 bg-green-50"
                : "text-purple-600 border-purple-600 hover:bg-purple-50",
            )}
          >
            {savedToTemplate ? "保存済み" : "テンプレートに保存"}
          </button>

          {pendingDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className={cn("px-4 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
              >
                本当に削除する
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(false)}
                className={cn("px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
              >
                戻る
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPendingDelete(true)}
              className={cn("px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
            >
              この問題を削除
            </button>
          )}
        </div>
      )}

      {/* フッター: キャンセル+保存 */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className={cn("px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            "px-7 py-2.5 rounded-lg text-sm font-bold text-white transition-colors duration-150 min-h-[44px]",
            btnFocus,
            canSave
              ? "bg-choice-blue hover:opacity-90 cursor-pointer"
              : "bg-gray-300 cursor-not-allowed",
          )}
        >
          {isSaving
            ? (isEditing ? "保存中…" : "追加中…")
            : isUploading
              ? "アップロード中…"
              : (isEditing ? "変更を保存" : "この問題を追加")}
        </button>
      </div>
    </div>
  );
}
