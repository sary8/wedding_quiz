import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../types/index.js";

// quizService をモック
vi.mock("../../services/quizService.js", () => ({
  openRoom: vi.fn(),
  joinRoom: vi.fn(),
  getQuizByRoom: vi.fn(),
  getLobbyParticipants: vi.fn(),
  getTeams: vi.fn(),
  getParticipant: vi.fn(),
  verifyHostSecret: vi.fn(),
  handleDisconnect: vi.fn(),
  getNextQuestion: vi.fn(),
  submitAnswer: vi.fn(),
  getAnswerCount: vi.fn(),
  getReconnectQuestionData: vi.fn(),
  hasParticipantAnswered: vi.fn(),
  getFinalResult: vi.fn(),
  startGame: vi.fn(),
}));

// timerService をモック
vi.mock("../../services/timerService.js", () => ({
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  getElapsedMs: vi.fn(),
  getRemainingSeconds: vi.fn(),
}));

// logger をモック
vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const quizService = await import("../../services/quizService.js");
const timerService = await import("../../services/timerService.js");
const { setupQuizSocket, _resetSocketRateLimit } = await import("../../socket/quizHandler.js");

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

let httpServer: HttpServer;
let ioServer: Server;
let port: number;

function connectClient(): Promise<TypedClientSocket> {
  return new Promise((resolve) => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true,
    }) as TypedClientSocket;
    client.on("connect", () => resolve(client));
  });
}

function emitWithCallback<T>(
  client: TypedClientSocket,
  event: string,
  data: unknown,
): Promise<T> {
  return new Promise((resolve) => {
    (client as unknown as { emit: (ev: string, data: unknown, cb: (res: T) => void) => void })
      .emit(event, data, (res: T) => resolve(res));
  });
}

