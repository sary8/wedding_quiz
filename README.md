# Wedding Quiz

リアルタイム進行に特化した、結婚式・パーティー向けの Kahoot! 風クイズアプリ。ホストが PC からゲームを進行し、参加者はスマホで回答します。

## 機能

- ホスト用ダッシュボードでクイズ作成・問題編集・並べ替え・プレビュー
- 参加者はルームコードで参加し、スマホからリアルタイム回答
- プロジェクター向けの表示専用スクリーンを別画面で同期
- 個人戦とチーム戦の両対応
- ランキング、最終結果、セルフィーを使った演出画面
- 問題ライブラリ、統計ダッシュボード、JSON/CSV エクスポート
- Socket.io ベースのリアルタイム同期と再接続対応

## 技術スタック

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, TypeScript |
| Backend | Node.js, Hono, Socket.io |
| Data | SQLite, Drizzle ORM |
| Testing | Vitest, Testing Library, Playwright, Artillery |
| Deployment | Azure Static Web Apps, Azure App Service |

## ディレクトリ構成

```text
src/
  frontend/   React app（ホスト・参加者・スクリーン画面）
  backend/    Hono + Socket.io サーバー、DB スキーマ・マイグレーション
docs/
  manual.md       使い方ガイド
  deployment.md   デプロイ構成
  pages.md        画面・ルート一覧
tests/
  load/       Artillery ベースの負荷テスト
specs/        機能仕様
```

## ローカル開発

```bash
cd src/backend
npm install
npm run db:migrate
npm run dev
```

```bash
cd src/frontend
npm install
npm run dev
```

- Frontend: `https://localhost:5174`（自己署名 SSL）
- Backend API: `http://localhost:3001`

`VITE_API_URL` が未設定の場合、フロントエンドは開発用 `/api` プロキシを使います。

## 環境変数

### Frontend

[`src/frontend/.env.example`](src/frontend/.env.example) を参照。

- `VITE_API_URL`: 本番環境でのバックエンド URL

### Backend

| 変数名 | 説明 |
|--------|------|
| `NODE_ENV` | `production` でデプロイ時に設定 |
| `PORT` | HTTP ポート（デフォルト: `3001`） |
| `CORS_ORIGIN` | 許可するフロントエンド origin（カンマ区切り）。**本番必須** |
| `ADMIN_PIN` | ホスト/ダッシュボードのログイン PIN。本番で未設定だとログインを拒否 |
| `TRUSTED_PROXY` | `true` で `x-forwarded-for` を信頼（リバースプロキシ経由の場合） |

## スクリプト

### Frontend

- `npm run dev` / `npm run build` / `npm run lint` / `npm run test` / `npm run e2e`

### Backend

- `npm run dev` / `npm run build` / `npm run test` / `npm run test:coverage` / `npm run db:migrate`

## セキュリティ

- 管理ルートはセッション認証で保護
- `CORS_ORIGIN` 未設定時は本番起動を拒否
- `ADMIN_PIN` 未設定の本番環境ではログインを拒否
- メディアルートにアップロードサイズ制限とパストラバーサル対策を実装済み

## ドキュメント

- [`docs/manual.md`](docs/manual.md): 使い方ガイド
- [`docs/pages.md`](docs/pages.md): 画面・ルート一覧
- [`docs/deployment.md`](docs/deployment.md): デプロイ構成
