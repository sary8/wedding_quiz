import { useState, useEffect, useRef } from "react";
import type { Question, QuestionBankItem, ChoiceType, QuestionType } from "../../types";
import { uploadMedia, addQuestion, updateQuestion, deleteQuestion, addBankQuestion, updateBankQuestion, deleteBankQuestion } from "../../services/api";
import { cn } from "../../utils/cn";
import { CHOICE_BG_CLASSES, CHOICE_BORDER_CLASSES, CHOICE_TEXT_CLASSES, CHOICE_BG_LIGHT_CLASSES, CHOICE_LABELS } from "./constants";

type BaseProps = {
  onSaved: () => void;
  onCancel: () => void;
};

type QuizModeProps = BaseProps & {
  mode?: "quiz";
  question: Question | null;
  quizId: number;
};

type BankModeProps = BaseProps & {
  mode: "bank";
  question: QuestionBankItem | null;
  quizId?: never;
};

type Props = QuizModeProps | BankModeProps;

export function QuestionInlineForm(props: Props) {
  const { question, onSaved, onCancel } = props;
  const mode = props.mode ?? "quiz";
  const quizId = mode === "quiz" ? (props as QuizModeProps).quizId : 0;
  const [text, setText] = useState(question?.text ?? "");
  const [questionType, setQuestionType] = useState<QuestionType>(question?.question_type ?? "four_choice");
  const [choiceType, setChoiceType] = useState<ChoiceType>(question?.choice_type ?? "text");
  const isTrueFalse = questionType === "true_false";
  const [choices, setChoices] = useState(() =>
    question
      ? [question.choice1, question.choice2, question.choice3 ?? "", question.choice4 ?? ""]
      : ["", "", "", ""],
  );
  const [choiceImageUrls, setChoiceImageUrls] = useState<(string | null)[]>(() =>
    question
      ? [question.choice1_image_url, question.choice2_image_url, question.choice3_image_url, question.choice4_image_url]
      : [null, null, null, null],
  );
  const [choiceImageUploading, setChoiceImageUploading] = useState([false, false, false, false]);
  const [correctChoice, setCorrectChoice] = useState(question?.correct_choice ?? 1);
  const [timeLimit, setTimeLimit] = useState(question?.time_limit_seconds ?? 20);
  const [pointMultiplier, setPointMultiplier] = useState(question?.point_multiplier ?? 1);
  const [mediaUrl, setMediaUrl] = useState<string | null>(question?.media_url ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(question?.media_url ?? null);
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
  const isAnyChoiceImageUploading = choiceImageUploading.some(Boolean);

  // NOTE: state is initialized from question prop at mount.
  // Parent must use key={question?.id ?? "new"} to remount when question changes.

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

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
      const result = await uploadMedia(file, {
        kind: "question",
        quizId: mode === "quiz" ? quizId : undefined,
      });
      setMediaUrl(result.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました");
      setMediaUrl(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleChoiceImageSelect(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setChoiceImageUploading((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    try {
      const result = await uploadMedia(file, {
        kind: "choice",
        quizId: mode === "quiz" ? quizId : undefined,
      });
      setChoiceImageUrls((prev) => {
        const next = [...prev];
        next[index] = result.url;
        return next;
      });
    } catch (err) {
      const reason = err instanceof Error ? `: ${err.message}` : "";
      setError(`選択肢${CHOICE_LABELS[index]}の画像アップロードに失敗しました${reason}`);
    } finally {
      setChoiceImageUploading((prev) => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
    }
  }

  function clearChoiceImage(index: number) {
    setChoiceImageUrls((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  async function handleSave() {
    if (!canSave) return;
    if (isUploading || isSaving || isAnyChoiceImageUploading) return;
    setIsSaving(true);
    setError(null);
    const payload = {
      text: text.trim(),
      questionType,
      choiceType: isTrueFalse ? "text" as const : choiceType,
      choice1: isTrueFalse ? "○" : choices[0].trim(),
      choice2: isTrueFalse ? "×" : choices[1].trim(),
      choice3: isTrueFalse ? "" : choices[2].trim(),
      choice4: isTrueFalse ? "" : choices[3].trim(),
      choice1ImageUrl: isTrueFalse ? undefined : (choiceImageUrls[0] ?? undefined),
      choice2ImageUrl: isTrueFalse ? undefined : (choiceImageUrls[1] ?? undefined),
      choice3ImageUrl: isTrueFalse ? undefined : (choiceImageUrls[2] ?? undefined),
      choice4ImageUrl: isTrueFalse ? undefined : (choiceImageUrls[3] ?? undefined),
      correctChoice,
      timeLimitSeconds: timeLimit,
      pointMultiplier,
      mediaType: mediaUrl ? "image" : ("none" as const),
      mediaUrl: mediaUrl ?? undefined,
    };
    try {
      if (mode === "bank") {
        if (isEditing) {
          await updateBankQuestion(question.id, payload);
        } else {
          await addBankQuestion(payload);
        }
      } else {
        if (isEditing) {
          await updateQuestion(question.id, { ...payload, mediaUrl: mediaUrl });
        } else {
          await addQuestion({ ...payload, quizId });
        }
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
      if (mode === "bank") {
        await deleteBankQuestion(question.id);
      } else {
        await deleteQuestion(question.id);
      }
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
        questionType: question.question_type,
        choiceType: question.choice_type,
        choice1: question.choice1,
        choice2: question.choice2,
        choice3: question.choice3 ?? "",
        choice4: question.choice4 ?? "",
        choice1ImageUrl: question.choice1_image_url ?? undefined,
        choice2ImageUrl: question.choice2_image_url ?? undefined,
        choice3ImageUrl: question.choice3_image_url ?? undefined,
        choice4ImageUrl: question.choice4_image_url ?? undefined,
        correctChoice: question.correct_choice,
        timeLimitSeconds: question.time_limit_seconds,
        points: question.points,
        pointMultiplier: question.point_multiplier,
        mediaType: question.media_type,
        mediaUrl: question.media_url ?? undefined,
      });
      setSavedToTemplate(true);
      setTimeout(() => setSavedToTemplate(false), 2000);
    } catch {
      setError("テンプレートへの保存に失敗しました");
    }
  }

  const canSave =
    text.trim() &&
    (isTrueFalse
      ? true
      : choiceType === "text"
        ? choices.every((c) => c.trim())
        : choiceImageUrls.every((url) => url !== null)) &&
    !isSaving &&
    !isUploading &&
    !isAnyChoiceImageUploading;

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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
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

      {/* 問題形式選択 */}
      <fieldset className="mb-4">
        <legend className="block text-sm text-gray-600 mb-2 font-semibold">
          問題形式
        </legend>
        <div className="flex gap-2" role="radiogroup" aria-label="問題形式">
          <button
            type="button"
            role="radio"
            aria-checked={questionType === "four_choice"}
            onClick={() => {
              setQuestionType("four_choice");
              if (correctChoice > 4) setCorrectChoice(1);
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm border transition-colors duration-150 min-h-[44px] cursor-pointer",
              btnFocus,
              questionType === "four_choice"
                ? "bg-accent text-white border-accent"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
            )}
          >
            4択問題
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={questionType === "true_false"}
            onClick={() => {
              setQuestionType("true_false");
              if (correctChoice > 2) setCorrectChoice(1);
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm border transition-colors duration-150 min-h-[44px] cursor-pointer",
              btnFocus,
              questionType === "true_false"
                ? "bg-accent text-white border-accent"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
            )}
          >
            ○×問題
          </button>
        </div>
      </fieldset>

      {/* 選択肢タイプ切替（4択問題のみ） */}
      {!isTrueFalse && (
        <fieldset className="mb-4">
          <legend className="block text-sm text-gray-600 mb-2 font-semibold">
            選択肢タイプ
          </legend>
          <div className="flex gap-2" role="radiogroup" aria-label="選択肢タイプ">
            <button
              type="button"
              role="radio"
              aria-checked={choiceType === "text"}
              onClick={() => setChoiceType("text")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm border transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
                choiceType === "text"
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
              )}
            >
              テキスト
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={choiceType === "image"}
              onClick={() => setChoiceType("image")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm border transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
                choiceType === "image"
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
              )}
            >
              画像
            </button>
          </div>
        </fieldset>
      )}

      {/* 選択肢 */}
      <fieldset className="mb-4">
        <legend className="block text-sm text-gray-600 mb-2 font-semibold">
          {isTrueFalse ? "正解を選択" : "選択肢（正解をクリックして選択）"}
        </legend>
        {isTrueFalse ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "○", index: 1, color: "bg-green-100 border-green-400 text-green-700", activeColor: "bg-green-500 text-white border-green-500" },
              { label: "×", index: 2, color: "bg-rose-100 border-rose-400 text-rose-700", activeColor: "bg-rose-500 text-white border-rose-500" },
            ].map(({ label, index, color, activeColor }) => {
              const isSelected = correctChoice === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCorrectChoice(index)}
                  aria-pressed={isSelected}
                  aria-label={`${label}を正解に設定`}
                  className={cn(
                    "flex flex-col items-center justify-center py-6 rounded-xl border-2 text-4xl font-bold transition-all duration-150 min-h-[80px] cursor-pointer",
                    btnFocus,
                    isSelected ? activeColor : `${color} hover:opacity-80`,
                  )}
                >
                  {label}
                  {isSelected && <span className="text-xs font-semibold mt-1">正解</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {choices.map((c, i) => {
              const isSelected = correctChoice === i + 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-2 px-3 py-2 rounded-lg border-2 transition-[border-color,background-color] duration-150",
                    isSelected
                      ? `${CHOICE_BORDER_CLASSES[i]} ${CHOICE_BG_LIGHT_CLASSES[i]}`
                      : "border-gray-300 bg-white hover:border-gray-400",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectChoice(i + 1)}
                      aria-label={`選択肢${CHOICE_LABELS[i]}を正解に設定`}
                      aria-pressed={isSelected}
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 cursor-pointer",
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
                      placeholder={choiceType === "text" ? `選択肢${CHOICE_LABELS[i]}…` : `ラベル（任意）…`}
                      aria-label={`選択肢${CHOICE_LABELS[i]}のテキスト`}
                      className="flex-1 bg-transparent border-none text-sm py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded min-w-0"
                    />
                    {isSelected && (
                      <span aria-hidden="true" className={`text-xs font-bold shrink-0 ${CHOICE_TEXT_CLASSES[i]}`}>
                        正解
                      </span>
                    )}
                  </div>
                  {/* 画像モード: アップロード領域 */}
                  {choiceType === "image" && (
                    <div className="flex items-center gap-2 ml-10">
                      {choiceImageUrls[i] ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={choiceImageUrls[i]}
                            alt={`選択肢${CHOICE_LABELS[i]}の画像`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => clearChoiceImage(i)}
                            className={cn("px-2 py-1 rounded text-xs text-red-600 border border-red-300 hover:bg-red-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
                          >
                            削除
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.webp"
                            className="sr-only"
                            id={`choice-image-${CHOICE_LABELS[i]}-${formId}`}
                            onChange={(e) => handleChoiceImageSelect(i, e)}
                          />
                          <label
                            htmlFor={`choice-image-${CHOICE_LABELS[i]}-${formId}`}
                            className={cn(
                              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed text-xs cursor-pointer transition-colors duration-150 min-h-[44px]",
                              choiceImageUploading[i]
                                ? "border-gray-400 text-gray-400"
                                : "border-gray-300 text-gray-500 hover:border-accent hover:text-accent",
                            )}
                          >
                            {choiceImageUploading[i] ? "アップロード中…" : "画像を選択"}
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

      {/* ポイント倍率 */}
      <fieldset className="flex flex-wrap gap-3 items-center mb-4">
        <legend className="text-sm text-gray-600 font-semibold">ポイント倍率:</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="ポイント倍率">
          {[1, 2, 3].map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={pointMultiplier === m}
              onClick={() => setPointMultiplier(m)}
              className={cn(
                "px-3.5 py-2 rounded-full text-sm border transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
                pointMultiplier === m
                  ? m === 1
                    ? "bg-accent text-white border-accent"
                    : "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
              )}
            >
              {m === 1 ? "通常" : `${m}倍`}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 編集時のみ: テンプレート保存 + 削除 */}
      {isEditing && mode === "quiz" && (
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

      {/* bank編集時: 削除のみ */}
      {isEditing && mode === "bank" && (
        <div className="pt-4 border-t border-gray-100 flex justify-end items-center gap-2 mb-4">
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
              このテンプレートを削除
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
            "px-7 py-2.5 rounded-lg text-sm font-bold text-white transition-colors duration-150 min-h-[44px] inline-flex items-center gap-2",
            btnFocus,
            canSave
              ? "bg-choice-blue hover:opacity-90 cursor-pointer"
              : "bg-gray-300 cursor-not-allowed",
          )}
        >
          {isSaving && (
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isSaving
            ? (isEditing ? "保存中…" : "追加中…")
            : (isUploading || isAnyChoiceImageUploading)
              ? "アップロード中…"
              : (isEditing ? "変更を保存" : "この問題を追加")}
        </button>
      </div>
    </div>
  );
}
