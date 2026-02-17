# ページ一覧

## サーバー

| 役割 | URL |
|------|-----|
| フロントエンド | http://localhost:5174 |
| バックエンド API | http://localhost:3001 |

---

## ホスト（PC/プロジェクター操作側）

### `/host/setup`
**問題作成・管理画面**
- クイズの新規作成（タイトル入力）
- 既存クイズの選択
- 問題の追加（問題文・選択肢4択・正解・制限時間・画像アップロード）
- 問題の削除
- ロビーを開くボタン（`/host/:roomCode?key=...&quizId=...` へ遷移）

---

### `/host/:roomCode?key=HOST_SECRET&quizId=QUIZ_ID`
**ホスト操作画面**（Socket.io `openRoom` で自動接続）

| フェーズ | 表示内容 | 操作 |
|----------|----------|------|
| lobby | QRコード + ルームコード + 参加者一覧 | ゲーム開始ボタン |
| question | 問題文・選択肢・カウントダウン・回答数 | 回答を締め切るボタン |
| results | 回答分布グラフ・正解表示 | ランキング表示 / 次の問題 |
| ranking | Top10 スコアバーアニメーション | 次の問題 / 最終結果発表 |
| final | オールスター感謝祭式カウントダウン発表 | なし（自動進行） |

> `key` パラメータ = `host_secret`（localStorage に保存済み）
> `quizId` パラメータ = クイズID

---

### `/host/:roomCode/screen`
**プロジェクター専用表示画面**（読み取り専用）
- Socket.io `watchRoom` で参加（操作ボタンなし）
- ホスト操作画面と完全同期
- ゲーム開始後にアクセスしても既存参加者を表示
- URL例: `http://localhost:5174/host/ABCDEF/screen`

---

## 参加者（スマホ）

### `/play`
**ルームコード入力画面**
- ルームコード（6文字）を入力して参加

---

### `/play/:roomCode`
**参加フロー**（内部でフェーズ管理）

| フェーズ | 表示内容 |
|----------|----------|
| profile | ニックネーム入力 + 自撮り撮影（任意） |
| waiting | 待機画面（ゲーム開始まで） |
| answer | 4色ボタンで回答（制限時間カウントダウン） |
| result | 正解/不正解 + 獲得ポイント + 現在順位 |
| ranking | ランキング表示（ホストと連動） |
| final | 自分の最終順位 + 正答数 + 平均回答速度 |

> `localStorage` に `participantToken` を保存して再接続に対応

---

## API エンドポイント（バックエンド）

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/quizzes` | クイズ一覧 |
| POST | `/api/quizzes` | クイズ作成 |
| GET | `/api/quizzes/:id?key=` | クイズ詳細（問題含む） |
| DELETE | `/api/quizzes/:id?key=` | クイズ削除 |
| POST | `/api/questions` | 問題追加 |
| PUT | `/api/questions/:id` | 問題更新 |
| DELETE | `/api/questions/:id?key=` | 問題削除 |
| POST | `/api/media/upload` | 画像・動画アップロード |
| POST | `/api/media/selfie` | 自撮りアップロード（base64） |
| GET | `/api/media/:filename` | メディア配信 |

---

## Socket.io イベント

### Client → Server

| イベント | 送信者 | 説明 |
|----------|--------|------|
| `openRoom` | ホスト | ルーム開設（`quizId`, `hostSecret`） |
| `startGame` | ホスト | ゲーム開始 |
| `nextQuestion` | ホスト | 次の問題を配信 |
| `closeQuestion` | ホスト | 回答を手動締め切り |
| `showRanking` | ホスト | ランキング計算・配信 |
| `endGame` | ホスト | ゲーム終了・最終結果配信 |
| `watchRoom` | プロジェクター | 読み取り専用参加（既存参加者も取得） |
| `joinRoom` | 参加者 | ニックネーム・自撮りで参加 |
| `submitAnswer` | 参加者 | 回答送信（`questionId`, `choiceIndex: 1-4`） |

### Server → Client

| イベント | 受信者 | 説明 |
|----------|--------|------|
| `lobbyUpdate` | 全員 | 参加者リスト更新 |
| `participantJoined` | 全員 | 新規参加者通知 |
| `gameStarted` | 全員 | ゲーム開始通知 |
| `questionStarted` | 全員 | 問題データ配信 |
| `timeUpdate` | 全員 | 残り秒数（毎秒） |
| `answerCountUpdate` | 全員 | 現在の回答数 |
| `questionClosed` | 全員 | 回答締め切り |
| `questionResult` | 全員 | 正解・分布（参加者は個人結果も含む） |
| `rankingUpdate` | 全員 | ランキングデータ |
| `gameEnded` | 全員 | 最終結果データ |
| `reconnected` | 参加者 | 再接続時のステータス通知 |
