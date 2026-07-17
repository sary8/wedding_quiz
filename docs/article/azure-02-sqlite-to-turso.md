<!--
Qiita タグ案: Azure / AppService / SQLite / Turso / Drizzle
シリーズ第2回
-->

# SQLiteのままApp Serviceに載せてはいけない理由とTurso移行（結婚式クイズアプリをAzureに載せた話 2）

シリーズ第2回である。
第1回で書いた構成のうち、DBだけがAzureの外（Turso）にある。
今回はその理由と、移行で踏んだTurso固有の制約を書く。

移行前のアプリはローカルのSQLiteファイルで動いていた。
ライブラリは `@libsql/client` + Drizzle ORM、書き込みの並行性のために `PRAGMA journal_mode = WAL` を有効にしていた。
100人が締め切り間際に一斉回答する瞬間があるので、読み取りと書き込みが互いをブロックしないWALは外せない設定だった。

このままApp Serviceに置けるだろうと思っていた。
デプロイ手順を調べている途中で、置けないことがわかった。

## App Serviceの永続ディスクは、ローカルディスクではない

Linux App Serviceでアプリのファイルが置かれる `/home` は、見た目は普通のディレクトリだが、実体はAzure FilesをSMB（CIFS）でマウントしたネットワーク共有である。
通常のファイル読み書きは動く。
動かないのは、ローカルディスクを前提としたOSの機能である。

SQLiteのWALモードは、`-shm` という共有メモリファイルをmmapで複数接続に見せる仕組みで動いている。
mmapによる共有メモリはネットワークファイルシステム上では機能せず、SQLiteの公式ドキュメントもネットワークFS上でのWALを非対応と明言している。
つまりこのままデプロイすると、起動時の `PRAGMA journal_mode = WAL` がdisk I/Oエラーで落ちるか、悪ければ動いているように見えてDBが壊れる。

ローカル開発では本物のディスクなので、この問題は一切表面化しない。
デプロイして初めて踏む種類の地雷である。

## 移行先の比較

WALをやめて凌ぐ手もあったが、並行性の要件を落とすことになるので、DBを外部サービスに出す方針にした。
検討した選択肢は四つ。

| 選択肢 | 無料枠 | コード変更量 | 見送り理由 / 採用理由 |
|---|---|---|---|
| **Turso**（ホスト型libSQL） | 十分 | **ほぼゼロ** | 採用。すでに `@libsql/client` を使っており、接続先URLを変えるだけ |
| Azure Database for PostgreSQL | 新規アカウントは12ヶ月無料 | 中 | スキーマ定義の書き直しに加え、テストがインメモリSQLite前提のためテスト基盤の作り直しが必要 |
| Azure SQL Database（無料オファー） | 永続無料枠あり | 大 | Drizzle ORMがSQL Server方言に未対応で、クエリ層を全部書き直すことになる |
| Cosmos DB | 1,000 RU/s | 大 | 一斉回答の書き込みバーストがRU上限に当たる試算。JOIN前提のスキーマとNoSQLが合わない |

Tursoは「libSQL（SQLiteのフォーク）のホスティングサービス」で、クライアントライブラリが同じなのが決め手だった。
東京リージョンがあり、無料枠はこの規模（数千行）では使い切れない。
Azureで統一できない点は妥協である。

## 実装: 接続設定を環境変数に出す

変更の中心は、接続設定を環境変数から解決する層を1枚挟んだことである。

```ts
// DATABASE_URL 未設定ならローカルファイル（開発・テストは従来どおり）
const url = env.DATABASE_URL?.trim() || "file:./data/wedding_quiz.db";
const authToken = env.DATABASE_AUTH_TOKEN?.trim();
```

- ローカル開発・CI・テスト: 未設定のままローカルファイルとインメモリDBで動く
- 本番: `DATABASE_URL=libsql://xxx.turso.io` と認証トークンを設定する

drizzle-kit の設定も同じ規約で、URLが `file:` ならdialectを `sqlite`、リモートなら `turso` に切り替える。

