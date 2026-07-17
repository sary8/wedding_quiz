# Azureデプロイ ロードマップ（本番強化 + Azure学習）

式当日までにAzure本番構成を作り込みつつ、無料枠（±数百円）でAzureの主要サービスを一通り学ぶための全体計画（2026-07-17策定）。

- 基本のデプロイ手順: [deployment.md](deployment.md)
- Turso移行の設計: [issues/2026-07-17-turso-migration.md](issues/2026-07-17-turso-migration.md)

## 進捗

- [ ] Phase 0: 基盤デプロイ（Turso + SWA + App Service）— **dev環境は完了**（2026-07-17、
      スマホ実機のスモークテスト・CI自動デプロイ・CORS/CSP検証済み）。残りは prod 一式
      （リージョンは Japan West。Japan East はサブスクリプションのVMクォータ0で作成不可だった。
      prod構築時は `src/frontend/staticwebapp.config.json` の CSP に prod バックエンドのオリジン追記を忘れないこと）
- [ ] Phase 1: Key Vault + Managed Identity
- [ ] Phase 2: Application Insights
- [ ] Phase 3: GitHub Actions OIDC
- [ ] Phase 4: アップロード画像の Blob Storage 移行
- [ ] Phase 5: Azure Load Testing（本番前の負荷検証）

---

## Phase 0: 基盤デプロイ（前提）

**ゴール**: スマホ実機で 参加 → 回答 → ランキング が Azure 上で動く。

1. Turso DB作成（アカウント作成済み 2026-07-17）
   - **Windows注意**: Turso CLI は WSL 必須（公式）。WSLを入れない場合は
     ダッシュボード https://app.turso.tech でもDB作成・URL確認・トークン発行が全部できる
   - DB作成 → `libsql://...` URL と認証トークンを控える
2. マイグレーション適用: `src/backend` で
   `DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:migrate`
3. Azure リソース作成（deployment.md 手順どおり）
   - Static Web Apps（Free）
   - App Service **F1で作成**（B1へは同一プランのスケール変更でいつでも上げ下げできる）
   - App Service の環境変数を設定（Linux は WebSocket 常時有効のため有効化操作は不要）
4. GitHub Secrets 設定 → 各ワークフローでデプロイ
5. 動作確認は **B1 に上げてから**行う（F1はWebSocket同時5接続・CPU 60分/日のため複数人テスト不可）

**完了条件**: `/api/health` OK、スマホ2台以上で参加→一斉回答→ランキング表示、App Service再起動後もクイズデータが残っている（Turso永続化の確認）。

---

## Phase 1: Key Vault + Managed Identity（シークレット管理）

**学べること**: マネージドID、RBAC、Key Vault参照 — 「シークレットをコードにも環境変数にも直置きしない」Azureの教科書パターン。
**コスト**: 操作課金のみ（1万操作で数円）＝実質無料。

1. Key Vault を作成（RBACモード）
2. シークレット登録: `ADMIN-PIN`, `DATABASE-AUTH-TOKEN`（Tursoトークン）
3. App Service の **システム割り当てマネージドID** を有効化
4. Key Vault で App Service のIDに **Key Vault Secrets User** ロールを付与
5. App Service のアプリ設定を Key Vault参照 に置換:
   `ADMIN_PIN = @Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/ADMIN-PIN/)`

**コード変更**: なし（Key Vault参照は普通の環境変数としてアプリに注入される）。

**完了条件**: アプリ設定の値欄にシークレット平文がない状態でログイン・DB接続が動く。

---

## Phase 2: Application Insights（可観測性）

**学べること**: Azure Monitor / Log Analytics、KQLクエリ、Live Metrics、アラート。
**無料枠**: ログ取込 5GB/月・保持31日まで無料（このアプリの規模なら余裕）。

1. まず **App Service の自動計装（コード変更ゼロ）** をON: ポータル → Application Insights → 有効化
2. 見るもの:
   - **Live Metrics**: 式当日のリアルタイム監視モニタにする
   - 失敗した要求 / 例外 / 依存関係（Tursoへの外部呼び出しのレイテンシが見える）
3. KQLを1つ書いてみる（例: 5分ごとのリクエスト数とp95）
4. アラート1本: 5xx が5分で10件超えたらメール
5. （発展）SDK計装に切替えて Socket.io イベントをカスタムテレメトリで送る
   - Node 22 + ESM 環境のため `@azure/monitor-opentelemetry` を使うこと（旧 `applicationinsights` v2 はESM非対応）

**完了条件**: Live Metricsで自分のスマホ操作がリアルタイムに見える。アラート1本が発火テスト済み。

---

## Phase 3: GitHub Actions OIDC（シークレットレスCI）

