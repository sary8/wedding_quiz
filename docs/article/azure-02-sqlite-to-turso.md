<!--
Qiita タグ案: Azure / AppService / SQLite / Turso / Drizzle
シリーズ第2回
-->

# SQLiteのままApp Serviceに載せてはいけない理由とTurso移行（結婚式クイズアプリをAzureに載せた話 2）

「結婚式クイズアプリをAzureに載せた話」の第2回です。
第1回で書いた構成のうち、DBだけがAzureの外（Turso）にあります。
今回はその理由と、移行で踏んだTurso固有の制約の話です。

移行前のアプリは、ローカルのSQLiteファイルで動いていました。
ライブラリは `@libsql/client` + Drizzle ORMで、書き込みの並行性のために `PRAGMA journal_mode = WAL` を有効にしていました。
100人が締め切り間際に一斉回答する瞬間があるので、読み取りと書き込みが互いをブロックしないWALは外せない設定です。

このままApp Serviceに置けるだろう、と思っていました。
デプロイ手順を調べている途中で、置けないことがわかりました。

## App Serviceの永続ディスクは、ローカルディスクではなかった

Linux App Serviceでアプリのファイルが置かれる `/home` は、見た目は普通のディレクトリですが、実体はAzure FilesをSMB（CIFS）でマウントしたネットワーク共有です。
通常のファイル読み書きは動きます。
動かないのは、ローカルディスクを前提としたOSの機能です。

SQLiteのWALモードは、`-shm` という共有メモリファイルをmmapで複数接続に見せる仕組みで動いています。
mmapによる共有メモリはネットワークファイルシステム上では機能せず、SQLiteの公式ドキュメントもネットワークFS上でのWALを非対応と明言しています。
つまりこのままデプロイすると、起動時の `PRAGMA journal_mode = WAL` がdisk I/Oエラーで落ちるか、悪ければ動いているように見えてDBが壊れます。

怖いのは、ローカル開発では本物のディスクなので、この問題が一切表面化しないことです。
デプロイして初めて踏む種類の地雷なんですよね。
デプロイ前に知れたのはラッキーでした。

## 移行先の比較

WALをやめて凌ぐ手もありましたが、並行性の要件を落とすことになるので、DBを外部サービスに出す方針にしました。
検討した選択肢は4つです。

| 選択肢 | 無料枠 | コード変更量 | 見送り理由 / 採用理由 |
|---|---|---|---|
| **Turso**（ホスト型libSQL） | 十分 | **ほぼゼロ** | 採用。すでに `@libsql/client` を使っており、接続先URLを変えるだけ |
| Azure Database for PostgreSQL | 新規アカウントは12ヶ月無料 | 中 | スキーマ定義の書き直しに加え、テストがインメモリSQLite前提のためテスト基盤の作り直しが必要 |
| Azure SQL Database（無料オファー） | 永続無料枠あり | 大 | Drizzle ORMがSQL Server方言に未対応で、クエリ層を全部書き直すことになる |
| Cosmos DB | 1,000 RU/s | 大 | 一斉回答の書き込みバーストがRU上限に当たる試算。JOIN前提のスキーマとNoSQLが合わない |

Tursoは「libSQL（SQLiteのフォーク）のホスティングサービス」で、クライアントライブラリが同じなのが決め手でした。
東京リージョンがあり、無料枠はこの規模（数千行）ではまず使い切れません。
Azureで統一できない点だけは妥協です。
Azureの勉強のためにやっているのに…という気持ちはありつつ、コード変更量の差が圧倒的でした。

## 実装：接続設定を環境変数に出す

変更の中心は、接続設定を環境変数から解決する層を1枚挟んだことです。

```ts
// DATABASE_URL 未設定ならローカルファイル（開発・テストは従来どおり）
const url = env.DATABASE_URL?.trim() || "file:./data/wedding_quiz.db";
const authToken = env.DATABASE_AUTH_TOKEN?.trim();
```

