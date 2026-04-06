import type { Server, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents, QuizStatus, QuestionResultData } from "../types/index.js";
import * as quizService from "../services/quizService.js";
import { startTimer, stopTimer, getElapsedMs, getRemainingSeconds } from "../services/timerService.js";
import { logger } from "../utils/logger.js";
import { getSocketClientIp } from "../utils/clientIp.js";

type QuizIO = Server<ClientToServerEvents, ServerToClientEvents>;
type QuizSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// socketId → { participantId, roomCode } のマッピング
const socketMeta = new Map<string, { participantId: number; roomCode: string }>();

// roomCode → 現在の問題ID
const activeQuestions = new Map<string, number>();

// nextQuestion の二重押し防止
const advancingRooms = new Set<string>();

// roomCode バリデーション: 6桁数字のみ許可
const ROOM_CODE_RE = /^\d{6}$/;

// IP単位のソケットイベントレート制限
const SOCKET_RATE_LIMIT_WINDOW_MS = 60_000; // 1分
const SOCKET_RATE_LIMIT_MAX = 20; // 1分あたり最大20回
const socketRateMap = new Map<string, { count: number; resetAt: number }>();

function checkSocketRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = socketRateMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    socketRateMap.set(ip, { count: 1, resetAt: now + SOCKET_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= SOCKET_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// 定期クリーンアップ（期限切れレート制限エントリ削除）
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of socketRateMap) {
    if (now >= entry.resetAt) socketRateMap.delete(ip);
  }
}, 60_000);

// nicknameサニタイズ: 制御文字・特殊Unicode除去
function sanitizeNickname(raw: string): string {
  // 制御文字 (C0/C1), ZWJ/ZWNJ, 方向制御文字, オブジェクト置換文字を除去
  return raw.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\uFFFC]/g, "").trim();
}

// 定期クリーンアップ: 切断済みソケットのゴーストエントリ削除
let cleanupIo: QuizIO | null = null;

function startMetaCleanup(io: QuizIO) {
  cleanupIo = io;
}

setInterval(async () => {
  if (!cleanupIo) return;
  const connectedIds = new Set<string>();
  try {
    const sockets = await cleanupIo.fetchSockets();
    for (const s of sockets) connectedIds.add(s.id);
  } catch {
    return;
  }
  for (const socketId of socketMeta.keys()) {
    if (!connectedIds.has(socketId)) {
      socketMeta.delete(socketId);
    }
  }
}, 300_000); // 5分ごと

// 結果配信ヘルパー: closeQuestion と タイマー自動終了 で共通利用
async function distributeQuestionResult(
  io: QuizIO,
  roomCode: string,
  questionId: number,
  hostSocketId?: string
) {
  // ランキング計算を先に実行（current_rankをDBに反映してからresultを取得する）
  await quizService.calculateRanking(roomCode);

  const sockets = await io.in(roomCode).fetchSockets();

  // 参加者ソケットを抽出
  const participantSockets = sockets.filter((s) => {
    const meta = socketMeta.get(s.id);
    return meta && meta.participantId > 0;
  });

  // バッチクエリで全参加者の結果を一括取得（N+1削減）
  const participantIds = participantSockets.map((s) => socketMeta.get(s.id)!.participantId);
  const [resultMap, hostResult] = await Promise.all([
    participantIds.length > 0
      ? quizService.getQuestionResultBatch(questionId, participantIds)
      : Promise.resolve(new Map<number, QuestionResultData>()),
    quizService.getQuestionResult(questionId),
  ]);

  // 各参加者に個別結果を送信
  for (const s of participantSockets) {
    const pid = socketMeta.get(s.id)!.participantId;
    const result = resultMap.get(pid);
    if (result) s.emit("questionResult", result);
  }

  // ホストには全体結果を送信
  if (hostSocketId) {
    const hostSocket = sockets.find((s) => s.id === hostSocketId);
    if (hostSocket) {
      hostSocket.emit("questionResult", hostResult);
    }
  } else {
    // タイマー自動終了時: ホストのsocketIdが不明なので、participantId === -1 のソケットに送信
    for (const s of sockets) {
      const meta = socketMeta.get(s.id);
      if (meta && meta.participantId === -1 && meta.roomCode === roomCode) {
        s.emit("questionResult", hostResult);
        break;
      }
    }
  }

  // ビューワー（Display画面）にも全体結果を送信
  for (const s of sockets) {
    const meta = socketMeta.get(s.id);
    if (meta && meta.participantId === -2 && meta.roomCode === roomCode) {
      s.emit("questionResult", hostResult);
    }
  }
}

