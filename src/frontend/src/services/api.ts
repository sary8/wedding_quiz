import type { Quiz, QuizSummary, Question, QuestionBankItem, ParticipantSummary, ParticipantWithQuiz, TeamInfo } from "../types";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

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

export function getQuiz(id: number) {
  return request<Quiz>(`/quizzes/${id}`);
}

export function listQuizzes() {
  return request<QuizSummary[]>("/quizzes");
}

export function updateQuiz(id: number, title: string) {
  return request<Quiz>(`/quizzes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });
}

export function deleteQuiz(id: number) {
  return request<void>(`/quizzes/${id}`, { method: "DELETE" });
}

export function listQuizParticipants(quizId: number) {
  return request<ParticipantSummary[]>(`/quizzes/${quizId}/participants`);
}

export function listAllParticipants() {
  return request<ParticipantWithQuiz[]>("/participants");
}

export function deleteAllParticipants() {
  return request<{ success: boolean }>("/participants", {
    method: "DELETE",
  });
}

export function deleteParticipant(quizId: number, participantId: number) {
  return request<{ success: boolean }>(`/quizzes/${quizId}/participants/${participantId}`, {
    method: "DELETE",
  });
}

export function deleteParticipantsBulk(quizId: number, ids?: number[]) {
  return request<{ success: boolean }>(`/quizzes/${quizId}/participants`, {
    method: "DELETE",
    body: JSON.stringify(ids ? { ids } : {}),
  });
}

// Question
export function addQuestion(data: {
  quizId: number;
  text: string;
  choiceType?: string;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  choice1ImageUrl?: string;
  choice2ImageUrl?: string;
  choice3ImageUrl?: string;
  choice4ImageUrl?: string;
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

export function updateQuestion(id: number, data: {
  text?: string;
  choiceType?: string;
  choice1?: string;
  choice2?: string;
  choice3?: string;
  choice4?: string;
  choice1ImageUrl?: string | null;
  choice2ImageUrl?: string | null;
  choice3ImageUrl?: string | null;
  choice4ImageUrl?: string | null;
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

export function reorderQuestions(quizId: number, questionIds: number[]) {
  return request<{ success: boolean }>("/questions/reorder", {
    method: "PUT",
    body: JSON.stringify({ quizId, questionIds }),
  });
}

export function deleteQuestion(id: number) {
  return request<void>(`/questions/${id}`, { method: "DELETE" });
}

// Question Bank
export function listBankQuestions() {
  return request<QuestionBankItem[]>("/question-bank");
}

export function addBankQuestion(data: {
  text: string;
  choiceType?: string;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  choice1ImageUrl?: string;
  choice2ImageUrl?: string;
  choice3ImageUrl?: string;
  choice4ImageUrl?: string;
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
  choiceType?: string;
  choice1?: string;
  choice2?: string;
  choice3?: string;
  choice4?: string;
  choice1ImageUrl?: string | null;
  choice2ImageUrl?: string | null;
  choice3ImageUrl?: string | null;
  choice4ImageUrl?: string | null;
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

export function importBankToQuiz(quizId: number, bankQuestionIds: number[]) {
  return request<{ imported: number[]; count: number }>("/question-bank/import-to-quiz", {
    method: "POST",
    body: JSON.stringify({ quizId, bankQuestionIds }),
  });
}

// Team
export function updateTeamMode(quizId: number, enabled: boolean) {
  return request<{ success: boolean; teamMode: boolean }>(`/quizzes/${quizId}/team-mode`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export function listTeams(quizId: number) {
  return request<TeamInfo[]>(`/quizzes/${quizId}/teams`);
}

export function setTeams(quizId: number, teams: { name: string }[]) {
  return request<TeamInfo[]>(`/quizzes/${quizId}/teams`, {
    method: "PUT",
    body: JSON.stringify({ teams }),
  });
}

export function getRoomInfo(roomCode: string) {
  return request<{ teamMode: boolean; teams: TeamInfo[] }>(`/quizzes/room/${roomCode}/info`);
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
