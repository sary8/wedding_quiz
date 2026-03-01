const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const ADMIN_TOKEN_KEY = "admin_session_token";

export async function exportQuizData(quizId: number, format: "csv" | "json"): Promise<void> {
  const url = `${API_BASE}/quizzes/${quizId}/export?format=${format}`;
  const headers: Record<string, string> = {};
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error("エクスポートに失敗しました");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename = disposition?.match(/filename\*=UTF-8''(.+)/)?.[1]
    ?? `quiz_${quizId}.${format}`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = decodeURIComponent(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