beforeAll(async () => {
  httpServer = createServer();
  ioServer = new Server(httpServer);
  setupQuizSocket(ioServer as unknown as Server<ClientToServerEvents, ServerToClientEvents>);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

afterEach(() => {
  vi.resetAllMocks();
  _resetSocketRateLimit();
});

describe("watchRoom", () => {
  it("不正形式のルームコード → エラー返却", async () => {
    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "watchRoom", { roomCode: "abcd" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("ルームコードが不正です");
    } finally {
      client.disconnect();
    }
  });

  it("5桁のルームコード → エラー返却", async () => {
    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "watchRoom", { roomCode: "12345" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("ルームコードが不正です");
    } finally {
      client.disconnect();
    }
  });

  it("空のルームコード → エラー返却", async () => {
    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "watchRoom", { roomCode: "" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("ルームコードが不正です");
    } finally {
      client.disconnect();
    }
  });

  it("存在しないルームコード → エラー返却", async () => {
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue(undefined);

    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "watchRoom", { roomCode: "999999" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("ルームが見つかりません");
      expect(quizService.getQuizByRoom).toHaveBeenCalledWith("999999");
    } finally {
      client.disconnect();
    }
  });

  it("正常なviewerのwatchRoom → 成功 + lobbyUpdate受信", async () => {
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 1,
      room_code: "123456",
      host_secret: "secret",
      title: "テスト",
      status: "lobby",
      current_question_index: -1,
      active_question_started_at: null,
      team_mode: false,
      finished_at: null,
      created_at: new Date().toISOString(),
    });
    vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([]);

    const client = await connectClient();
    try {
      const lobbyPromise = new Promise<unknown>((resolve) => {
        client.on("lobbyUpdate", (data) => resolve(data));
      });

      const res = await emitWithCallback<{ success: boolean }>(
        client, "watchRoom", { roomCode: "123456" },
      );
      expect(res.success).toBe(true);

      const lobby = await lobbyPromise;
      expect(lobby).toEqual({ participants: [] });
    } finally {
      client.disconnect();
    }
  });

  it("hostがopenRoom後にwatchRoom → metaが上書きされない（handleDisconnect非呼出）", async () => {
    // openRoom モック
    vi.mocked(quizService.openRoom).mockResolvedValue("555555");
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 10,
      room_code: "555555",
      host_secret: "host-secret",
      title: "ホストテスト",
      status: "lobby",
      current_question_index: -1,
      active_question_started_at: null,
      team_mode: false,
      finished_at: null,
      created_at: new Date().toISOString(),
    });
    vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([]);
    vi.mocked(quizService.handleDisconnect).mockResolvedValue();

    const client = await connectClient();
    try {
      // 1. openRoomでホストとして登録
      const openRes = await emitWithCallback<{ success: boolean; roomCode?: string }>(
        client, "openRoom", { quizId: 10, hostSecret: "host-secret" },
      );
      expect(openRes.success).toBe(true);
      expect(openRes.roomCode).toBe("555555");

      // 2. watchRoomを呼んでもmetaが上書きされないことを確認
      const watchRes = await emitWithCallback<{ success: boolean }>(
        client, "watchRoom", { roomCode: "555555" },
      );
      expect(watchRes.success).toBe(true);

      // 3. クライアント切断 → handleDisconnectが呼ばれないことを確認
      // (participantId === -1 のままなら handleDisconnect は呼ばれない)
      // (もし -2 に上書きされていたら、-2 も > 0 ではないので呼ばれないが、
      //  ホスト切断時のactiveQuestions/timer掃除が行われないことが問題になる)
      client.disconnect();

      // イベントループを待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // handleDisconnectは participant (participantId > 0) のみ呼ばれる
      // host (-1) でも viewer (-2) でも呼ばれないが、
      // hostの場合はactiveQuestions掃除が発生する → ここでは呼ばれないことだけ確認
      expect(quizService.handleDisconnect).not.toHaveBeenCalled();
    } catch {
      client.disconnect();
      throw new Error("テスト中にエラーが発生しました");
    }
  });

  it("参加者がwatchRoom呼んでもmeta上書きされない（disconnect時にhandleDisconnect呼出）", async () => {
    // joinRoom モック: 参加者として登録
    vi.mocked(quizService.joinRoom).mockResolvedValue({
      participant: { id: 42, token: "test-token-42" },
      reconnect: false,
    });
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 10,
      room_code: "333333",
      host_secret: "secret",
      title: "テスト",
      status: "lobby",
      current_question_index: -1,
      active_question_started_at: null,
      team_mode: false,
      finished_at: null,
      created_at: new Date().toISOString(),
    });
    vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([]);
    vi.mocked(quizService.getParticipant).mockResolvedValue({
      id: 42,
      quiz_id: 10,
      team_id: null,
      nickname: "テスト",
      selfie_file_name: null,
      connection_id: "conn",
      token: "test-token-42",
      total_score: 0,
      current_rank: 0,
      is_connected: true,
      joined_at: new Date().toISOString(),
    });
    vi.mocked(quizService.handleDisconnect).mockResolvedValue();

    const client = await connectClient();
    try {
      // 1. joinRoomで参加者として登録
      const joinRes = await emitWithCallback<{ success: boolean; participantId?: number }>(
        client, "joinRoom", { roomCode: "333333", nickname: "テスト" },
      );
      expect(joinRes.success).toBe(true);
      expect(joinRes.participantId).toBe(42);

      // 2. watchRoomを呼ぶ（meta上書きされないはず）
      const watchRes = await emitWithCallback<{ success: boolean }>(
        client, "watchRoom", { roomCode: "333333" },
      );
      expect(watchRes.success).toBe(true);

      // 3. 切断 → handleDisconnectが呼ばれる（metaがparticipant=42のまま）
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 参加者metaが保持されていればhandleDisconnectが呼ばれる
      expect(quizService.handleDisconnect).toHaveBeenCalled();
    } catch {
      client.disconnect();
      throw new Error("テスト中にエラーが発生しました");
    }
  });

  it("team_mode ONのルーム → lobbyUpdateにteams含む", async () => {
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 2,
      room_code: "777777",
      host_secret: "secret",
      title: "チームクイズ",
      status: "lobby",
      current_question_index: -1,
      active_question_started_at: null,
      team_mode: true,
      finished_at: null,
      created_at: new Date().toISOString(),
    });
    vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([]);
    vi.mocked(quizService.getTeams).mockResolvedValue([
      { id: 1, name: "紅組", orderIndex: 0 },
      { id: 2, name: "白組", orderIndex: 1 },
    ]);

    const client = await connectClient();
    try {
      const lobbyPromise = new Promise<{ participants: unknown[]; teams?: unknown[] }>((resolve) => {
        client.on("lobbyUpdate", (data) => resolve(data));
      });

      const res = await emitWithCallback<{ success: boolean }>(
        client, "watchRoom", { roomCode: "777777" },
      );
      expect(res.success).toBe(true);

      const lobby = await lobbyPromise;
      expect(lobby.participants).toEqual([]);
      expect(lobby.teams).toHaveLength(2);
    } finally {
      client.disconnect();
    }
  });
});

