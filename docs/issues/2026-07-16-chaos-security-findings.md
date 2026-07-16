# カオスエンジニアリング + セキュリティ診断結果（2026-07-16）

volt系サブエージェント2体（`security-auditor` / `chaos-engineer`, いずれも fable）による診断結果を、全件コードで裏取りした記録。

- 対象コミット: `342118f`（main）
- 診断範囲: backend（Hono + Socket.io + libsql/SQLite）/ frontend（Vite + React SPA）
- 運用前提: 結婚式二次会の一発勝負・会場Wi-Fi不安定・数十〜100+台同時接続・やり直し不可

## サマリ

| 深刻度 | 件数 |
|---|---|
| Critical | 4 |
| High | 4 |
| Medium | 6 |
| Low | 8 |

**最重要の「出題中の正解漏洩」は設計上防止されている**（`QuestionData` 型に正解フィールドが存在せず、正解は締切後の `QuestionResultData` にのみ含まれる。`submitAnswer` のACKも `{success}` のみ）。

---

## Critical

### C-1. 参加者の瞬断復帰でルーム再joinされず、以後回答不能・ブロードキャスト受信不能
- 該当: `src/frontend/src/pages/participant/PlayPage.tsx:69-154`（socket登録effectが `[on]` 依存で `isConnected` 変化を監視しない）
- 対照: `src/frontend/src/pages/host/HostPage.tsx:198-206` は `isConnected` 変化で `openRoom`/`watchRoom` を再送している（参加者側だけ欠落）
- シナリオ: スマホ瞬断→自動再接続で新 `socket.id` 発行→サーバー `socketMeta`（`quizHandler.ts:16`）が空→`submitAnswer` が `quizHandler.ts:322-327` で「セッションが見つかりません」。バナーは消えるので本人は復旧と誤認
- 影響: 瞬断した参加者（会場Wi-Fi前提で多発しうる）
- 対策: PlayPage に「参加済み かつ `isConnected` 復帰時に sessionStorage token で `joinRoom` を自動再送」する effect を追加
- **状態: 本ブランチ `fix/chaos-security-c1-c2` で対応**

### C-2. ホスト操作がACKロスト1回で全ボタン無反応に凍結
- 該当: `src/frontend/src/hooks/useSocket.ts:169-200`（`emitWithTimeout` 定義済みだが呼び出し箇所ゼロ）/ `src/frontend/src/pages/host/HostPage.tsx:209-312`（全アクションが素の `emit` + ACKコールバック内でのみ `setIsProcessing(false)`）
- シナリオ: Socket.io は `.timeout()` を使わないと接続断でACKコールバックが呼ばれない。ACKロストで `isProcessing` が `true` のまま固定→全操作ボタンが `if (!roomCode || isProcessing) return` で無反応。`isConnected` 回復と連動して解除されない
- 影響: 全体（司会者が進行不能）
- 対策: `emitWithTimeout` を全ホスト操作と参加者 `submitAnswer` に配線。タイムアウト時に `isProcessing` 解除 + エラー表示
- **状態: 本ブランチ `fix/chaos-security-c1-c2` で対応**

### C-3. プロセス再起動で出題中の1問が結果配信されずスキップ
- 該当: `src/backend/src/services/quizService.ts:202-235`（`getNextQuestion` は常に `current_question_index + 1`）/ `src/backend/src/socket/quizHandler.ts:19`（`activeQuestions` は in-memory）/ `src/frontend/src/pages/host/HostPage.tsx:456-489`（recovering画面は復元せず次へ進める）
- シナリオ: 「出題中の問題ID・タイマー残り」はDB非永続。再起動後 `recovering` で「次の問題を配信」→ 中断問題を飛ばして次へ、結果は誰にも表示されず警告も出ない。Render無料枠はエフェメラルディスクのため再起動でDBごと全消失（`render.yaml:5-7`）
- 影響: 全体（該当1問の結果発表が消滅、または全消失）
- 対策: `quizzes` に `active_question_started_at` を持たせてDB永続化し、再起動時に中断問題を残り時間で復元（タイマー再構築＋出題継続、残り時間切れは結果配信）
- **状態: 本ブランチ `fix/chaos-security-c1-c2` で対応（0009マイグレーション＋openRoom復元）**

