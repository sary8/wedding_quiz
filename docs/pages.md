# ページ一覧

## サーバー

| 役割 | URL |
|------|-----|
| フロントエンド | http://localhost:5174 |
| バックエンド API | http://localhost:3001 |

---

## ホスト（PC/プロジェクター操作側）

### `/host/setup`
**ダッシュボードハブ**（`?view=` でビュー切替）
- ダッシュボード（デフォルト）: クイズ作成・下書き/進行中クイズの管理
- `?view=edit&quizId=N`: 問題管理（追加・編集・削除・D&D並べ替え）
- `?view=history`: ゲーム履歴（過去クイズの結果・参加者一覧）
- `?view=participants`: 参加者ギャラリー（自撮り一覧・個別/一括削除）
- `?view=questions`: 問題ライブラリ（テンプレート管理・過去問題一覧）
- プレビューボタン → `/host/:quizId/preview` へ遷移
- リハーサルボタン → `?rehearsal=true` で開始
- ロビーを開くボタン → `/host/:roomCode?key=...&quizId=...` へ遷移

---

### `/host/:quizId/preview`
**問題プレビュー画面**
- 参加者の回答画面と同じ見た目で問題を確認
- 正解の選択肢がハイライト表示
- 前へ/次へボタンで問題を切り替え
- Socket.io不要（REST APIのみ）

---

### `/host/:roomCode?key=HOST_SECRET&quizId=QUIZ_ID`
**ホスト操作画面**（Socket.io `openRoom` で自動接続）

| フェーズ | 表示内容 | 操作 |
|----------|----------|------|
| lobby | QRコード + ルームコード + 参加者一覧 | ゲーム開始ボタン |
| countdown | 5秒カウントダウン | （自動進行） |
| question | 問題文・選択肢・カウントダウン・回答数 | 回答を締め切るボタン |
| results | 回答分布グラフ・正解表示 | ランキング表示 / 次の問題 |
| ranking | Top10 スコアバーアニメーション | 次の問題 / 最終結果発表 |
| final | カウントダウン発表 → 集合写真（浮遊アバター） | もう一度プレイ / ゲーム終了 |
| closed | サンキュースクリーン（浮遊アバター） | 管理画面に戻る |
| recovering | ホスト復旧画面（ゲーム中に再接続時） | 次の問題を配信 / ランキング表示 |

> `host_secret` は sessionStorage に保存（URLには露出しない）
> `quizId` パラメータ = クイズID
> `?rehearsal=true` でリハーサルモード（黄色バナー表示、最終問題後に自動リプレイ）

**BGM**: フェーズに応じて `public/audio/` のMP3を自動切替（lobby/question/results）
右下のスピーカーアイコンから音量・ミュート制御可能（設定はlocalStorageに永続化）

---

### `/host/:roomCode/screen`
**プロジェクター専用表示画面**（読み取り専用）
- Socket.io `watchRoom` で参加（操作ボタンなし）
- ホスト操作画面と完全同期（BGM・効果音も再生）
- ゲーム開始後にアクセスしても既存参加者を表示
- URL例: `http://localhost:5174/host/ABCDEF/screen`

---

## 参加者（スマホ）

### `/play`
**ルームコード入力画面**
- 4桁数字のルームコードを入力して参加

---

### `/play/:roomCode`
**参加フロー**（内部でフェーズ管理）

| フェーズ | 表示内容 |
|----------|----------|
| profile | ニックネーム入力 + チーム選択（チーム戦時） + 自撮り撮影（任意） |
| waiting | 待機画面（ルームコード表示） |
| answer | 4色ボタンで回答（制限時間カウントダウン・回答数表示） |
| result | 正解/不正解 + 正解テキスト + 獲得ポイント + 現在順位 |
| ranking | 自分の順位（大表示）+ 上位5名ミニランキング |
| final | 自分の最終順位 + 正答数 + 平均回答速度 |
| closed | サンキュースクリーン（浮遊アバター） |

> `localStorage` に `quiz_token_{roomCode}` を保存して再接続に対応

---

## API エンドポイント（バックエンド）

### クイズ管理

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/quizzes` | クイズ一覧（問題数・参加者数サマリー付き） |
| POST | `/api/quizzes` | クイズ作成 |
| GET | `/api/quizzes/:id` | クイズ詳細（問題含む） |
| PUT | `/api/quizzes/:id` | クイズタイトル更新 |
| DELETE | `/api/quizzes/:id` | クイズ削除（cascade） |

### 問題管理

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/questions` | 問題追加 |
| PUT | `/api/questions/:id` | 問題更新 |
| PUT | `/api/questions/reorder` | 問題並べ替え |
| DELETE | `/api/questions/:id` | 問題削除 |

