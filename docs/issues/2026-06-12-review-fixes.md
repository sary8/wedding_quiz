# 2026-06-12 統合レビュー指摘の修正

5観点（バックエンド品質 / セキュリティ / フロントエンド / テスト / Socket.ioリアルタイム設計）のマルチエージェントレビューで検出された問題の修正記録。

## Critical

### C-1. 本番DBで外部キー制約が無効（孤児レコード化）
- `src/backend/src/db/index.ts` で `PRAGMA foreign_keys` を発行していない。libsql/SQLiteは接続ごとにデフォルトOFF。
- `deleteQuizCompletely` は `onDelete: "cascade"` に依存しており、FK無効下では quizzes だけ削除され questions/participants/teams/answers が孤児化する。
- テスト用 `testDb.ts` だけ `PRAGMA foreign_keys = ON` のため、テストでは検出不能だった。
- 対応: クライアント生成直後に `PRAGMA foreign_keys = ON` を実行。

### C-2. マイグレーションがスキーマに未追従（本番クラッシュ）
- `schema.ts` の `quizzes.finished_at` 列、`participants_quiz_id_idx` / `participants_connection_id_idx` / `answers_participant_id_idx` が drizzle マイグレーション（0000〜0007）に存在しない。
- `drizzle-kit migrate` で構築した本番DBでは `openRoom` / `getFinalResult` / cleanupService が `no such column` で失敗する。
- 対応: `npm run db:generate` で 0008 を生成しコミット。

### C-3. タイマー消失時に回答スコアが全員1000点
- `quizHandler.ts` の `getElapsedMs(...) ?? 0` がタイマー不在時に経過0ms扱い → `calculateScore` が満点を付与。
- サーバー再起動・ホストのブラウザリロード（openRoom再発行ではタイマー再開されない）で発生。
- 対応: タイマー不在・残り時間0以下の回答は拒否。
- 判断: 再起動時の activeQuestions 復元は実装しない。残り時間が不明なため公平なタイマー再開は不可能であり、
  ガードによりスコア破損は防止済み。再起動後は出題中の問題が打ち切りになるが、ホストは「次の問題」で続行できる。

### C-4. getNextQuestion に楽観ロックがなく問題スキップの恐れ
- `current_question_index` のUPDATEが無条件のため、二重実行でインデックスが2進み問題が1つスキップされる。
- 対応: `WHERE current_question_index = :expected` の条件付きUPDATEに変更し、0行更新ならnullを返す。

## High

### H-1. 会場NATで21人目以降が参加不能
- `joinRoom` / `watchRoom` のSocketレート制限（20回/分）がIP単位。式場Wi-FiのNATで全員同一IPになると20人で枯渇。
- 対応: joinRoom系の上限を引き上げ、IP+イベント単位の制限は維持しつつNAT環境を許容する値に調整。

### H-2. TRUSTED_PROXY未設定でレート制限が共有バケット化
- `getClientIp` が `"unknown"` を返し全クライアントが同一キーで集計される。
- 対応: 本番起動時に未設定なら警告ログ（fail-fastはローカル運用も想定し警告に留める）。HTTP側にソケットリモートアドレスのフォールバック追加。

### H-3. DisplayPage（プロジェクター）が瞬断後に状態復元不能
- 再接続時 `watchRoom`（ロビー一覧のみ）しか発行せず、ゲーム進行状態が失われロビー表示で固まる。
- 対応: `watchRoom` レスポンスに quizStatus / currentQuestionData / timerRemaining を追加し、DisplayPage側で復元。

### H-4. useSocket の on() クリーンアップが再接続後に壊れる
- `off` 時に最新の `socketRef.current` を参照するため、再接続でインスタンスが変わると旧リスナー残留・新ソケット未登録になる。
- 対応: `on()` 呼び出し時のインスタンスをクロージャに捕捉。useSocketは単一ソケットを再利用しており再接続でインスタンスは変わらないが、防御的に修正。

### H-5. 時間切れ後の回答に500点が付く
- タイマー onEnd は1秒間隔のため最大約1秒のグレース窓があり、`calculateScore` の下限500点が適用される。
- 対応: C-3と同じガードで残り時間0以下を拒否。

### H-6. answerCountUpdate が回答ごとにDBクエリ＋全員ブロードキャスト
- 100人一斉回答で最大1万メッセージ＋クエリ洪水。ACKタイムアウト→「送信失敗」誤表示の恐れ。
- 対応: ルーム単位のインメモリカウンタ＋スロットリング配信。

## Medium

### M-1. DELETE /participants/me が機能していない
- ルート定義順により `/:id/participants/...` にシャドーイングされる疑い＋admin認証ミドルウェアに阻まれ参加者から401。
- プライバシーポリシーは「参加者は自身のデータを削除できる」と記載しており実装と乖離。
- 対応: ルートを先頭に移動し `isPublicRoute` に追加（本人性は X-Participant-Token で担保）。参加者画面に削除導線を追加。

### M-2. selfie アップロードのストレージ枯渇攻撃
- roomCode を知っていれば未認証で500MB上限まで書き込める。
- 対応: ルーム単位の保存枚数上限を追加。

### M-3. CSP の script-src 'unsafe-inline'
- Viteビルドはインラインスクリプトを生成しないため除去可能。
- 対応: staticwebapp.config.json から除去。

### M-4. reconnected ペイロードにタイマー残り時間・回答済みフラグがない
- 再接続した参加者のカウントダウンが0表示、回答ボタンが再有効化され混乱。
- 対応: `timerRemaining` / `hasAnswered` を追加しフロントで復元。

### M-5. FinalPage のネスト setTimeout がクリーンアップされない
- アンマウント後にフェーズ遷移・紙吹雪が発火し得る。
- 対応: タイマーIDをref集合で管理し、クリーンアップで全クリア。

### M-6. PlayPage resultTimeoutRef がアンマウント時にクリアされない
- 対応: アンマウント時クリーンアップ追加。joinRoom の手動タイムアウトも完了フラグで遅延コールバックを無視。

## テストギャップ

- quizHandler に submitAnswer / nextQuestion / closeQuestion / 再接続のテストが皆無 → ゲーム進行フローのSocket.ioテストを追加。
- backend vitest.config にカバレッジ閾値なし → 閾値追加。
