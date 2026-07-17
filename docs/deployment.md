# デプロイメントガイド

## 概要

Wedding Quiz アプリは以下の構成でAzureにデプロイされます：

- **Frontend**: Azure Static Web Apps
- **Backend**: Azure App Service (B1 Linux)
- **Database**: Turso（ホスト型libSQL、無料プラン）

> **なぜDBを外部化するのか**: App Service (Linux) の永続領域 `/home` は Azure Files (CIFS/SMB)
> マウントであり、SQLite WAL モードが必要とする共有メモリ（mmap）が動作しない。
> ローカルファイルSQLiteのままデプロイすると disk I/O error や破損のリスクがある。
> コードは `@libsql/client` を使用しているため、Turso へは接続設定の変更のみで移行できる
> （`docs/issues/2026-07-17-turso-migration.md` 参照）。

Application Insights・Key Vault・Blob Storage移行・負荷テストなどの拡張計画は
[azure-deployment-roadmap.md](azure-deployment-roadmap.md) を参照。

## 必要な準備

### 0. Turso データベースの作成

1. https://turso.tech にサインアップ（GitHub連携可）し、Turso CLI をインストール
2. DBを作成（リージョンは最寄り＝東京が自動選択される）:

   ```bash
   turso db create wedding-quiz
   turso db show wedding-quiz --url     # → DATABASE_URL に設定する値（libsql://...）
   turso db tokens create wedding-quiz  # → DATABASE_AUTH_TOKEN に設定する値
   ```

3. マイグレーションを適用（`src/backend` で実行。デプロイワークフローにも組み込み済み）:

   ```bash
   DATABASE_URL=libsql://<your-db>.turso.io DATABASE_AUTH_TOKEN=<トークン> npm run db:migrate
   ```

### 1. Azureリソースの作成

#### Frontend (Azure Static Web Apps)

1. Azure Portal で Static Web Apps を作成
2. GitHub連携を設定
3. デプロイトークンを取得
4. GitHub Secrets に `AZURE_STATIC_WEB_APPS_API_TOKEN` を追加

#### Backend (Azure App Service)

1. Azure Portal で App Service (B1 Linux) を作成
2. Node.js 20 ランタイムを選択
3. デプロイメント設定:
   - ソース: GitHub Actions
   - ブランチ: main
   - パス: src/backend

### 2. GitHub Secrets の設定

以下のシークレットをGitHubリポジトリに追加：

```
AZURE_STATIC_WEB_APPS_API_TOKEN: Static Web Apps のAPIトークン
AZURE_WEBAPP_PUBLISH_PROFILE: App Service の発行プロファイル
DATABASE_URL: TursoのDB URL（libsql://...）※デプロイ時のマイグレーションに使用
DATABASE_AUTH_TOKEN: Tursoの認証トークン
```

### 3. 環境変数の設定

#### Backend (App Service)

App Service の構成で以下の環境変数を設定：

```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=libsql://<your-db>.turso.io
DATABASE_AUTH_TOKEN=<Tursoの認証トークン>
TRUSTED_PROXY=true
CORS_ORIGIN=https://<your-static-web-app>.azurestaticapps.net
ADMIN_PIN=<管理画面アクセス用PIN（任意）>
```

> ⚠️ `DATABASE_URL` を未設定（＝ローカルファイル）のままにしないこと。
> データが再起動で消えるうえ、`/home` 上では WAL が動作しない（起動時に警告ログが出る）。

## CI/CDパイプライン

### Frontend CI (`frontend-ci.yml`)

- **トリガー**: `src/frontend/**` の変更時
- **ステップ**:
  1. 依存関係インストール
  2. Lint実行
  3. テスト実行
  4. ビルド
  5. アーティファクトのアップロード

### Backend CI (`backend-ci.yml`)

- **トリガー**: `src/backend/**` の変更時
- **ステップ**:
  1. 依存関係インストール
  2. テスト実行
  3. カバレッジチェック
  4. ビルド
  5. カバレッジレポートのアップロード

### Backend デプロイ (`azure-backend-deploy.yml`)

- **トリガー**: 手動実行（`workflow_dispatch`）※Azure設定完了後に push トリガーを有効化
- **ジョブ構成**:
  - **test**: 依存関係インストール → テスト → ビルド
  - **deploy** (test成功後): ビルド → **Tursoへマイグレーション適用** → 本番依存関係のみ再インストール → zipパッケージ作成 → Azure App Service へデプロイ