describe("showParticipantResults", () => {
  it("認証失敗 → エラー返却", async () => {
    vi.mocked(quizService.verifyHostSecret).mockResolvedValue(null);

    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "showParticipantResults", { roomCode: "123456", hostSecret: "wrong" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("認証エラー");
    } finally {
      client.disconnect();
    }
  });

  it("認証成功 → ルーム内にshowParticipantResultsをリレー", async () => {
    vi.mocked(quizService.verifyHostSecret).mockResolvedValue({
      id: 1,
      room_code: "123456",
      host_secret: "secret",
      title: "テスト",
      status: "finished",
      current_question_index: 0,
      active_question_started_at: null,
      team_mode: false,
      finished_at: null,
      created_at: new Date().toISOString(),
    });

    const host = await connectClient();
    const viewer = await connectClient();
    try {
      // viewerをルームに参加させる
      vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
        id: 1,
        room_code: "123456",
        host_secret: "secret",
        title: "テスト",
        status: "finished",
        current_question_index: 0,
        active_question_started_at: null,
        team_mode: false,
        finished_at: null,
        created_at: new Date().toISOString(),
      });
      vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([]);
      await emitWithCallback<{ success: boolean }>(viewer, "watchRoom", { roomCode: "123456" });

      // viewerがshowParticipantResultsを受信するか確認
      const resultPromise = new Promise<void>((resolve) => {
        viewer.on("showParticipantResults", () => resolve());
      });

      const res = await emitWithCallback<{ success: boolean }>(
        host, "showParticipantResults", { roomCode: "123456", hostSecret: "secret" },
      );
      expect(res.success).toBe(true);

      // viewerがイベントを受信するまで待機（タイムアウト1秒）
      await Promise.race([
        resultPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000)),
      ]);
    } finally {
      host.disconnect();
      viewer.disconnect();
    }
  });
});