- ローカル開発・CI・テスト: 未設定のままローカルファイルとインメモリDBで動く
- 本番: `DATABASE_URL=libsql://xxx.turso.io` と認証トークンを設定する

drizzle-kit の設定も同じ規約にして、URLが `file:` ならdialectを `sqlite`、リモートなら `turso` に切り替えています。

## Turso固有の制約を3つ踏んだ

「URLを変えるだけ」では終わりませんでした。
リモートのlibSQLには、ローカルのSQLiteと同じに扱えない点があります。

### 1. `journal_mode` と `busy_timeout` のPRAGMAが使えない

Turso Cloudではジャーナリングと並行性をサーバー側が管理していて、これらのPRAGMAは非サポートです。
起動時に無条件で実行していたので、`file:` URLのときだけ実行するよう分岐しました。

### 2. `PRAGMA foreign_keys = ON` はセッション単位でしか効かない

libSQLは接続ごとに外部キー制約がデフォルトOFFで、これはTursoでも同じです。
起動時に一度ONにする方式は、ローカルの単一接続なら十分ですが、リモート接続は再接続や多重化でセッションが入れ替わることがあり、ONの状態が維持される保証がありません。
このアプリはクイズ削除時の関連データ削除を `ON DELETE CASCADE` に依存していたので、「保証がない」は受け入れられませんでした。

対応として、カスケード依存だった削除を明示的な削除に書き換えました。

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

テストには「`PRAGMA foreign_keys = OFF` の状態で削除しても孤児レコードが残らない」ケースを足しました。
FKが効かない最悪条件をローカルで再現するテストで、リモート接続の挙動を手元で担保するための保険です。

### 3. マイグレーションを実行する場所が変わる

それまでは起動コマンドで `npm run db:migrate && npm start` を実行していました。
この方式、App Serviceでは動きません。
drizzle-kit はdevDependencyで、本番のnode_modulesに含めないからです。
マイグレーションはGitHub Actionsのデプロイジョブに移して、CIがTursoに適用してからデプロイする構成にしました。
起動コマンドは `npm start` だけになり、起動も速くなったのでむしろ良かったです。

## トークンをチャットにもシェル履歴にも残さない

小さな運用の話ですが、効果が大きかったので書いておきます。
Tursoの認証トークンは `src/backend/.env`（gitignore済み）に置いて、drizzle-kit の設定ファイルだけがdotenvで読む構成にしました。

この構成には、副作用として良い性質があります。
アプリ本体（ローカル開発サーバー）はdotenvを読まないので、手元で `npm run dev` しても本番のTursoに誤接続しません。
接続設定を雑に共通化していたら、ローカルのテストデータが本番DBに入る事故がいつか起きていたと思います。

実は一度だけ、トークンをエディタの画面共有経由で露出させてしまい、その場でローテーションしました。
Tursoのダッシュボードでトークンを再発行して、.env、GitHubのSecret、App Serviceの設定の3箇所を更新して終わりです。
「露出したかどうか自信が持てない時点でローテーションする」と決めておくと、迷わなくて済みます。

## 移行後の性能

心配していた一斉回答の書き込みバーストは、問題になりませんでした。
回答の記録は「INSERT + スコア加算のUPDATE」を `db.batch` で単一往復にまとめてあり、リモート接続でもロックを往復間で保持しません。
Application Insightsでの実測は、DBを読むAPIのp95が279ms、DBを触らないヘルスチェックが9msでした（計測の詳細は第5回で書きます）。
スマホ側のネットワーク遅延が数十msある用途なので、この差は体感に出ません。

## さいごに

次回は、Azureポータルでの環境構築とデプロイパイプラインで詰まった箇所を、時系列ではなく一覧で書きます。
10連発です。

:::note info
### 参考資料

[Write-Ahead Logging - SQLite](https://www.sqlite.org/wal.html)

[Turso Documentation](https://docs.turso.tech/)

[Drizzle ORM](https://orm.drizzle.team/)
:::
