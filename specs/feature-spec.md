# Wedding Quiz App 機能仕様書

> バージョン: 1.0.0
> 最終更新: 2026-02-21
> ステータス: 確定

---

## 概要

結婚式の二次会用 Kahoot! 形式リアルタイムクイズアプリ。
ホスト（PC/プロジェクター）から問題を出し、参加者約100人がスマホから回答する。

---

## F001: クイズ管理

### 概要
ホストがクイズの作成・編集・削除・問題管理を行う。

### 受入基準
- [ ] クイズの新規作成（タイトル入力）
- [ ] クイズタイトルの編集（インライン編集）
- [ ] クイズの削除（cascade で問題・参加者・回答も削除）
- [ ] 問題の追加（問題文・選択肢4択・正解番号・制限時間5-120秒・画像任意）
- [ ] 問題の編集（全フィールド更新可能）
- [ ] 問題の削除
- [ ] 問題の並べ替え（D&D + ↑↓ボタン）
- [ ] 問題文: 最大500文字、選択肢: 最大200文字
- [ ] 画像: JPG/PNG/GIF/WebP、最大5MB、magic byte検証
- [ ] mediaType: "image" のみ（動画UIは実装しない）

### UI
- SetupPage ダッシュボードハブ（作成・一覧・履歴・ギャラリー・ライブラリ）
- QuestionManagementTab（@dnd-kit D&D + 手動↑↓ボタン）

---

## F002: 問題バンク/テンプレート

### 概要
再利用可能な問題テンプレートを管理し、クイズにインポートする。

### 受入基準
- [ ] テンプレート問題のCRUD（追加・編集・削除）
- [ ] テンプレートからクイズへの一括インポート
- [ ] 過去クイズの問題をライブラリとして閲覧
- [ ] QuestionLibraryView で統合表示

### API
- `GET /api/question-bank` — テンプレート一覧
- `POST /api/question-bank` — テンプレート追加
- `PUT /api/question-bank/:id` — テンプレート更新
- `DELETE /api/question-bank/:id` — テンプレート削除
- `POST /api/question-bank/import` — クイズへインポート

---

## F003: ロビー・参加者受付

### 概要
ルームを開設し、参加者がQRコード/ルームコードで参加する。

### 受入基準
- [ ] 6桁数字のルームコード自動生成
- [ ] QRコード表示（参加URL埋め込み）
- [ ] 参加者のニックネーム入力（最大30文字、同一クイズ内重複不可）
- [ ] 任意の自撮り撮影（WebRTC + base64キャプチャ）
- [ ] 自撮りフレーム選択（固定セット、カスタマイズ不要）
- [ ] リアルタイム参加者一覧表示
- [ ] ホスト画面にプロジェクターURL表示

### Socket.io
- `openRoom` — ルーム開設
- `joinRoom` — 参加（ニックネーム重複チェック、トークン発行）
- `participantJoined` — 新規参加通知
- `lobbyUpdate` — 参加者リスト更新

---

## F004: ゲーム進行

### 概要
ホストが問題を配信し、参加者がリアルタイムで回答する。

### ゲームフロー
```
lobby → countdown(5秒) → question → results → ranking → [次の問題 or 最終発表]
                                                              ↓
                                                     final → group → closed
```

### 受入基準
- [ ] 5秒カウントダウン後に最初の問題を自動配信
- [ ] サーバーサイドタイマー（hrtime高精度、クライアント改ざん不可）
- [ ] 4色回答ボタン（赤・青・緑・黄）
- [ ] 回答二重送信防止（UNIQUE制約 question_id + participant_id）
- [ ] 手動締め切り or タイマー自動締め切り
- [ ] 回答分布バーチャート（結果フェーズ）
- [ ] 参加者に正解テキスト表示
- [ ] ライブ回答数表示（参加者画面にも）
- [ ] タイマー値クランプ（Math.max(0, remaining)）

### スコアリング
- 正解: 500〜1000点（速度ボーナス、早いほど高得点）
- 不正解: 0点
- 計算式: `baseScore * (1 - responseTime / timeLimit * 0.5)`

### Socket.io
- `startGame` → `gameStarted`
- `nextQuestion` → `questionStarted`
- `timeUpdate` — 毎秒残り時間
- `answerCountUpdate` — リアルタイム回答数
- `submitAnswer` — 回答送信
- `closeQuestion` → `questionClosed` → `questionResult`

---

## F005: ランキング

### 概要
問題ごとにTop10ランキングを表示し、順位変動を可視化。

### 受入基準
- [ ] Top10 スコアバーアニメーション（Framer Motion）
- [ ] 順位変動インジケーター（↑/↓）
- [ ] 参加者スマホに自分の順位 + Top5ミニランキング表示
- [ ] 自撮りアバター表示

### Socket.io
- `showRanking` → `rankingUpdate`

---

## F006: 最終結果発表

### 概要
オールスター感謝祭式のカウントダウン発表 + Top3スポットライト。

### フロー
```
scroll（10位→4位スクロール） → top3（3位→2位→1位スポットライト）
→ done（ボタン表示） → group（集合写真・浮遊アバター）
```

### 受入基準
- [ ] 10位から4位まで速度を変えてスクロール表示
- [ ] Top3 個別スポットライト（メダル背景色、紙吹雪）
- [ ] 一時停止ボタン（ホストのみ）
- [ ] 集合写真フェーズ: 浮遊アバターアニメーション（スクリーンセーバー風）
- [ ] prefers-reduced-motion時は静的グリッド表示
- [ ] 参加者スマホに最終順位・正答率・平均回答速度

### Socket.io
- `endGame` → `gameEnded`

---

## F007: ゲーム終了・サンキュースクリーン

### 概要
ゲームを閉じ、全参加者にサンキュースクリーンを表示。

