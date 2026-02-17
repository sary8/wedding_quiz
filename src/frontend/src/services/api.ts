import type { Quiz, QuizSummary, Question } from "../types";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Quiz
export function createQuiz(title: string) {
  return request<Quiz>(
    "/quizzes",
    { method: "POST", body: JSON.stringify({ title }) }
  );
}

export function getQuiz(id: number, key: string) {
  return request<Quiz>(`/quizzes/${id}?key=${key}`);
}

export function listQuizzes() {
  return request<QuizSummary[]>("/quizzes");
}

export function deleteQuiz(id: number, key: string) {
  return request<void>(`/quizzes/${id}?key=${key}`, { method: "DELETE" });
}

// Question
export function addQuestion(data: {
  quizId: number;
  key: string;
  text: string;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  correctChoice: number;
  mediaType?: string;
  mediaUrl?: string;
  timeLimitSeconds?: number;
}) {
  return request<Question>("/questions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateQuestion(id: number, data: Record<string, unknown>) {
  return request<Question>(`/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteQuestion(id: number, key: string) {
  return request<void>(`/questions/${id}?key=${key}`, { method: "DELETE" });
}

// Media
export function uploadSelfie(base64Data: string) {
  return request<{ url: string; filename: string }>("/media/selfie", {
    method: "POST",
    body: JSON.stringify({ data: base64Data }),
  });
}

export async function uploadMedia(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/media/upload`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ url: string }>;
}
