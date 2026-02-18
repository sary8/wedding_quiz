import type { Quiz, QuizSummary, Question, QuestionBankItem } from "../types";

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

export function updateQuiz(id: number, key: string, title: string) {
  return request<Quiz>(`/quizzes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ key, title }),
  });
}

export function updateQuestion(id: number, data: {
  key: string;
  text?: string;
  choice1?: string;
  choice2?: string;
  choice3?: string;
  choice4?: string;
  correctChoice?: number;
  timeLimitSeconds?: number;
  points?: number;
  mediaType?: string;
  mediaUrl?: string | null;
}) {
  return request<Question>(`/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function reorderQuestions(quizId: number, key: string, questionIds: number[]) {
  return request<{ success: boolean }>("/questions/reorder", {
    method: "PUT",
    body: JSON.stringify({ quizId, key, questionIds }),
  });
}

export function deleteQuestion(id: number, key: string) {
  return request<void>(`/questions/${id}?key=${key}`, { method: "DELETE" });
}

// Question Bank
export function listBankQuestions() {
  return request<QuestionBankItem[]>("/question-bank");
}

export function addBankQuestion(data: {
  text: string;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  correctChoice: number;
  timeLimitSeconds?: number;
  points?: number;
  mediaType?: string;
  mediaUrl?: string;
}) {
  return request<QuestionBankItem>("/question-bank", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateBankQuestion(id: number, data: {
  text?: string;
  choice1?: string;
  choice2?: string;
  choice3?: string;
  choice4?: string;
  correctChoice?: number;
  timeLimitSeconds?: number;
  points?: number;
  mediaType?: string;
  mediaUrl?: string | null;
}) {
  return request<QuestionBankItem>(`/question-bank/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteBankQuestion(id: number) {
  return request<{ success: boolean }>(`/question-bank/${id}`, { method: "DELETE" });
}

export function importBankToQuiz(quizId: number, key: string, bankQuestionIds: number[]) {
  return request<{ imported: number[]; count: number }>("/question-bank/import-to-quiz", {
    method: "POST",
    body: JSON.stringify({ quizId, key, bankQuestionIds }),
  });
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
