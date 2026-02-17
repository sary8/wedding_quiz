/**
 * 負荷テスト事前セットアップスクリプト
 *
 * 実行すると:
 *   1. バックエンド API でクイズ + 問題を作成
 *   2. Socket.io で openRoom → ルームコード取得
 *   3. .env.load ファイルにルームコードを書き出す
 *
 * 使い方:
 *   node setup.mjs
 *   → ROOM_CODE=XXXXXX が .env.load に保存される
 *   → その後 artillery run artillery.yml を実行
 *
 * クリーンアップ:
 *   node setup.mjs --cleanup
 *   → .env.load に記録されたクイズを削除
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createRequire } from "module";
import { io } from "socket.io-client";

const require = createRequire(import.meta.url);
const API_BASE = process.env.API_URL ?? "http://localhost:3001";
const ENV_FILE = ".env.load";

// ── クリーンアップモード ──────────────────────────────────────
if (process.argv.includes("--cleanup")) {
  if (!existsSync(ENV_FILE)) {
    console.log("クリーンアップするデータがありません（.env.load が存在しない）");
    process.exit(0);
  }
  const env = Object.fromEntries(
    readFileSync(ENV_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("="))
  );
  if (env.QUIZ_ID && env.HOST_SECRET) {
    const res = await fetch(`${API_BASE}/api/quizzes/${env.QUIZ_ID}?key=${env.HOST_SECRET}`, {
      method: "DELETE",
    });
    if (res.ok) {
      console.log(`✓ クイズ ID=${env.QUIZ_ID} を削除しました`);
    } else {
      console.error("削除失敗:", res.status);
    }
  }
  process.exit(0);
}

// ── セットアップ ──────────────────────────────────────────────
console.log("=== Wedding Quiz 負荷テストセットアップ ===");
console.log(`API: ${API_BASE}`);

// 1. クイズ作成
console.log("\n[1/3] クイズを作成中...");
const quizRes = await fetch(`${API_BASE}/api/quizzes`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "負荷テスト用クイズ" }),
});
if (!quizRes.ok) {
  console.error("クイズ作成失敗:", quizRes.status, await quizRes.text());
  process.exit(1);
}
const quiz = await quizRes.json();
console.log(`  → quizId=${quiz.id}  hostSecret=${quiz.host_secret}`);

// 2. 問題を3問追加
console.log("\n[2/3] 問題を追加中...");
const questions = [
  { question_text: "日本の首都は？", choice1: "東京", choice2: "大阪", choice3: "京都", choice4: "名古屋", correct_choice: 1, time_limit: 15 },
  { question_text: "1+1は？", choice1: "1", choice2: "2", choice3: "3", choice4: "4", correct_choice: 2, time_limit: 10 },
  { question_text: "太陽は何色？", choice1: "青", choice2: "緑", choice3: "黄", choice4: "赤", correct_choice: 3, time_limit: 15 },
];
for (const q of questions) {
  const qRes = await fetch(`${API_BASE}/api/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz_id: quiz.id, ...q }),
  });
  if (!qRes.ok) {
    console.error("問題追加失敗:", qRes.status, await qRes.text());
  } else {
    console.log(`  → "${q.question_text}" 追加完了`);
  }
}

// 3. Socket.io で openRoom → roomCode 取得
console.log("\n[3/3] ルームを開設中...");
const roomCode = await new Promise((resolve, reject) => {
  const socket = io(API_BASE, { transports: ["websocket"], timeout: 10000 });

  socket.on("connect", () => {
    socket.emit("openRoom", { quizId: quiz.id, hostSecret: quiz.host_secret }, (res) => {
      socket.disconnect();
      if (res.success) {
        resolve(res.roomCode);
      } else {
        reject(new Error(res.error ?? "openRoom 失敗"));
      }
    });
  });

  socket.on("connect_error", (err) => {
    reject(new Error(`Socket.io 接続失敗: ${err.message}`));
  });

  setTimeout(() => reject(new Error("タイムアウト")), 10000);
});

console.log(`  → ルームコード: ${roomCode}`);

// 4. .env.load に書き出す
const envContent = [
  `ROOM_CODE=${roomCode}`,
  `QUIZ_ID=${quiz.id}`,
  `HOST_SECRET=${quiz.host_secret}`,
  `CREATED_AT=${new Date().toISOString()}`,
].join("\n") + "\n";

writeFileSync(ENV_FILE, envContent, "utf8");

console.log(`\n✓ セットアップ完了！`);
console.log(`  ルームコード : ${roomCode}`);
console.log(`  クイズID    : ${quiz.id}`);
console.log(`  設定ファイル : ${ENV_FILE}`);
console.log(`\n次のコマンドで負荷テストを実行:`);
console.log(`  npm test\n`);
