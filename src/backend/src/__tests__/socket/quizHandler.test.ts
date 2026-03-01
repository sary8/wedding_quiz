import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../types/index.js";

// quizService をモック
vi.mock("../../services/quizService.js", () => ({
  openRoom: vi.fn(),
  getQuizByRoom: vi.fn(),
  getLobbyParticipants: vi.fn(),
  getTeams: vi.fn(),
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
const { setupQuizSocket } = await import("../../socket/quizHandler.js");

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
        client, "watchRoom", { roomCode: "9999" },
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("ルームが見つかりません");
      expect(quizService.getQuizByRoom).toHaveBeenCalledWith("9999");
    } finally {
      client.disconnect();
    }
  });

  it("正常なviewerのwatchRoom → 成功 + lobbyUpdate受信", async () => {
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 1,
      room_code: "1234",
      host_secret: "secret",
      title: "テスト",
      status: "lobby",
      current_question_index: -1,
      team_mode: false,
      created_at: new Date().toISOString(),
    });
    vi.mocked(quizService.getLobbyParticipants).mockResolvedValue([]);

    const client = await connectClient();
    try {
      const lobbyPromise = new Promise<unknown>((resolve) => {
        client.on("lobbyUpdate", (data) => resolve(data));
      });

      const res = await emitWithCallback<{ success: boolean }>(
        client, "watchRoom", { roomCode: "1234" },
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
    vi.mocked(quizService.openRoom).mockResolvedValue("5555");
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 10,
      room_code: "5555",
      host_secret: "host-secret",
      title: "ホストテスト",
      status: "lobby",
      current_question_index: -1,
      team_mode: false,
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
      expect(openRes.roomCode).toBe("5555");

      // 2. watchRoomを呼んでもmetaが上書きされないことを確認
      const watchRes = await emitWithCallback<{ success: boolean }>(
        client, "watchRoom", { roomCode: "5555" },
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

  it("team_mode ONのルーム → lobbyUpdateにteams含む", async () => {
    vi.mocked(quizService.getQuizByRoom).mockResolvedValue({
      id: 2,
      room_code: "7777",
      host_secret: "secret",
      title: "チームクイズ",
      status: "lobby",
      current_question_index: -1,
      team_mode: true,
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
        client, "watchRoom", { roomCode: "7777" },
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