/** テスト用: ソケットレート制限をリセット */
export function _resetSocketRateLimit() {
  socketRateMap.clear();
}

export function setupQuizSocket(io: QuizIO) {
  startMetaCleanup(io);

  io.on("connection", (socket: QuizSocket) => {
    logger.info("socket connected", { socketId: socket.id });

    // === 参加者: ルーム参加 ===
    socket.on("joinRoom", async (data, callback) => {
      try {
        const joinIp = getSocketClientIp(socket);
        if (!checkSocketRateLimit(joinIp)) {
          logger.warn("joinRoom rate limited", { ip: joinIp });
          callback({ success: false, error: "リクエストが多すぎます。しばらくしてから再試行してください" });
          return;
        }

        if (!data.roomCode || typeof data.roomCode !== "string" || !ROOM_CODE_RE.test(data.roomCode)) {
          logger.warn("joinRoom validation failed: invalid roomCode", { socketId: socket.id });
          callback({ success: false, error: "ルームコードが不正です" });
          return;
        }
        if (!data.nickname || typeof data.nickname !== "string" || !data.nickname.trim()) {
          logger.warn("joinRoom validation failed: missing nickname", { roomCode: data.roomCode });
          callback({ success: false, error: "ニックネームを入力してください" });
          return;
        }
        const nickname = sanitizeNickname(data.nickname);
        if (!nickname || nickname.length === 0) {
          logger.warn("joinRoom validation failed: nickname empty after sanitize", { roomCode: data.roomCode });
          callback({ success: false, error: "ニックネームを入力してください" });
          return;
        }
        if (nickname.length > 8) {
          logger.warn("joinRoom validation failed: nickname too long", { roomCode: data.roomCode });
          callback({ success: false, error: "ニックネームは8文字以内で入力してください" });
          return;
        }

        const result = await quizService.joinRoom(
          data.roomCode,
          nickname,
          data.selfieData || null,
          socket.id,
          data.token,
          data.teamId
        );

        if ("error" in result) {
          logger.warn("joinRoom rejected", { roomCode: data.roomCode, error: result.error });
          callback({ success: false, error: result.error });
          return;
        }

        const { participant, reconnect } = result;
        socket.join(data.roomCode);
        socketMeta.set(socket.id, {
          participantId: participant.id,
          roomCode: data.roomCode,
        });

        logger.info("participant joined", {
          roomCode: data.roomCode,
          participantId: participant.id,
          reconnect,
        });

        callback({
          success: true,
          participantId: participant.id,
          token: participant.token,
        });

        if (reconnect) {
          const quiz = await quizService.getQuizByRoom(data.roomCode);
          const quizStatus = (quiz?.status ?? "lobby") as QuizStatus;

          // in_progress中の再接続: 現在出題中の問題があれば復元データを送信
          let currentQuestionData = null;
          if (quizStatus === "in_progress") {
            const activeQuestionId = activeQuestions.get(data.roomCode);
            if (activeQuestionId && quiz) {
              currentQuestionData = await quizService.getReconnectQuestionData(quiz.id, quiz.current_question_index);
            }
          }

          // finished中の再接続: 最終結果データを送信
          let finalData = null;
          if (quizStatus === "finished") {
            finalData = await quizService.getFinalResult(data.roomCode);
          }

          socket.emit("reconnected", {
            participantId: participant.id,
            quizStatus,
            currentQuestionData,
            finalData,
          });
        } else {
          // 新規参加を全員に通知
          const p = await quizService.getParticipant(participant.id);
          if (p) {
            io.to(data.roomCode).emit("participantJoined", {
              id: p.id,
              nickname: p.nickname,
              selfieUrl: p.selfie_file_name
                ? `/api/media/${p.selfie_file_name}`
                : null,
            });
          }

          // ロビー更新（チームモード時はteams情報も含める）
          const quiz = await quizService.getQuizByRoom(data.roomCode);
          const participants = await quizService.getLobbyParticipants(data.roomCode);
          const lobbyData: { participants: typeof participants; teams?: Awaited<ReturnType<typeof quizService.getTeams>> } = { participants };
          if (quiz?.team_mode) {
            lobbyData.teams = await quizService.getTeams(quiz.id);
          }
          io.to(data.roomCode).emit("lobbyUpdate", lobbyData);
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("joinRoom error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "参加に失敗しました" });
      }
    });

    // === 参加者: 回答送信 ===
    socket.on("submitAnswer", async (data, callback) => {
      try {
        const meta = socketMeta.get(socket.id);
        if (!meta) {
          logger.warn("submitAnswer rejected: no session", { socketId: socket.id });
          callback({ success: false, error: "セッションが見つかりません" });
          return;
        }

        // バリデーション（アクティブチェックより先に実行）
        if (!Number.isInteger(data.questionId) || data.questionId <= 0) {
          logger.warn("submitAnswer validation failed: invalid questionId", {
            roomCode: meta.roomCode,
            participantId: meta.participantId,
          });
          callback({ success: false, error: "不正な問題IDです" });
          return;
        }
        if (!Number.isInteger(data.choiceIndex) || data.choiceIndex < 1 || data.choiceIndex > 4) {
          logger.warn("submitAnswer validation failed: invalid choiceIndex", {
            roomCode: meta.roomCode,
            participantId: meta.participantId,
          });
          callback({ success: false, error: "不正な選択肢です" });
          return;
        }

        const questionId = activeQuestions.get(meta.roomCode);
        if (questionId !== data.questionId) {
          logger.warn("submitAnswer rejected: question not active", {
            roomCode: meta.roomCode,
            participantId: meta.participantId,
            questionId: data.questionId,
          });
          callback({ success: false, error: "この問題の回答期間は終了しました" });
          return;
        }

        // 回答時間を計算（タイマー開始からの経過時間）
        const elapsedMs = getElapsedMs(`question_${meta.roomCode}`) ?? 0;

        const result = await quizService.submitAnswer(
          meta.participantId,
          data.questionId,
          data.choiceIndex,
          elapsedMs
        );

        if ("error" in result) {
          // 既に回答済みの場合はフロントに成功として返す（二重タップ対策）
          if (result.error === "既に回答済みです") {
            callback({ success: true });
            return;
          }
          callback({ success: false, error: result.error });
          return;
        }

        logger.info("answer submitted", {
          roomCode: meta.roomCode,
          participantId: meta.participantId,
          questionId: data.questionId,
        });

        callback({ success: true });

        // 回答数を更新通知（ホスト向け）
        const count = await quizService.getAnswerCount(data.questionId);
        io.to(meta.roomCode).emit("answerCountUpdate", { count });
      } catch (e) {
        const meta = socketMeta.get(socket.id);
        const err = e instanceof Error ? e.message : String(e);
        logger.error("submitAnswer error", { error: err, roomCode: meta?.roomCode });
        callback({ success: false, error: "回答の送信に失敗しました" });
      }
    });

    // === ホスト: ルーム開設 ===
    socket.on("openRoom", async (data, callback) => {
      try {
        const roomCode = await quizService.openRoom(data.quizId, data.hostSecret);
        if (!roomCode) {
          logger.warn("openRoom failed", { quizId: data.quizId });
          callback({ success: false, error: "ルームの開設に失敗しました" });
          return;
        }

        // 既存ホストソケットを検知（同一roomCodeで別ソケット）
        const existingHost = Array.from(socketMeta.entries()).find(
          ([id, m]) => id !== socket.id && m.roomCode === roomCode && m.participantId === -1
        );
        if (existingHost) {
          // 既存ホストに通知して切断
          const oldSocket = (await io.in(roomCode).fetchSockets()).find((s) => s.id === existingHost[0]);
          if (oldSocket) {
            oldSocket.emit("error", { message: "別のタブでホスト画面が開かれたため、この接続は無効になりました" });
          }
          socketMeta.delete(existingHost[0]);
        }

        socket.join(roomCode);
        socketMeta.set(socket.id, { participantId: -1, roomCode });

        logger.info("room opened", { roomCode, quizId: data.quizId });

        callback({ success: true, roomCode });

        // ホスト復旧: lobby/in_progress状態を復元通知
        const quiz = await quizService.getQuizByRoom(roomCode);
        if (quiz && quiz.status !== "draft") {
          const participants = await quizService.getLobbyParticipants(roomCode);

          // ロビー更新通知にteams情報を含める
          const lobbyData: { participants: typeof participants; teams?: Awaited<ReturnType<typeof quizService.getTeams>> } = { participants };
          if (quiz.team_mode) {
            lobbyData.teams = await quizService.getTeams(quiz.id);
          }
          io.to(roomCode).emit("lobbyUpdate", lobbyData);

          // in_progress時: 現在の問題データ・回答数・タイマー残り時間を復元
          let currentQuestionData = null;
          let answerCount = 0;
          let timerRemaining = 0;
          if (quiz.status === "in_progress") {
            const activeQuestionId = activeQuestions.get(roomCode);
            if (activeQuestionId) {
              currentQuestionData = await quizService.getReconnectQuestionData(quiz.id, quiz.current_question_index);
              answerCount = await quizService.getAnswerCount(activeQuestionId);
              timerRemaining = getRemainingSeconds(`question_${roomCode}`) ?? 0;
            }
          }

          if (quiz.status === "finished") {
            const finalData = await quizService.getFinalResult(roomCode);
            socket.emit("hostReconnected", {
              quizStatus: quiz.status as QuizStatus,
              currentQuestionIndex: quiz.current_question_index,
              participants,
              finalData,
            });
          } else {
            socket.emit("hostReconnected", {
              quizStatus: quiz.status as QuizStatus,
              currentQuestionIndex: quiz.current_question_index,
              participants,
              currentQuestionData,
              answerCount,
              timerRemaining,
            });
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("openRoom error", { error: err, quizId: data.quizId });
        callback({ success: false, error: "ルームの開設に失敗しました" });
      }
    });

    // === ホスト: ゲーム開始 ===
    socket.on("startGame", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("startGame auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        const quizId = await quizService.startGame(data.roomCode);
        if (!quizId) {
          callback({ success: false, error: "ゲームの開始に失敗しました" });
          return;
        }

        logger.info("game started", { roomCode: data.roomCode });

        io.to(data.roomCode).emit("gameStarted");
        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("startGame error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "ゲームの開始に失敗しました" });
      }
    });

    // === ホスト: 次の問題 ===
    socket.on("nextQuestion", async (data, callback) => {
      try {
        // 二重押し防止
        if (advancingRooms.has(data.roomCode)) {
          callback({ success: false, error: "問題の配信中です" });
          return;
        }
        advancingRooms.add(data.roomCode);

        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          advancingRooms.delete(data.roomCode);
          logger.warn("nextQuestion auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        const question = await quizService.getNextQuestion(data.roomCode);
        if (!question) {
          advancingRooms.delete(data.roomCode);
          callback({ success: false, error: "これ以上問題がありません" });
          return;
        }

        activeQuestions.set(data.roomCode, question.questionId);
        advancingRooms.delete(data.roomCode);
        io.to(data.roomCode).emit("questionStarted", question);

        logger.info("question started", { roomCode: data.roomCode, questionId: question.questionId });

        // サーバーサイドタイマー開始
        const roomCode = data.roomCode;
        const questionId = question.questionId;
        startTimer(
          `question_${roomCode}`,
          question.timeLimitSeconds,
          (remaining) => {
            io.to(roomCode).emit("timeUpdate", { remaining });
          },
          async () => {
            // タイムアップ時に自動クローズ + 結果配信
            // closeQuestionで既に処理済みなら何もしない（二重実行ガード）
            const stillActive = activeQuestions.get(roomCode);
            if (stillActive !== questionId) return;
            activeQuestions.delete(roomCode);
            io.to(roomCode).emit("questionClosed");
            try {
              await distributeQuestionResult(io, roomCode, questionId);
            } catch (e) {
              const err = e instanceof Error ? e.message : String(e);
              logger.error("timer auto-close result distribution error", { error: err, roomCode, questionId });
              io.to(roomCode).emit("questionResult", {
                questionId,
                correctChoice: -1,
                distribution: [0, 0, 0, 0],
              });
            }
          }
        );

        callback({ success: true });
      } catch (e) {
        advancingRooms.delete(data.roomCode);
        const err = e instanceof Error ? e.message : String(e);
        logger.error("nextQuestion error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "問題の配信に失敗しました" });
      }
    });

    // === ホスト: 問題締め切り ===
    socket.on("closeQuestion", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("closeQuestion auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        stopTimer(`question_${data.roomCode}`);
        const questionId = activeQuestions.get(data.roomCode);
        activeQuestions.delete(data.roomCode);

        if (questionId) {
          io.to(data.roomCode).emit("questionClosed");
          await distributeQuestionResult(io, data.roomCode, questionId, socket.id);
          logger.info("question closed", { roomCode: data.roomCode, questionId });
        }

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("closeQuestion error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "問題の締め切りに失敗しました" });
      }
    });

    // === ホスト: ランキング表示 ===
    socket.on("showRanking", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("showRanking auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        const rankingData = await quizService.calculateRanking(data.roomCode);
        io.to(data.roomCode).emit("rankingUpdate", rankingData);

        logger.info("ranking shown", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("showRanking error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "ランキングの表示に失敗しました" });
      }
    });

    // === ホスト: ゲーム終了 ===
    socket.on("endGame", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("endGame auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        const finalResult = await quizService.getFinalResult(data.roomCode);
        io.to(data.roomCode).emit("gameEnded", finalResult);

        logger.info("game ended", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("endGame error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "ゲーム終了に失敗しました" });
      }
    });

    // === ホスト: リプレイ ===
    socket.on("replayQuiz", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("replayQuiz auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        const result = await quizService.replayQuiz(quiz.id, quiz.host_secret);
        if ("error" in result) {
          callback({ success: false, error: result.error });
          return;
        }

        activeQuestions.delete(data.roomCode);
        stopTimer(`question_${data.roomCode}`);

        io.to(data.roomCode).emit("quizReset");

        const participants = await quizService.getLobbyParticipants(data.roomCode);
        const lobbyData: { participants: typeof participants; teams?: Awaited<ReturnType<typeof quizService.getTeams>> } = { participants };
        if (quiz.team_mode) {
          lobbyData.teams = await quizService.getTeams(quiz.id);
        }
        io.to(data.roomCode).emit("lobbyUpdate", lobbyData);

        logger.info("quiz replayed", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("replayQuiz error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "リプレイに失敗しました" });
      }
    });

    // === ホスト: ゲームクローズ ===
    socket.on("closeGame", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("closeGame auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        const participants = await quizService.getLobbyParticipants(data.roomCode);
        io.to(data.roomCode).emit("gameClosed", { participants });

        logger.info("game closed", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("closeGame error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "ゲームの終了に失敗しました" });
      }
    });

    // === ホスト: Top5順位発表（Display画面へリレー） ===
    socket.on("revealNextRank", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("revealNextRank auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        // ルーム内の全クライアントにリレー（ホスト自身を除く）
        socket.to(data.roomCode).emit("revealNextRank");

        logger.info("revealNextRank relayed", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("revealNextRank error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "順位発表に失敗しました" });
      }
    });

    // === ホスト: ランキングページ切り替え（Display画面へリレー） ===
    socket.on("setRankingPage", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("setRankingPage auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        socket.to(data.roomCode).emit("rankingPageChanged", { page: data.page, mode: data.mode });

        logger.info("setRankingPage relayed", { roomCode: data.roomCode, page: data.page, mode: data.mode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("setRankingPage error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "ランキングページ変更に失敗しました" });
      }
    });

    // === ホスト: 参加者に個人結果を公開 ===
    socket.on("showParticipantResults", async (data, callback) => {
      try {
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("showParticipantResults auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        socket.to(data.roomCode).emit("showParticipantResults");

        logger.info("showParticipantResults relayed", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("showParticipantResults error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "参加者結果の公開に失敗しました" });
      }
    });

    // === ビューワー: 読み取り専用参加 ===
    socket.on("watchRoom", async (data, callback) => {
      try {
        const watchIp = getSocketClientIp(socket);
        if (!checkSocketRateLimit(watchIp)) {
          logger.warn("watchRoom rate limited", { ip: watchIp });
          callback({ success: false, error: "リクエストが多すぎます。しばらくしてから再試行してください" });
          return;
        }

        if (!data.roomCode || typeof data.roomCode !== "string" || !ROOM_CODE_RE.test(data.roomCode)) {
          logger.warn("watchRoom validation failed: invalid roomCode", { socketId: socket.id });
          callback({ success: false, error: "ルームコードが不正です" });
          return;
        }

        // 実在ルーム確認
        const quiz = await quizService.getQuizByRoom(data.roomCode);
        if (!quiz) {
          callback({ success: false, error: "ルームが見つかりません" });
          return;
        }

        socket.join(data.roomCode);

        // meta設定済み（host/participant/既存viewer）は上書きしない
        const existingMeta = socketMeta.get(socket.id);
        if (!existingMeta) {
          socketMeta.set(socket.id, { participantId: -2, roomCode: data.roomCode });
        }

        const participants = await quizService.getLobbyParticipants(data.roomCode);
        const lobbyData: { participants: typeof participants; teams?: Awaited<ReturnType<typeof quizService.getTeams>> } = { participants };
        if (quiz.team_mode) {
          lobbyData.teams = await quizService.getTeams(quiz.id);
        }
        socket.emit("lobbyUpdate", lobbyData);

        logger.info("viewer joined", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("watchRoom error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "ルームの監視に失敗しました" });
      }
    });

    // === 切断処理 ===
    socket.on("disconnect", async () => {
      const meta = socketMeta.get(socket.id);
      const role = meta ? (meta.participantId === -1 ? "host" : meta.participantId === -2 ? "viewer" : "participant") : "unknown";
      logger.info("socket disconnected", { socketId: socket.id, roomCode: meta?.roomCode, role });
      if (meta) {
        if (meta.participantId > 0) {
          await quizService.handleDisconnect(socket.id);
        }

        // ホスト切断時: タイマーは継続（onEndで自動クローズされる。ホストが再接続すれば状態復元される）
      }
      socketMeta.delete(socket.id);
    });
  });
}
