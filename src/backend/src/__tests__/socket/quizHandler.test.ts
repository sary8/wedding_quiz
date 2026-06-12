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
