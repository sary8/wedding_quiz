import type { Server, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents, QuizStatus } from "../types/index.js";
import * as quizService from "../services/quizService.js";
import { startTimer, stopTimer, getElapsedMs } from "../services/timerService.js";
import { logger } from "../utils/logger.js";

type QuizIO = Server<ClientToServerEvents, ServerToClientEvents>;
type QuizSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// socketId → { participantId, roomCode } のマッピング
const socketMeta = new Map<string, { participantId: number; roomCode: string }>();

// roomCode → 現在の問題ID
const activeQuestions = new Map<string, number>();

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

  // 参加者ソケットとホストの結果を並列取得
  const participantSockets = sockets.filter((s) => {
    const meta = socketMeta.get(s.id);
    return meta && meta.participantId > 0;
  });

  const [participantResults, hostResult] = await Promise.all([
    Promise.all(
      participantSockets.map((s) =>
        quizService.getQuestionResult(questionId, socketMeta.get(s.id)!.participantId)
      )
    ),
    quizService.getQuestionResult(questionId),
  ]);

  // 各参加者に個別結果を送信
  for (let i = 0; i < participantSockets.length; i++) {
    participantSockets[i].emit("questionResult", participantResults[i]);
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
}

export function setupQuizSocket(io: QuizIO) {
  io.on("connection", (socket: QuizSocket) => {
    logger.info("socket connected", { socketId: socket.id });

    // === 参加者: ルーム参加 ===
    socket.on("joinRoom", async (data, callback) => {
      try {
        if (!data.roomCode || typeof data.roomCode !== "string" || data.roomCode.length !== 4) {
          logger.warn("joinRoom validation failed: invalid roomCode", { socketId: socket.id });
          callback({ success: false, error: "ルームコードが不正です" });
          return;
        }
        if (!data.nickname || typeof data.nickname !== "string" || !data.nickname.trim()) {
          logger.warn("joinRoom validation failed: missing nickname", { roomCode: data.roomCode });
          callback({ success: false, error: "ニックネームを入力してください" });
          return;
        }
        if (data.nickname.length > 30) {
          logger.warn("joinRoom validation failed: nickname too long", { roomCode: data.roomCode });
          callback({ success: false, error: "ニックネームが長すぎます" });
          return;
        }

        const result = await quizService.joinRoom(
          data.roomCode,
          data.nickname,
          data.selfieData || null,
          socket.id,
          data.token
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

          socket.emit("reconnected", {
            participantId: participant.id,
            quizStatus,
            currentQuestionData,
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

          // ロビー更新
          const participants = await quizService.getLobbyParticipants(data.roomCode);
          io.to(data.roomCode).emit("lobbyUpdate", { participants });
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

        // バリデーション
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
          socket.emit("hostReconnected", {
            quizStatus: quiz.status as QuizStatus,
            currentQuestionIndex: quiz.current_question_index,
            participants,
          });
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
        const quiz = await quizService.verifyHostSecret(data.roomCode, data.hostSecret);
        if (!quiz) {
          logger.warn("nextQuestion auth failed", { roomCode: data.roomCode });
          callback({ success: false, error: "認証エラー" });
          return;
        }

        const question = await quizService.getNextQuestion(data.roomCode);
        if (!question) {
          callback({ success: false, error: "これ以上問題がありません" });
          return;
        }

        activeQuestions.set(data.roomCode, question.questionId);
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
            activeQuestions.delete(roomCode);
            io.to(roomCode).emit("questionClosed");
            try {
              await distributeQuestionResult(io, roomCode, questionId);
            } catch (e) {
              const err = e instanceof Error ? e.message : String(e);
              logger.error("timer auto-close result distribution error", { error: err, roomCode, questionId });
              io.to(roomCode).emit("questionResult", {
                questionId,
                correctChoice: 0,
                distribution: [0, 0, 0, 0],
              });
            }
          }
        );

        callback({ success: true });
      } catch (e) {
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

        const rankings = await quizService.calculateRanking(data.roomCode);
        io.to(data.roomCode).emit("rankingUpdate", { rankings });

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
        io.to(data.roomCode).emit("lobbyUpdate", { participants });

        logger.info("quiz replayed", { roomCode: data.roomCode });

        callback({ success: true });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error("replayQuiz error", { error: err, roomCode: data.roomCode });
        callback({ success: false, error: "リプレイに失敗しました" });
      }
    });

    // === ビューワー: 読み取り専用参加 ===
    socket.on("watchRoom", async (data, callback) => {
      try {
        if (!data.roomCode || typeof data.roomCode !== "string") {
          logger.warn("watchRoom validation failed: invalid roomCode", { socketId: socket.id });
          callback({ success: false, error: "ルームコードが不正です" });
          return;
        }
        socket.join(data.roomCode);
        socketMeta.set(socket.id, { participantId: -2, roomCode: data.roomCode });

        const participants = await quizService.getLobbyParticipants(data.roomCode);
        socket.emit("lobbyUpdate", { participants });

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

        // ホスト切断時: activeQuestionsを掃除してタイマーを停止
        if (meta.participantId === -1) {
          const roomCode = meta.roomCode;
          // 同じroomCodeに別のホストソケットがなければ掃除
          const hasOtherHost = Array.from(socketMeta.entries()).some(
            ([id, m]) => id !== socket.id && m.roomCode === roomCode && m.participantId === -1
          );
          if (!hasOtherHost) {
            activeQuestions.delete(roomCode);
            stopTimer(`question_${roomCode}`);
          }
        }
      }
      socketMeta.delete(socket.id);
    });
  });
}