- **認証**: GitHub Secrets の `AZURE_WEBAPP_PUBLISH_PROFILE`（発行プロファイル）
- **起動コマンド**: `npm start`
  （マイグレーションはデプロイジョブがCIから適用する。drizzle-kit は devDependency のため
  本番の node_modules には含まれず、App Service 上では実行できない）
- **GitHub環境**: `production`（デプロイURLを出力）

#### App Service 起動コマンドの設定

Azure Portal の App Service → 構成 → 全般設定 → スタートアップコマンドに以下を設定：

```
npm start
```

### Azure Static Web Apps デプロイ (`azure-static-web-apps.yml`)

- **トリガー**: main ブランチへのpush、またはPull Request
- **ステップ**:
  1. コードチェックアウト
  2. ビルド & デプロイ
  3. PRクローズ時のクリーンアップ

## ローカル開発環境

### Frontend

```bash
cd src/frontend
npm install
npm run dev
```

開発サーバー: http://localhost:5174

### Backend

```bash
cd src/backend
npm install
npm run dev
```

APIサーバー: http://localhost:3001

## デプロイ前チェックリスト

### Frontend

- [ ] すべてのテストがパス (`npm test`)
- [ ] Lintエラーなし (`npm run lint`)
- [ ] ビルドが成功 (`npm run build`)
- [ ] 環境変数が正しく設定されている

### Backend

- [ ] すべてのテストがパス (`npm test`)
- [ ] カバレッジ100% (`npm run test:coverage`)
- [ ] ビルドが成功 (`npm run build`)
- [ ] データベースマイグレーションが適用されている
- [ ] 環境変数が正しく設定されている

## トラブルシューティング

### Static Web Apps のビルドが失敗する

1. `package.json` の `build` スクリプトを確認
2. Node.js バージョンが一致しているか確認
3. 依存関係が正しくインストールされているか確認

### App Service の起動が失敗する

1. ログストリームで詳細を確認
2. 環境変数が正しく設定されているか確認
3. ポート番号が正しいか確認（Azureは8080を使用）

### WebSocket接続が失敗する

1. App Service で WebSocket が有効になっているか確認
2. CORS設定が正しいか確認
3. 環境変数 `CORS_ORIGIN` が正しく設定されているか確認

## セキュリティ対策

- CSP (Content Security Policy) を設定済み
- X-Frame-Options でクリックジャッキング対策
- HTTPS 強制
- 環境変数でシークレット管理
- ローカル開発時は SQLite WAL モード有効化（本番のTursoはサーバー側が並行性を管理）

## モニタリング

### Application Insights

Azure Portal で Application Insights を設定すると：

- パフォーマンスメトリクス
- エラートラッキング
- ユーザー行動分析

を確認できます。

## スケーリング

### Frontend

Static Web Apps は自動的にスケールします。

### Backend

App Service のスケール設定：

- **垂直スケール**: B1 → S1/P1V2 にアップグレード（増強はこちらで行う）

100人同時接続なら B1 で十分ですが、より多くのユーザーが予想される場合は S1 以上を推奨。

> ⚠️ **水平スケール（インスタンス数を2以上に増やすこと）は現状のアーキテクチャでは行わないこと（診断 H-3）。**
> Socket.io は Redis 等のアダプタ未使用でプロセスローカルにルームを管理しています。インスタンスを
> 増やすとロードバランサの振り分けで参加者リストが分裂し、`nextQuestion` が一部の参加者にしか
> 届かない split-brain になります。増強が必要なときは垂直スケール（上位プラン）で対応してください。
> 共有DB（Turso）への移行は完了済み（2026-07-17）のため、水平スケールの残りの前提は
> Socket.io Redis アダプタの導入のみです。**本番当日はインスタンス数を1のまま固定すること。**

## コスト見積もり

- Static Web Apps: 無料枠で十分（月10GBまで）
- Turso: 無料プランで十分
- App Service B1: 約¥2,000/月（時間課金・約¥65/日）
- 合計: 約¥2,000/月

> 💡 **節約Tips**: App Service は時間課金で、F1（無料）⇔ B1 は同一プランのスケール変更で
> 行き来できる（設定・データは保持）。普段は F1 に落としておき、リハーサルと本番当日だけ
> B1 に上げれば、実質数百円で運用できる。
> ただし **F1 は WebSocket 同時5接続・CPU 60分/日の制限**があるため、複数人での動作確認や
> 本番は必ず B1 以上で行うこと。

## バックアップ

データベース（Turso）のバックアップ：

```bash
turso db shell wedding-quiz .dump > backup-$(date +%Y%m%d).sql
```

アップロード画像は App Service の `/home` 上（`src/backend/uploads`）にあるため、
必要に応じて Kudu (SSH/FTPS) 経由で取得する。
