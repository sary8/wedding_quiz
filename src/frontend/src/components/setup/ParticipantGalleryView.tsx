import { useState, useEffect } from "react";
import type { ParticipantWithQuiz } from "../../types";
import { listAllParticipants } from "../../services/api";

export function ParticipantGalleryView() {
  const [participants, setParticipants] = useState<ParticipantWithQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadParticipants();
  }, []);

  async function loadParticipants() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listAllParticipants();
      setParticipants(data);
    } catch {
      setError("参加者の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <p className="text-gray-500 text-sm">読み込み中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
        {error}
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <p className="text-gray-500">まだ参加者がいません</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {participants.map((p) => (
        <div
          key={`${p.quiz_id}-${p.id}`}
          className="bg-white rounded-xl p-4 shadow-sm flex flex-col items-center text-center"
        >
          {p.selfie_file_name ? (
            <img
              src={`/api/media/${p.selfie_file_name}`}
              alt={p.nickname}
              className="w-20 h-20 rounded-full object-cover mb-3"
            />
          ) : (
            <span className="w-20 h-20 rounded-full bg-accent/20 text-accent flex items-center justify-center text-2xl font-bold mb-3">
              {p.nickname.charAt(0)}
            </span>
          )}
          <div className="font-semibold text-sm text-gray-800 truncate w-full">{p.nickname}</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate w-full">{p.quiz_title}</div>
          {p.total_score > 0 && (
            <div className="text-xs text-accent font-medium mt-1">{p.total_score}点</div>
          )}
        </div>
      ))}
    </div>
  );
}