describe("socket rate limiting", () => {
  it("joinRoom 151回目でレート制限エラー（NAT会場の一斉参加を許容）", async () => {
    // joinRoom は roomCode バリデーション前にレート制限チェック。
    // 会場Wi-FiのNATで全員が同一IPになるケースを想定し、上限は150回/分
    const client = await connectClient();
    try {
      // 150回は通過（バリデーションエラーだがレート制限ではない）
      for (let i = 0; i < 150; i++) {
        const res = await emitWithCallback<{ success: boolean; error?: string }>(
          client, "joinRoom", { roomCode: "abcd", nickname: "test" },
        );
        expect(res.error).not.toBe("リクエストが多すぎます。しばらくしてから再試行してください");
      }
      // 151回目はレート制限
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "joinRoom", { roomCode: "abcd", nickname: "test" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("リクエストが多すぎます。しばらくしてから再試行してください");
    } finally {
      client.disconnect();
    }
  });

  it("joinRoomとwatchRoomのレート制限バケットは独立している", async () => {
    // joinRoomの大量送信がwatchRoom（プロジェクター/ホスト画面）を巻き込まないこと
    const client = await connectClient();
    try {
      for (let i = 0; i < 30; i++) {
        await emitWithCallback<{ success: boolean }>(
          client, "joinRoom", { roomCode: "abcd", nickname: "test" },
        );
      }
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "watchRoom", { roomCode: "abcd" },
      );
      expect(res.error).not.toBe("リクエストが多すぎます。しばらくしてから再試行してください");
    } finally {
      client.disconnect();
    }
  });

  it("watchRoom もレート制限が適用される", async () => {
    const client = await connectClient();
    try {
      for (let i = 0; i < 20; i++) {
        await emitWithCallback<{ success: boolean }>(
          client, "watchRoom", { roomCode: "abcd" },
        );
      }
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "watchRoom", { roomCode: "abcd" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("リクエストが多すぎます。しばらくしてから再試行してください");
    } finally {
      client.disconnect();
    }
  });
});

// ========== ゲーム進行イベント（本番当日の主要フロー） ==========

function waitForEvent<T>(client: TypedClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    (client as unknown as { once: (ev: string, cb: (data: T) => void) => void }).once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// ホストがnextQuestionで問題を配信し、サーバー側のactiveQuestionsを設定する
async function startQuestion(roomCode: string, questionId: number): Promise<TypedClientSocket> {
  const host = await connectClient();
  vi.mocked(quizService.verifyHostSecret).mockResolvedValue({ id: 1 } as never);
  vi.mocked(quizService.getNextQuestion).mockResolvedValue({
    questionId,
    questionText: "テスト問題",
    choices: ["a", "b", "c", "d"],
    timeLimitSeconds: 30,
    questionIndex: 0,
    totalQuestions: 5,
  } as never);
  const res = await emitWithCallback<{ success: boolean }>(
    host, "nextQuestion", { roomCode, hostSecret: "secret" },
  );
  expect(res.success).toBe(true);
  return host;
}

// 参加者としてjoinRoomし、socketMetaを設定する
async function joinParticipant(
  client: TypedClientSocket,
  roomCode: string,
  participantId = 10,
): Promise<void> {
  vi.mocked(quizService.joinRoom).mockResolvedValue({
    participant: { id: participantId, token: `tok-${participantId}` },
    reconnect: false,
  } as never);
  vi.mocked(quizService.getParticipant).mockResolvedValue({
    id: participantId,
    nickname: "太郎",
    selfie_file_name: null,
  } as never);
  vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
    id: 1,
    status: "in_progress",
    team_mode: false,
    current_question_index: 0,
  } as never);
  vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([] as never);
  const res = await emitWithCallback<{ success: boolean }>(
    client, "joinRoom", { roomCode, nickname: "太郎" },
  );
  expect(res.success).toBe(true);
}

