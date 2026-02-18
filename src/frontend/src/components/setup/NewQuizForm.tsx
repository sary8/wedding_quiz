import { useState } from "react";

type Props = {
  isLoading: boolean;
  onCreateQuiz: (title: string) => Promise<void>;
};

export function NewQuizForm({ isLoading, onCreateQuiz }: Props) {
  const [title, setTitle] = useState("");

  async function handleCreate() {
    if (!title.trim()) return;
    await onCreateQuiz(title.trim());
    setTitle("");
  }

  return (
    <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">新しいクイズを作成</h2>
      <div className="flex gap-3">
        <input
          type="text"
          name="quiz-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：太郎＆花子 結婚式クイズ…"
          aria-label="クイズのタイトル"
          autoComplete="off"
          className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 text-base focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-[border-color,box-shadow] duration-200"
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleCreate()}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={isLoading || !title.trim()}
          className={[
            "px-7 py-3 rounded-lg text-base font-bold text-white whitespace-nowrap transition-colors duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            title.trim() && !isLoading
              ? "bg-accent hover:opacity-90 cursor-pointer"
              : "bg-gray-300 cursor-not-allowed",
          ].join(" ")}
        >
          {isLoading ? "作成中…" : "作成"}
        </button>
      </div>
    </section>
  );
}
