# デプロイメントガイド

## 概要

Wedding Quiz アプリは以下の構成でAzureにデプロイされます：

- **Frontend**: Azure Static Web Apps
- **Backend**: Azure App Service (B1 Linux)

## 必要な準備

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
```

### 3. 環境変数の設定

#### Backend (App Service)

App Service の構成で以下の環境変数を設定：

```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=file:./data/quiz.db
ALLOWED_ORIGINS=https://<your-static-web-app>.azurestaticapps.net
```

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

開発サーバー: http://localhost:5173

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
3. 環境変数 `ALLOWED_ORIGINS` が正しく設定されているか確認

## セキュリティ対策

- CSP (Content Security Policy) を設定済み
- X-Frame-Options でクリックジャッキング対策
- HTTPS 強制
- 環境変数でシークレット管理
- SQLite の WAL モード有効化

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

- **垂直スケール**: B1 → S1/P1V2 にアップグレード
- **水平スケール**: インスタンス数を増やす（2-10台）

100人同時接続なら B1 で十分ですが、より多くのユーザーが予想される場合は S1 以上を推奨。

## コスト見積もり

- Static Web Apps: 無料枠で十分（月10GBまで）
- App Service B1: 約¥1,500/月
- 合計: 約¥1,500/月

## バックアップ

データベースのバックアップ：

```bash
# App Service SSH経由で
cp data/quiz.db data/quiz.db.backup-$(date +%Y%m%d)
```

定期的なバックアップはAzure Backup または cron ジョブで自動化推奨。