### 受入基準
- [ ] 「ゲーム終了」ボタンで全参加者にサンキュースクリーン配信
- [ ] 浮遊アバターアニメーション（seeded random位置・速度）
- [ ] 「ご参加ありがとうございました！」メッセージ
- [ ] ホストに「管理画面に戻る」ボタン

### Socket.io
- `closeGame` → `gameClosed`

---

## F008: リプレイ

### 概要
ゲーム終了後にスコアをリセットしてロビーに戻る。

### 受入基準
- [ ] 「もう一度プレイ」ボタン
- [ ] スコア・回答データリセット（ニックネーム・自撮りは維持）
- [ ] 全参加者がロビーに戻る

### Socket.io
- `replayQuiz` → `quizReset`

---

## F009: プロジェクター表示

### 概要
操作ボタンなしの読み取り専用表示画面。

### 受入基準
- [ ] `/host/:roomCode/screen` で表示
- [ ] ホスト操作画面と完全同期（watchRoom）
- [ ] 途中参加でも現在の状態を取得
- [ ] 操作ボタン非表示

### Socket.io
- `watchRoom` — 読み取り専用参加

---

## F010: 再接続

### 概要
ホスト・参加者のブラウザ切断からの復帰。

### 受入基準
- [ ] 参加者: localStorage トークンで自動再接続
- [ ] ホスト: hostReconnected イベントで状態復元
  - currentQuestionData, answerCount, timerRemaining を含む
  - 出題中/結果待ちフェーズを正しく復元
- [ ] プロジェクター: watchRoom再接続で現在の状態を取得

### Socket.io
- `reconnected` — 参加者再接続
- `hostReconnected` — ホスト再接続（拡張ペイロード）

---

## F011: BGMシステム

### 概要
ホスト/プロジェクター画面でフェーズ別BGMを再生。

### 受入基準
- [ ] 3トラック: lobby.mp3, question.mp3, results.mp3
- [ ] `public/audio/` にユーザーが任意のMP3を配置する方式
- [ ] フェーズ変更時に自動切替
- [ ] 音量スライダー + ミュートトグル（右下フローティングパネル）
- [ ] localStorage で音量・ミュート状態を永続化
- [ ] 1000msフェードアウトトランジション
- [ ] MP3未配置時にエラーなし（graceful fallback）
- [ ] 参加者スマホではBGMなし

---

## F012: 効果音

### 概要
Web Audio API で合成した効果音をホスト/プロジェクターで再生。

### 受入基準
- [ ] 8種類: 参加チャイム、出題、カウントダウン、ブザー、結果発表、ランキング、ドラムロール、ファンファーレ（ランク別）
- [ ] 外部ファイル不要（合成音）
- [ ] 参加者スマホでは無音
- [ ] ブラウザオーディオポリシー対応（初回操作後に有効化）

---

## F013: プレビューページ

### 概要
ホストが問題を参加者視点でプレビュー確認。

### 受入基準
- [ ] `/host/:quizId/preview` でアクセス
- [ ] 参加者の回答画面と同じ見た目でレンダリング
- [ ] 正解の選択肢をハイライト表示
- [ ] 前へ/次へボタンで問題を切り替え
- [ ] Socket.io不要（REST APIのみ）

---

## F014: リハーサルモード

### 概要
本番前にゲーム全体の動作を確認するモード。

### 受入基準
- [ ] `?rehearsal=true` クエリパラメータで有効化
- [ ] 黄色バナー「リハーサルモード」表示
- [ ] 最終問題後に5秒待って自動リプレイ
- [ ] SetupPageに「リハーサル」ボタン

---

## F015: 参加者管理

### 概要
ホストが参加者を閲覧・削除する。

### 受入基準
- [ ] ParticipantGalleryView で全参加者を閲覧
- [ ] 個別削除・一括削除（チェックボックス選択）
- [ ] 2段階確認UI
- [ ] クイズごとにグループ化

### API
- `DELETE /api/quizzes/:id/participants/:participantId`
- `DELETE /api/quizzes/:id/participants` (一括)

---

## F016: ゲーム履歴

### 概要
過去のゲーム結果を閲覧する。

### 受入基準
- [ ] GameHistoryView で完了済みクイズを一覧表示
- [ ] アコーディオン展開で参加者・結果を確認
- [ ] SetupPage ダッシュボードからアクセス

---

## 非機能要件

### パフォーマンス
- 最大チャンク: 250KB以下（manualChunks + lazy load）
- ルートレベル遅延読み込み（Suspense + lazy）
- db.batch() でN+1回避

### アクセシビリティ
- prefers-reduced-motion 対応
- 44px最小タッチターゲット
- WCAG AA コントラスト比
- aria-label / aria-pressed / aria-live
- セマンティックHTML
- touch-action: manipulation
- overscroll-behavior: contain

### セキュリティ（決定事項）
- watchRoom認証: なし（会場LAN前提）
- レート制限: なし（二重送信防止のみ）
- host_secret: Socket.ioゲーム操作にのみ使用（REST APIは認証なし）
- ファイルクリーンアップ: 手動対応
- データ保持: 手動管理（cascade削除のみ）

### インフラ
- Azure Static Web Apps（Frontend） + Azure App Service B1 Linux（Backend）
- CORS: `CORS_ORIGIN` 環境変数でカンマ区切り指定
- Socket.io: `VITE_API_URL` 環境変数で接続先指定
- CI/CD: GitHub Actions で自動ビルド・デプロイ（**構築予定**）

### 運用制約（決定事項）
- 同時ゲーム: 1ゲームのみ
- 動画問題: 実装しない（画像のみ）
- 自撮りフレーム: 固定セット（カスタマイズなし）
- クイズインポート/エクスポート: 不要