### 問題バンク

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/question-bank` | テンプレート一覧 |
| POST | `/api/question-bank` | テンプレート追加 |
| PUT | `/api/question-bank/:id` | テンプレート更新 |
| DELETE | `/api/question-bank/:id` | テンプレート削除 |
| POST | `/api/question-bank/import` | クイズへインポート |

### メディア

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/media/upload` | 画像アップロード（JPG/PNG/GIF/WebP、最大5MB、IP単位レート制限あり） |
| POST | `/api/media/selfie` | 自撮りアップロード（base64） |
| GET | `/api/media/:filename` | メディア配信（パストラバーサル対策済み） |

### チーム管理

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/quizzes/room/:roomCode/info` | ルーム情報（teamMode, teams）— 参加者がチーム選択用に取得 |
| PUT | `/api/quizzes/:id/team-mode` | チームモード ON/OFF 切替 (`{ enabled: boolean }`) |
| GET | `/api/quizzes/:id/teams` | チーム一覧（order_index順） |
| PUT | `/api/quizzes/:id/teams` | チーム一括設定 (`{ teams: [{ name }] }`, 2〜10件、既存は削除して再作成) |
| DELETE | `/api/quizzes/:id/teams/:teamId` | チーム個別削除 |

### 参加者

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/quizzes/:id/participants` | 参加者一覧 |
| DELETE | `/api/quizzes/:id/participants/:participantId` | 参加者個別削除 |
| DELETE | `/api/quizzes/:id/participants` | 参加者一括削除 |

### ヘルスチェック

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/health` | サーバー稼働確認 |

---

## Socket.io イベント

### Client → Server

| イベント | 送信者 | 説明 |
|----------|--------|------|
| `openRoom` | ホスト | ルーム開設（`quizId`, `hostSecret`） |
| `startGame` | ホスト | ゲーム開始（5秒カウントダウン後に最初の問題を自動配信） |
| `nextQuestion` | ホスト | 次の問題を配信 |
| `closeQuestion` | ホスト | 回答を手動締め切り |
| `showRanking` | ホスト | ランキング計算・配信 |
| `endGame` | ホスト | ゲーム終了・最終結果配信 |
| `replayQuiz` | ホスト | ゲームリプレイ（finished → lobby リセット） |
| `closeGame` | ホスト | ゲーム完全終了（サンキュースクリーン表示） |
| `watchRoom` | プロジェクター | 読み取り専用参加（既存参加者も取得） |
| `joinRoom` | 参加者 | ニックネーム・自撮りで参加（同名重複は拒否、チーム戦時は `teamId` 指定可） |
| `submitAnswer` | 参加者 | 回答送信（`questionId`, `choiceIndex: 1-4`） |

### Server → Client

| イベント | 受信者 | 説明 |
|----------|--------|------|
| `lobbyUpdate` | 全員 | 参加者リスト更新（チーム戦時は `teams` 配列を含む） |
| `participantJoined` | 全員 | 新規参加者通知 |
| `gameStarted` | 全員 | ゲーム開始通知 |
| `questionStarted` | 全員 | 問題データ配信 |
| `timeUpdate` | 全員 | 残り秒数（毎秒、クランプ済み） |
| `answerCountUpdate` | 全員 | 現在の回答数 |
| `questionClosed` | 全員 | 回答締め切り |
| `questionResult` | 全員 | 正解・分布（参加者は個人結果 + 正解テキスト含む） |
| `rankingUpdate` | 全員 | ランキングデータ（参加者は自分の順位 + Top5、チーム戦時は `teamRankings` を含む） |
| `gameEnded` | 全員 | 最終結果データ（チーム戦時は `teamRankings` を含む） |
| `quizReset` | 全員 | リプレイ時のゲームリセット通知 |
| `gameClosed` | 全員 | ゲーム終了通知（サンキュースクリーン表示） |
| `reconnected` | 参加者 | 再接続時のステータス通知 |
| `hostReconnected` | ホスト | ホスト復旧時の状態復元（quizStatus, currentQuestionIndex, participants, currentQuestionData, answerCount, timerRemaining） |

---

## 環境変数

### フロントエンド

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `VITE_API_URL` | バックエンドURL | 未設定時は同一オリジン |

### バックエンド

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `PORT` | サーバーポート | 3001 |
| `CORS_ORIGIN` | 許可オリジン（カンマ区切り） | localhost各ポート |
| `NODE_ENV` | 実行環境 | development |

---

*最終更新: 2026-02-27*