### C-4. タイマー経路が例外に無防備 + グローバル例外ハンドラ皆無
- 該当: `src/backend/src/services/timerService.ts:29-39`（`setInterval` コールバックに try/catch なし）/ `:35`（`onEnd()` を `.catch()` せず呼ぶ）/ `src/backend/src/socket/quizHandler.ts:564-565`（`activeQuestions.delete`・`emit("questionClosed")` が try/catch 外）/ `src/backend/src/index.ts`（`process.on('uncaughtException'|'unhandledRejection')` が皆無）
- シナリオ: 毎秒走る tick/onEnd のどこか1回の未捕捉例外でプロセス即死 → C-3 の状態消失が全roomに同時発生
- 影響: 全体
- 対策（根本）: `setInterval` コールバックと `onEnd()` を try/catch/.catch で保護。（安全網）`index.ts` に `uncaughtException`/`unhandledRejection` ハンドラを追加しログ+継続
- **状態: 本ブランチ `fix/chaos-security-c1-c2` で対応（timerService の try/catch ＋ uncaughtException/unhandledRejection ハンドラ）**

---

## High

### H-1. X-Forwarded-For 偽装でレート制限バイパス → ADMIN_PIN 総当たり
- 該当: `src/backend/src/utils/clientIp.ts:9-11,26-28`（XFF最左端=詐称可能値を採用）/ `src/backend/src/routes/auth.ts:12-22`（認証レート制限はIP単位5回/分のみ）/ `render.yaml:26`（`TRUSTED_PROXY=true`）
- シナリオ: XFFを付け替えるたびに別IP扱い→5回/分の上限が無効化。ADMIN_PINに複雑性要件がなく弱PINなら総当たり成立 → host_secret入手 → 進行乗っ取り・PII取得・全削除
- 補足: 射程は「お試しRender構成 かつ ADMIN_PIN が弱い」場合。本番Azureでも `TRUSTED_PROXY=true` なら同ロジック欠陥は残る
- 対策: 信頼プロキシ段数を固定しXFF右端からN番目を採用 / 認証にグローバル上限・指数バックオフ・一時ロックアウト / ADMIN_PIN最小長・文字種要件
- **状態: 未対応（Plan で計画）**

### H-2. SQLite書き込み輻輳対策（WAL/busy_timeout）が実装に存在しない
- 該当: `src/backend/src/db/index.ts`（PRAGMAは `foreign_keys = ON` のみ）/ `docs/deployment.md:168`（「WALモード有効化」と記載され食い違い）
- シナリオ: 締切間際100人一斉回答で `db.batch`（`quizService.ts:258-274`）が同時多発 → `SQLITE_BUSY` → 回答ロスト
- 対策: `PRAGMA journal_mode = WAL` + `PRAGMA busy_timeout = 5000` を明示設定し実機で戻り値確認
- **状態: 未対応（Plan で計画）**

### H-3. 水平スケールでsplit-brain（デプロイ文書が危険な推奨）
- 該当: `docs/deployment.md:192-195`（「インスタンス2-10台」推奨）/ `src/backend/src/index.ts:146-151`（Socket.ioアダプタなし）/ `src/backend/src/db/index.ts:6`（ローカル単一DBファイル）
- シナリオ: 本番中にインスタンス増設 → Socket.ioルームがプロセスローカル・DBがインスタンス別で参加者分裂・スコア不整合
- 対策: 文書の推奨を強い警告に置換。「当日はインスタンス数を1から変えない」をチェックリスト化。スケールにはRedisアダプタ+共有DBが前提
- **状態: 未対応（Plan で計画）**

### H-4. 再接続試行枯渇後にUIが「再接続中…」を表示し続ける
- 該当: `src/frontend/src/hooks/useSocket.ts:136`（`reconnectionAttempts: 10`）/ `reconnect_failed` リスナー不在
- シナリオ: 10回失敗（約30-45秒）後もバナー表示が残り、手動リロードに気づけない
- 対策: `socket.on("reconnect_failed")` を追加し「再読み込みしてください」に切替
- **状態: 未対応（Plan で計画）**

---

## Medium

