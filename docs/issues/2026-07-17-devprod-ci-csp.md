# 2026-07-17 dev/prod環境分離のCI対応 + SWA設定ファイルの2つのバグ修正

## 背景 / 目的
Azureにdev/prod 2環境を構築する方針が確定（コスト¥0、GitHub Environmentsで分離）。
dev環境（RG: quiz-dev / App Service: quiz-dev / SWA: swa-quiz-dev / Turso: dev用DB、リージョンは
Japan West — Japan East はサブスクリプションのVMクォータ0のため不可）をユーザーがポータルで構築済み。
GitHub に `development` / `production` 環境を作成し、環境ごとに Secrets
（AZURE_WEBAPP_PUBLISH_PROFILE / AZURE_STATIC_WEB_APPS_API_TOKEN / DATABASE_URL / DATABASE_AUTH_TOKEN）と
Variables（AZURE_WEBAPP_NAME / VITE_API_URL）を持つ。

## 発見したバグ（本対応で修正）
1. **`staticwebapp.config.json` がリポジトリ直下にあり、SWAに読み込まれない**。
   SWAは `app_location`（`/src/frontend`）配下の設定ファイルしか認識しないため、
   SPAフォールバックもセキュリティヘッダも一切効いていなかった → `src/frontend/` へ移動
2. **CSPの `connect-src 'self' wss: ws:` が別オリジンのバックエンドへのHTTPS通信を許可していない**。
   SWA上のフロントから App Service へのREST/ポーリングが全ブロックされる
   → バックエンドオリジンを connect-src / img-src / media-src に追加
   （画像・動画は `/api/media/*` をバックエンドから配信しているため）

## CI変更方針
- `azure-backend-deploy.yml` / `azure-static-web-apps.yml` 共通:
  - `push`（main、paths該当時）→ **development に自動デプロイ**
  - `workflow_dispatch`（environment を choice 入力）→ 指定環境にデプロイ
  - ジョブの `environment:` を動的化し、環境スコープの Secrets / Variables を参照
  - production 環境には GitHub 側で Required reviewers を設定（承認なしでprodに出ない）
- backend: アプリ名を `vars.AZURE_WEBAPP_NAME` から取得（ハードコード廃止）
- frontend: ビルド時に `VITE_API_URL`（環境Variable）を注入 — 従来は未注入でAPI先がlocalhostになるバグ

## その他の実態反映
- Linux App Service は WebSocket 常時有効（トグル自体が存在しない）— docs の Windows前提記述を修正
- リージョンは Japan West を正とする

## 検証
- push 起点で development への両ワークフローが成功すること
- `/api/health` が200、SWAのページが表示されること
- dev用Turso DBにマイグレーションが自動適用されること（デプロイ後にテーブル存在を確認）