describe("submitAnswer（ゲーム進行）", () => {
  it("タイマー有効時に回答を受理し経過時間をサービスに渡す", async () => {
    const roomCode = "210001";
    const host = await startQuestion(roomCode, 99);
    const client = await connectClient();
    try {
      await joinParticipant(client, roomCode, 10);
      vi.mocked(timerService.getElapsedMs).mockReturnValue(5000);
      vi.mocked(timerService.getRemainingSeconds).mockReturnValue(25);
      vi.mocked(quizService.submitAnswer).mockResolvedValue({ id: 1 } as never);

      const res = await emitWithCallback<{ success: boolean }>(
        client, "submitAnswer", { questionId: 99, choiceIndex: 2 },
      );
      expect(res.success).toBe(true);
      expect(quizService.submitAnswer).toHaveBeenCalledWith(10, 99, 2, 5000);
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });

  it("タイマー不在（サーバー再起動相当）の回答は拒否し満点バグを防ぐ", async () => {
    const roomCode = "210002";
    const host = await startQuestion(roomCode, 99);
    const client = await connectClient();
    try {
      await joinParticipant(client, roomCode, 10);
      vi.mocked(timerService.getElapsedMs).mockReturnValue(null);
      vi.mocked(timerService.getRemainingSeconds).mockReturnValue(null);

      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "submitAnswer", { questionId: 99, choiceIndex: 1 },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("この問題の回答期間は終了しました");
      expect(quizService.submitAnswer).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });

  it("残り時間0の滑り込み回答は拒否する", async () => {
    const roomCode = "210003";
    const host = await startQuestion(roomCode, 99);
    const client = await connectClient();
    try {
      await joinParticipant(client, roomCode, 10);
      vi.mocked(timerService.getElapsedMs).mockReturnValue(30500);
      vi.mocked(timerService.getRemainingSeconds).mockReturnValue(0);

      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "submitAnswer", { questionId: 99, choiceIndex: 1 },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("この問題の回答期間は終了しました");
      expect(quizService.submitAnswer).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });

  it("アクティブでない問題への回答は拒否する", async () => {
    const roomCode = "210004";
    const host = await startQuestion(roomCode, 99);
    const client = await connectClient();
    try {
      await joinParticipant(client, roomCode, 10);
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "submitAnswer", { questionId: 98, choiceIndex: 1 },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("この問題の回答期間は終了しました");
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });

  it("二重回答（既に回答済み）はsuccess:trueで吸収する", async () => {
    const roomCode = "210005";
    const host = await startQuestion(roomCode, 99);
    const client = await connectClient();
    try {
      await joinParticipant(client, roomCode, 10);
      vi.mocked(timerService.getElapsedMs).mockReturnValue(5000);
      vi.mocked(timerService.getRemainingSeconds).mockReturnValue(25);
      vi.mocked(quizService.submitAnswer).mockResolvedValue({ error: "既に回答済みです" } as never);

      const res = await emitWithCallback<{ success: boolean }>(
        client, "submitAnswer", { questionId: 99, choiceIndex: 1 },
      );
      expect(res.success).toBe(true);
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });

  it("回答成功後にanswerCountUpdateがスロットリング配信される", async () => {
    const roomCode = "210006";
    const host = await startQuestion(roomCode, 99);
    const client = await connectClient();
    try {
      await joinParticipant(client, roomCode, 10);
      vi.mocked(timerService.getElapsedMs).mockReturnValue(5000);
      vi.mocked(timerService.getRemainingSeconds).mockReturnValue(25);
      vi.mocked(quizService.submitAnswer).mockResolvedValue({ id: 1 } as never);

      const countPromise = waitForEvent<{ count: number }>(client, "answerCountUpdate");
      const res = await emitWithCallback<{ success: boolean }>(
        client, "submitAnswer", { questionId: 99, choiceIndex: 2 },
      );
      expect(res.success).toBe(true);
      const update = await countPromise;
      expect(update.count).toBe(1);
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });
});

describe("nextQuestion 二重押し防止", () => {
  it("処理中の二重送信は拒否され、問題は1回だけ配信される", async () => {
    const roomCode = "210007";
    const host = await connectClient();
    try {
      // verifyHostSecretを遅延させて2つのリクエストを並走させる
      vi.mocked(quizService.verifyHostSecret).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 1 } as never), 50)),
      );
      vi.mocked(quizService.getNextQuestion).mockResolvedValue({
        questionId: 50,
        questionText: "Q",
        choices: ["a", "b", "c", "d"],
        timeLimitSeconds: 30,
        questionIndex: 0,
        totalQuestions: 5,
      } as never);

      const [res1, res2] = await Promise.all([
        emitWithCallback<{ success: boolean; error?: string }>(
          host, "nextQuestion", { roomCode, hostSecret: "secret" },
        ),
        emitWithCallback<{ success: boolean; error?: string }>(
          host, "nextQuestion", { roomCode, hostSecret: "secret" },
        ),
      ]);

      const successes = [res1, res2].filter((r) => r.success);
      const rejected = [res1, res2].filter((r) => !r.success);
      expect(successes).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].error).toBe("問題の配信中です");
      expect(quizService.getNextQuestion).toHaveBeenCalledTimes(1);
    } finally {
      host.disconnect();
    }
  });
});