- **M-1. 無認証 watchRoom + 6桁コード列挙で参加者PII（氏名・顔写真）収集**: `quizHandler.ts:792-859` / `quizService.ts:150-175`（`getLobbyParticipants` が selfieUrl/nickname を返す）/ `routes/quiz.ts:285-307`（`room/:code/info` レート制限なし）。対策: room監視系に厳格なレート制限、視聴用トークン導入。状態: 未対応
- **M-2. `nextQuestion` の二重押しガードが認証前副作用 → 進行妨害DoS**: `quizHandler.ts:526`（`advancingRooms.add` が `:528` の認証より前）。roomCodeを知る参加者が連打で正規ホストを弾ける。対策: 認証成功後に `add`。状態: 未対応
- **M-3. Socketホスト系・submitAnswer がレート制限なし**: `quizHandler.ts`（`checkSocketRateLimit` は join/watch のみ）。対策: 全イベントに per-socket/IP制限。状態: 未対応
- **M-4. 自動締切後のホスト早押しで前問結果が新問題に割り込む**: `HostPage.tsx:112-120`（`questionResult` を無条件に `setPhase("results")`）。対策: questionId/phase一致時のみ反映。状態: 未対応
- **M-5. 問題バンクAPIが進行中クイズの編集・削除・並べ替えを許可**: `routes/question.ts:39-111,225-316,319-339`（status未チェック、`answers` は cascade削除）。対策: `in_progress` は423拒否。状態: 未対応
- **M-6. watchRoom のNATレート制限が20回で不足**: `quizHandler.ts:795`（デフォルト20/分）。ホスト+プロジェクターが同一NAT IPで自滅。対策: join同様に緩和。状態: 未対応

## Low

- **L-1. selfieファイル名がクライアント制御・無検証保存 → アバター詐称**: `quizHandler.ts:226` / `quizService.ts:127-134`（`SAFE_FILENAME_RE` 未適用）
- **L-2. 終盤ブラックアウト中も順位・スコアをサーバー送信**: `quizService.ts:357-364,423-430`（`hideRanking=true` でも `currentRank`/`totalScore` 送信、devtoolsで先読み可）
- **L-3. `NODE_ENV`≠production 環境で空PIN管理API全開放**: `authService.ts:77-85`（自前ホスティングでNODE_ENV設定漏れ時）
- **L-4. CSP未設定**: `index.ts:30`（`secureHeaders()` にCSP指定なし、多層防御欠如）
- **L-5. `safeCompare` がマルチバイト入力で例外 → 500**: `utils/safeCompare.ts:5`（UTF-16長一致でもバイト長不一致で `timingSafeEqual` が RangeError）
- **L-6. サーバーの `error` ソケットイベントを誰も購読していない**: `quizHandler.ts:428` の警告emitがフロントに届かない（`on("error")` が0件）
- **L-7. in-memory Map がクイズ削除と非連動**: `quizHandler.ts:19,22,28-29,62`（`cleanupService.deleteQuizCompletely` が触れず、長期運用で緩やかにリーク）
- **L-8. `submitAnswer` にレート制限なし**: `quizHandler.ts:320-408`（実害は小、DBラウンドトリップ濫用の余地）

---

## よく出来ている点（安心材料）

- **正解漏洩なし**: `QuestionData`（`types/index.ts:163-177`）に正解フィールドなし。`buildQuestionData`（`quizService.ts:823-838`）も選択肢のみ。正解は締切後の `QuestionResultData` に限定
- **セッショントークン**: `nanoid(32)`（CSPRNG）+ TTL24h/アイドル4h + サーバー保持（`authService.ts`）
- **host_secret/PIN**: 定数時間 `safeCompare` を実使用、レスポンスから除外
- **Socket認可**: 全ホスト操作が `verifyHostSecret`、参加者は `socketMeta` で participantId 詐称不可
- **XSS/SQLi なし**: `dangerouslySetInnerHTML` ゼロ、drizzle パラメータ化、`sanitizeMediaUrl` 適用、CSV数式インジェクション対策済み
- **メディア**: サイズ上限 + マジックバイト検証 + クォータ + パストラバーサル対策（`media.ts`）
- **CORS**: 本番 fail-closed + 明示オリジン + Cookie不使用
- **二重回答**: DBユニーク制約 + `getNextQuestion` 楽観ロック + サーバー基準スコア

---

## 修正計画

- 本ブランチ `fix/chaos-security-c1-c2` で **Critical 4件すべて対応済み**:
  - C-1: 参加者の自動再join（PlayPage）
  - C-2: emitWithTimeout の全面配線（HostPage / PlayPage）
  - C-3: `active_question_started_at` 永続化 ＋ openRoom での中断問題復元（タイマー起動を `startQuestionTimer` に共通化）
  - C-4: timerService の try/catch ＋ `uncaughtException`/`unhandledRejection` ハンドラ
- 残り（H-1〜H-4, M-1〜M-6, L-1〜L-8）は未対応。本ファイルに記録済みで、別途対応する
