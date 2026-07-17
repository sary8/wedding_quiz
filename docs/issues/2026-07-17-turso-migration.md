# 2026-07-17 DBをTurso（ホスト型libSQL）対応にする

## 背景 / 目的
Azure（Static Web Apps + App Service B1）への本番デプロイにあたり、SQLiteローカルファイルには以下の問題がある:

1. **App Service の `/home` は Azure Files (CIFS/SMB) マウント**であり、SQLite WAL モードが必要とする
   共有メモリ（mmap）が動作しない。`./data`（= `/home/site/wwwroot/data`）に置いたままでは
   起動時の `PRAGMA journal_mode = WAL` が disk I/O error になるか、破損のリスクがある
2. Render 無料枠等のエフェメラルディスクでは再起動のたびにデータが消える（docs/deployment-trial.md の既知の制約）
3. バックアップが手動 `cp` 頼み

コードは既に `@libsql/client` + `drizzle-orm/libsql` を使用しているため、そのホスト型サービスである
Turso への切替は接続設定の変更のみで済む。deployment.md でも水平スケール時の移行先として名指し済み。

## 確定要件（ユーザー回答）
- DBはTursoに移行する（Cosmos DBはRUスロットリング・NoSQL全書き換えのため見送り、PostgreSQLはテスト基盤の作り直しが重いため見送り）
- ローカル開発・テストは従来どおり（ローカルファイル / `:memory:`）で動くこと

## Turso固有の技術的制約（context7でドキュメント裏取り済み）
1. **`PRAGMA journal_mode` / `busy_timeout` はTurso Cloudで非サポート**（サーバー側が並行性・ジャーナルを管理）
   → `file:` URLのときだけ実行するよう分岐する
2. **`PRAGMA foreign_keys` はサポートされるがデフォルトOFF、かつセッション（接続）単位**。
   リモート接続は再接続・多重化でセッションが入れ替わり得るため、起動時に1回実行する方式では
   FKカスケード削除の効きを保証できない
   → **FKカスケードに依存している削除処理を明示的な削除に置き換える**（接続形態に関係なく確実）
3. マイグレーションSQL（0001/0002/0005/0007）内の `PRAGMA foreign_keys=OFF/ON` はTursoサポート範囲内で、
   drizzle-kit の `dialect: "turso"` でそのまま適用可能

## FKカスケード依存箇所の調査結果
- `quizService.deleteQuizCompletely()`: `quizzes` の行削除のみ → questions/teams/participants/answers を
  カスケードに依存（**cleanupServiceから10分ごとに呼ばれる最重要パス**）→ 明示削除に置換
- `routes/question.ts` 問題削除: answers をカスケードに依存 → 明示削除に置換
- `routes/quiz.ts` チーム個別削除: participants.team_id の SET NULL に依存 → 明示的に null 更新
- その他の削除パス（参加者削除系・チーム一括再作成）は既に明示削除済みで変更不要

## 変更方針
### バックエンド（src/backend）
- `src/db/config.ts`（新規）: `DATABASE_URL` / `DATABASE_AUTH_TOKEN` 環境変数から接続設定を解決する純粋関数。
  未設定時は従来どおり `file:./data/wedding_quiz.db`
- `src/db/index.ts`: config経由で接続。`journal_mode`/`busy_timeout` は `file:` 時のみ実行
- `drizzle.config.ts`: `DATABASE_URL` が `file:` なら dialect "sqlite"、それ以外は "turso"（authToken対応）
- `src/index.ts`: production でローカルファイルDBのままの場合に警告ログ（既存のADMIN_PIN等の警告と同様のfail-open警告）
- 削除処理3箇所を `db.batch()`（暗黙トランザクション＝アトミック）による明示削除に置換

### デプロイ関連
- `render.yaml`: `DATABASE_URL` / `DATABASE_AUTH_TOKEN` を追加（sync: false）
- `docs/deployment.md`: Turso前提に更新（セットアップ手順・環境変数・バックアップ・WAL/CIFS注意の解消）
- `docs/deployment-trial.md`: Turso設定すればDBが永続化する旨に更新

## テスト
- `__tests__/db/config.test.ts`（新規）: resolveDbConfig / isFileUrl / localDataDir
- `quizService.test.ts`: `PRAGMA foreign_keys = OFF` の状態で deleteQuizCompletely を実行し、
  全テーブルに孤児が残らないことを検証（リモートDBでFKセッションが失われた最悪ケースの再現）

## 検証
- `src/backend` の vitest / build が通ること
- 手動: ローカル起動（従来のfile DB）でクイズ作成→削除が動くこと
