const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

export function exportQuizData(quizId: number, format: "csv" | "json") {
  const url = `${API_BASE}/quizzes/${quizId}/export?format=${format}`;
  window.open(url, "_blank");
}