## Turso固有の制約を3つ踏んだ

移行は「URLを変えるだけ」では終わらなかった。
リモートのlibSQLには、ローカルのSQLiteと同じに扱えない点がある。

**1. `journal_mode` と `busy_timeout` のPRAGMAが使えない。**
Turso Cloudではジャーナリングと並行性をサーバー側が管理しており、これらのPRAGMAは非サポートである。
起動時に無条件で実行していたので、`file:` URLのときだけ実行するよう分岐した。

**2. `PRAGMA foreign_keys = ON` はセッション単位でしか効かない。**
libSQLは接続ごとに外部キー制約がデフォルトOFFで、これはTursoでも同じである。
起動時に一度ONにする方式は、ローカルの単一接続なら十分だが、リモート接続は再接続や多重化でセッションが入れ替わることがあり、ONの状態が維持される保証がない。
このアプリはクイズ削除時の関連データ削除を `ON DELETE CASCADE` に依存していたので、保証がないのは受け入れられなかった。

対応として、カスケード依存だった削除を明示的な削除に書き換えた。

```ts
// FKカスケードに依存せず、依存順に明示削除する。
// db.batch は暗黙のトランザクションで、途中失敗時は全体がロールバックされる
await db.batch([
  db.delete(schema.answers).where(inArray(schema.answers.question_id, quizQuestionIds)),
  db.delete(schema.participants).where(eq(schema.participants.quiz_id, quizId)),
  db.delete(schema.teams).where(eq(schema.teams.quiz_id, quizId)),
  db.delete(schema.questions).where(eq(schema.questions.quiz_id, quizId)),
  db.delete(schema.quizzes).where(eq(schema.quizzes.id, quizId)),
]);
```

テストには「`PRAGMA foreign_keys = OFF` の状態で削除しても孤児レコードが残らない」ケースを足した。
FKが効かない最悪条件を再現するテストで、リモート接続の挙動をローカルで担保するための保険である。

**3. マイグレーションを実行する場所が変わる。**
それまでは起動コマンドで `npm run db:migrate && npm start` を実行していた。
この方式はApp Serviceでは動かない。
drizzle-kit はdevDependencyで、本番のnode_modulesに含めないからである。
マイグレーションはGitHub Actionsのデプロイジョブに移し、CIがTursoに適用してからデプロイする構成にした。
起動コマンドは `npm start` だけになり、起動も速くなった。

## トークンをチャットにもシェル履歴にも残さない

小さな運用の話だが、効果が大きかったので書いておく。
Tursoの認証トークンは `src/backend/.env`（gitignore済み）に置き、drizzle-kit の設定ファイルだけがdotenvで読む構成にした。

この構成には副作用として良い性質がある。
アプリ本体（ローカル開発サーバー）はdotenvを読まないので、手元で `npm run dev` しても本番のTursoに誤接続しない。
接続設定を雑に共通化していたら、ローカルのテストデータが本番DBに入る事故がいつか起きていたと思う。

なお、一度だけトークンをエディタの画面共有経由で露出させてしまい、その場でローテーションした。
Tursoのダッシュボードでトークンを再発行し、.env、GitHubのSecret、App Serviceの設定の3箇所を更新して終わりである。
露出したかどうか自信が持てない時点でローテーションする、と決めておくと迷わない。

## 移行後の性能

心配していた一斉回答の書き込みバーストは、問題にならなかった。
回答の記録は「INSERT + スコア加算のUPDATE」を `db.batch` で単一往復にまとめてあり、リモート接続でもロックを往復間で保持しない。
Application Insightsでの実測は、DBを読むAPIのp95が279ms、DBを触らないヘルスチェックが9msだった（計測の詳細は第5回）。
スマホ側のネットワーク遅延が数十msある用途なので、この差は体感に出ない。

次回は、Azureポータルでの環境構築とデプロイパイプラインで詰まった箇所を、時系列ではなく一覧で書く。