**学べること**: ワークロードID・フェデレーション資格情報 — 長寿命シークレット（発行プロファイル）をCIから排除するモダンパターン。
**コスト**: 無料。

1. Entra ID でアプリ登録（またはユーザー割り当てマネージドID）を作成
2. フェデレーション資格情報を追加:
   - `repo:sary8/wedding_quiz:ref:refs/heads/main`（および `environment:production`）
3. サブスクリプションのApp Serviceスコープで **Website Contributor** 相当のロールを付与
4. ワークフロー変更（`azure-backend-deploy.yml`）:
   - `permissions: id-token: write` を追加
   - `azure/login@v2`（client-id / tenant-id / subscription-id はSecretsでなく公開値でも可）
   - `azure/webapps-deploy@v3` から `publish-profile` を削除
5. `AZURE_WEBAPP_PUBLISH_PROFILE` Secret を削除

**完了条件**: publish profileなしでデプロイが成功する。

---

## Phase 4: アップロード画像の Blob Storage 移行（コード変更あり）

**学べること**: Blob SDK（`@azure/storage-blob`）、`DefaultAzureCredential`（ローカル=az login / 本番=MSIで同一コード）、ライフサイクル管理。
**コスト**: LRS Hot 数十円/月（12ヶ月無料枠対象アカウントなら5GBまで無料）。
**実益**: 画像がエフェメラルディスク依存でなくなる（Render無料でも画像が消えなくなる。App Serviceの/home依存も排除）。

**設計方針**:
- `routes/media.ts` のファイルI/Oを**ストレージアダプタに抽象化**し、`STORAGE_DRIVER=local | blob` で切替
  （ローカル開発・テストは `local` のまま。テストはアダプタ差し替えで既存構成を維持）
- 配信は現行どおり `GET /api/media/:file` の**プロキシ配信を維持**（CSP・CORS・認可の構成を変えないため。SAS直リンクは発展課題）
- 認証: 本番はマネージドID（Storage Blob Data Contributor）、ローカル/Renderは接続文字列
- 環境変数: `STORAGE_DRIVER` / `AZURE_STORAGE_ACCOUNT` / `AZURE_STORAGE_CONTAINER` / （接続文字列の場合）`AZURE_STORAGE_CONNECTION_STRING`

**進め方**: CLAUDE.mdルールに従い、実装前に `docs/issues/` に設計を記録してから着手。テスト込み。

**完了条件**: 画像アップロード→表示→クイズ削除で画像も消える、が blob モードで動く。App Service再起動後も画像が残る。

---

## Phase 5: Azure Load Testing（本番前の負荷検証）

**学べること**: マネージド負荷テスト、クライアント側/サーバー側メトリクスの突き合わせ。
**無料枠**: **50 VUH（仮想ユーザー時間）/月** — 「100仮想ユーザー × 30分」がちょうど収まるサイズ。

**このアプリでの本命シナリオ**: 一斉回答バースト（残り3秒で全員が回答ボタン）。

1. まずURLベーステストで肩慣らし: `/api/health` と参加系REST
2. 本命は **Locust スクリプト**（Azure Load TestingはJMeter/Locust対応）で
   `python-socketio` クライアントを使い 参加→問題受信→一斉emit を再現
3. **必ず B1 に上げてから実施**（F1のWebSocket 5接続制限では無意味）
4. Application Insights（Phase 2）のサーバー側メトリクスと突き合わせて分析

**⚠️ 事前に確認すること**: 本アプリにはIPベースのレート制限がある
（Socket接続・参加・アップロード等）。負荷テストエンジンは少数のIPから大量リクエストを
送るため、**レート制限に先に当たって「アプリの限界」ではなく「レート制限の限界」を測ってしまう**。
テスト時はレート制限の閾値を一時的に緩めるか、制限に当たらないシナリオ設計にすること。

**完了条件**: 100仮想ユーザーの一斉回答でエラー率とp95応答時間を記録し、当日の判断材料
（B1のままでよいか）としてこのドキュメントに追記する。

---

## コスト早見表（全部入り）

| リソース | 月額 |
|---|---|
| Static Web Apps (Free) | ¥0 |
| Turso (Free) | ¥0 |
| App Service F1（待機時） | ¥0 |
| App Service B1（本番・テスト日のみ） | 約¥65/日 |
| Key Vault | 実質¥0 |
| Application Insights（5GB/月まで） | ¥0 |
| GitHub Actions OIDC | ¥0 |
| Blob Storage | 数十円（無料枠対象なら¥0） |
| Azure Load Testing（50VUH/月まで） | ¥0 |

**合計: B1の稼働日数 × 約¥65 + 数十円**
