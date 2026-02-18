import { useState, useEffect, useRef } from "react";
import type { Question } from "../../types";
import { uploadMedia, addQuestion, updateQuestion, deleteQuestion, addBankQuestion } from "../../services/api";
import { cn } from "../../utils/cn";
import { ModalShell } from "./ModalShell";
import { CHOICE_BG_CLASSES, CHOICE_BORDER_CLASSES, CHOICE_TEXT_CLASSES, CHOICE_BG_LIGHT_CLASSES, CHOICE_LABELS } from "./constants";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  quizId: number;
  hostSecret: string;
  onSaved: () => void;
};

export function QuestionFormModal({ isOpen, onClose, question, quizId, hostSecret, onSaved }: Props) {
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
  const [savedToBank, setSavedToBank] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);

  const isEditing = question !== null;

  // Prefill form when opening with a question
  useEffect(() => {
    if (!isOpen) return;
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
    setSavedToBank(false);
  }, [isOpen, question]);

  // Cleanup ObjectURL on unmount
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
      onClose();
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
      onClose();
    } catch {
      setError("問題の削除に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveToBank() {
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
      setSavedToBank(true);
      setTimeout(() => setSavedToBank(false), 2000);
    } catch {
      setError("バンクへの保存に失敗しました");
    }
  }

  const canSave = text.trim() && choices.every((c) => c.trim()) && !isSaving && !isUploading;

  const footer = (
    <div className="flex justify-between items-center">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors duration-150 min-h-[44px]"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className={cn(
          "px-7 py-2.5 rounded-lg text-sm font-bold text-white transition-colors duration-150 min-h-[44px]",
          canSave
            ? "bg-[#1e88e5] hover:opacity-90 cursor-pointer"
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
  );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "問題を編集" : "新しい問題を追加"}
      footer={footer}
    >
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="w-full mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200 hover:bg-red-100 transition-colors duration-150"
        >
          {error}（タップで閉じる）
        </button>
      )}

      {/* 問題文 */}
      <div className="mb-4">
        <label htmlFor="modal-question-text" className="block text-sm text-gray-600 mb-1 font-semibold">
          問題文
        </label>
        <input
          id="modal-question-text"
          type="text"
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
          id="modal-question-image-input"
          onChange={handleFileSelect}
        />
        {!previewUrl ? (
          <label
            htmlFor="modal-question-image-input"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer hover:border-accent hover:text-accent transition-colors duration-150"
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
                className="w-30 h-20 object-cover rounded-lg border border-gray-200"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                  <span className="text-white text-xs font-semibold">アップロード中…</span>
                </div>
              )}
              {!isUploading && mediaUrl && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={clearImage}
                className="px-3 py-1 rounded text-sm text-red-600 border border-red-300 hover:bg-red-50 transition-colors duration-150 min-h-[32px]"
              >
                削除
              </button>
              {!isUploading && !uploadError && (
                <label
                  htmlFor="modal-question-image-input"
                  className="px-3 py-1 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 cursor-pointer text-center"
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
      <div className="mb-4">
        <span className="block text-sm text-gray-600 mb-2 font-semibold">
          選択肢（正解をクリックして選択）
        </span>
        <div className="grid grid-cols-2 gap-2">
          {choices.map((c, i) => {
            const isSelected = correctChoice === i + 1;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-[border-color,background-color] duration-150",
                  isSelected
                    ? `${CHOICE_BORDER_CLASSES[i]} ${CHOICE_BG_LIGHT_CLASSES[i]}`
                    : "border-gray-300 bg-white",
                )}
              >
                <button
                  type="button"
                  onClick={() => setCorrectChoice(i + 1)}
                  aria-label={`選択肢${CHOICE_LABELS[i]}を正解に設定`}
                  aria-pressed={isSelected}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 min-h-[28px]",
                    isSelected ? CHOICE_BG_CLASSES[i] : "bg-gray-300",
                  )}
                >
                  {CHOICE_LABELS[i]}
                </button>
                <input
                  type="text"
                  value={c}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                  placeholder={`選択肢${CHOICE_LABELS[i]}…`}
                  aria-label={`選択肢${CHOICE_LABELS[i]}のテキスト`}
                  className="flex-1 bg-transparent border-none text-sm py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
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
      </div>

      {/* 制限時間 */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <span className="text-sm text-gray-600 font-semibold">制限時間:</span>
        <div className="flex flex-wrap gap-1.5">
          {[10, 15, 20, 30, 45, 60].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeLimit(t)}
              className={cn(
                "px-3.5 py-2 rounded-full text-sm border transition-colors duration-150 min-h-[44px]",
                timeLimit === t
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
              )}
            >
              {t}秒
            </button>
          ))}
        </div>
      </div>

      {/* 編集時のみ: バンク保存 + 削除 */}
      {isEditing && (
        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
          <button
            type="button"
            onClick={handleSaveToBank}
            className={cn(
              "px-4 py-2 rounded-lg text-sm border transition-colors duration-150 min-h-[44px]",
              savedToBank
                ? "text-green-600 border-green-600 bg-green-50"
                : "text-purple-600 border-purple-600 hover:bg-purple-50",
            )}
          >
            {savedToBank ? "保存済み" : "バンクに保存"}
          </button>

          {pendingDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px]"
              >
                本当に削除する
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px]"
              >
                戻る
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPendingDelete(true)}
              className="px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 min-h-[44px]"
            >
              この問題を削除
            </button>
          )}
        </div>
      )}
    </ModalShell>
  );
}