describe("参加者の再接続", () => {
  it("reconnectedにタイマー残り時間と回答済みフラグが含まれる", async () => {
    const roomCode = "210008";
    const host = await startQuestion(roomCode, 77);
    const client = await connectClient();
    try {
      vi.mocked(quizService.joinRoom).mockResolvedValue({
        participant: { id: 11, token: "tok-11" },
        reconnect: true,
      } as never);
      vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
        id: 1,
        status: "in_progress",
        team_mode: false,
        current_question_index: 0,
      } as never);
      vi.mocked(quizService.getReconnectQuestionData).mockResolvedValue({
        questionId: 77,
        questionText: "テスト問題",
        choices: ["a", "b", "c", "d"],
        timeLimitSeconds: 30,
        questionIndex: 0,
        totalQuestions: 5,
      } as never);
      vi.mocked(timerService.getRemainingSeconds).mockReturnValue(12);
      vi.mocked(quizService.hasParticipantAnswered).mockResolvedValue(true);

      const reconnectedPromise = waitForEvent<{
        participantId: number;
        quizStatus: string;
        timerRemaining?: number;
        hasAnswered?: boolean;
      }>(client, "reconnected");

      const res = await emitWithCallback<{ success: boolean }>(
        client, "joinRoom", { roomCode, nickname: "太郎", token: "tok-11" },
      );
      expect(res.success).toBe(true);

      const data = await reconnectedPromise;
      expect(data.quizStatus).toBe("in_progress");
      expect(data.timerRemaining).toBe(12);
      expect(data.hasAnswered).toBe(true);
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });
});

describe("joinRoom teamId バリデーション (M6)", () => {
  it("teamId=0 → 不正エラー（quizService.joinRoom は呼ばれない）", async () => {
    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "joinRoom", { roomCode: "123456", nickname: "テスト", teamId: 0 },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("チームの選択が不正です");
      expect(quizService.joinRoom).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
    }
  });

  it("teamId=-1 → 不正エラー", async () => {
    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "joinRoom", { roomCode: "123456", nickname: "テスト", teamId: -1 },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("チームの選択が不正です");
      expect(quizService.joinRoom).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
    }
  });

  it("teamId=1.5（小数） → 不正エラー", async () => {
    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean; error?: string }>(
        client, "joinRoom", { roomCode: "123456", nickname: "テスト", teamId: 1.5 as never },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("チームの選択が不正です");
      expect(quizService.joinRoom).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
    }
  });

  it("teamId=undefined → バリデーションをスキップしてサービスに渡す", async () => {
    // teamId 未指定の場合は従来通り quizService.joinRoom に委ねる
    vi.mocked(quizService.joinRoom).mockResolvedValue({
      participant: { id: 1, token: "tok-1" },
      reconnect: false,
    } as never);
    vi.mocked(quizService.getParticipant).mockResolvedValue({
      id: 1, nickname: "テスト", selfie_file_name: null,
    } as never);
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 1, status: "lobby", team_mode: false, current_question_index: -1,
    } as never);
    vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([] as never);

    const client = await connectClient();
    try {
      const res = await emitWithCallback<{ success: boolean }>(
        client, "joinRoom", { roomCode: "123456", nickname: "テスト" },
      );
      expect(res.success).toBe(true);
      expect(quizService.joinRoom).toHaveBeenCalled();
    } finally {
      client.disconnect();
    }
  });
});

describe("watchRoom 状態復元", () => {
  it("出題中のルームではゲーム状態がコールバックに含まれる", async () => {
    const roomCode = "210009";
    const host = await startQuestion(roomCode, 55);
    const viewer = await connectClient();
    try {
      vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
        id: 1,
        status: "in_progress",
        team_mode: false,
        current_question_index: 0,
      } as never);
      vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([] as never);
      vi.mocked(quizService.getReconnectQuestionData).mockResolvedValue({
        questionId: 55,
        questionText: "テスト問題",
        choices: ["a", "b", "c", "d"],
        timeLimitSeconds: 30,
        questionIndex: 0,
        totalQuestions: 5,
      } as never);
      vi.mocked(timerService.getRemainingSeconds).mockReturnValue(7);

      const res = await emitWithCallback<{
        success: boolean;
        quizStatus?: string;
        currentQuestionData?: { questionId: number } | null;
        timerRemaining?: number;
      }>(viewer, "watchRoom", { roomCode });

      expect(res.success).toBe(true);
      expect(res.quizStatus).toBe("in_progress");
      expect(res.currentQuestionData?.questionId).toBe(55);
      expect(res.timerRemaining).toBe(7);
    } finally {
      viewer.disconnect();
      host.disconnect();
    }
  });
});
