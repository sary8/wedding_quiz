import type { Quiz, QuizSummary, Question, QuestionBankItem, ParticipantSummary, ParticipantWithQuiz, TeamInfo, QuizStatsData } from "../types";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const ADMIN_TOKEN_KEY = "admin_session_token";

// Adminトークン管理
function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAdminToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    clearAdminToken();
    throw new Error("セッションが期限切れです。再ログインしてください。");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export async function createAdminSession(pin?: string): Promise<string> {
  const body: Record<string, string> = {};
  if (pin) body.pin = pin;

  const res = await fetch(`${API_BASE}/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  const data = await res.json() as { token: string };
  setAdminToken(data.token);
  return data.token;
}

export async function checkAuthStatus(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;

  const res = await fetch(`${API_BASE}/auth/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return false;
  const data = await res.json() as { authenticated: boolean };
  if (!data.authenticated) {
    clearAdminToken();
  }
  return data.authenticated;
}

export async function checkPinRequired(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/pin-required`);
    if (!res.ok) return false;
    const data = await res.json() as { required: boolean };
    return data.required;
  } catch {
    return false;
  }
}

export function isAdminAuthenticated(): boolean {
  return !!getAdminToken();
}

export { clearAdminToken };

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
  questionType?: string;
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
  pointMultiplier?: number;
}) {
  return request<Question>("/questions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateQuestion(id: number, data: {
  text?: string;
  questionType?: string;
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
  pointMultiplier?: number;
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
  questionType?: string;
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
  pointMultiplier?: number;
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
  questionType?: string;
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
  pointMultiplier?: number;
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

export function getQuizStats(quizId: number) {
  return request<QuizStatsData>(`/quizzes/${quizId}/stats`);
}

export function getRoomInfo(roomCode: string) {
  return request<{ teamMode: boolean; teams: TeamInfo[] }>(`/quizzes/room/${roomCode}/info`);
}

// 参加者自身のデータ削除（プライバシーポリシー記載の自己データ削除機能）
export async function deleteMyParticipantData(participantToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/quizzes/participants/me`, {
    method: "DELETE",
    headers: { "X-Participant-Token": participantToken },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

// Media
export function uploadSelfie(base64Data: string, roomCode: string) {
  return request<{ url: string; filename: string }>("/media/selfie", {
    method: "POST",
    body: JSON.stringify({ data: base64Data, roomCode }),
  });
}

export async function uploadMedia(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const token = getAdminToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    clearAdminToken();
    throw new Error("セッションが期限切れです。再ログインしてください。");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ url: string }>;
}
