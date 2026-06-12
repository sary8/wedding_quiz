# お試しデプロイ手順（無料: Render + Vercel）

本番（Azure）の前に、複数人のスマホ実機でテストするための無料構成。

| 役割 | サービス | プラン |
|---|---|---|
| バックエンド（Hono + Socket.io + SQLite） | Render Web Service | Free |
| フロントエンド（React/Vite 静的サイト） | Vercel | Hobby（無料） |

## 無料枠の制約（先に把握しておく）

- **Render Free は15分アイドルでスリープ**する。次のアクセスで起動に1分弱かかる。
  テスト開始の数分前に一度アクセスして起こしておくこと。
- **ディスクはエフェメラル**。再起動・再デプロイのたびに SQLite とアップロード画像は消える。
  クイズは毎回作り直す前提で使う（起動時に `db:migrate` が走り空のDBが作られる）。
- 同時数十人程度のテストなら無料枠の性能で問題ない。

## 1. バックエンド（Render）

1. https://render.com にGitHubでサインアップ
2. Dashboard → **New → Blueprint** → このリポジトリを選択
   - ルートの `render.yaml` が自動検出され、`wedding-quiz-api` サービスが作られる
3. 環境変数の入力を求められたら:
   - `ADMIN_PIN`: 管理画面ログイン用の任意のPIN（例: 6桁数字）
   - `CORS_ORIGIN`: **いったん空のままでよい**（フロントのURL確定後に設定）
4. デプロイ完了後、サービスのURLを控える
   - 例: `https://wedding-quiz-api.onrender.com`
   - この時点では `CORS_ORIGIN` 未設定のため起動に失敗しているはず。手順3で解消する

## 2. フロントエンド（Vercel）

1. https://vercel.com にGitHubでサインアップ
2. **Add New → Project** → このリポジトリをインポート
3. 設定:
   - **Root Directory**: `src/frontend`
   - Framework Preset: Vite（自動検出される）
   - **Environment Variables**:
     - `VITE_API_URL` = 手順1で控えたRenderのURL（例: `https://wedding-quiz-api.onrender.com`）
4. Deploy。完了後のURLを控える（例: `https://wedding-quiz-xxxx.vercel.app`）

SPAのルーティングは `src/frontend/vercel.json` の rewrites で対応済み。

## 3. CORSの紐付け（最後に必須）

1. Renderのダッシュボード → `wedding-quiz-api` → **Environment**
2. `CORS_ORIGIN` に手順2のVercel URLを設定（例: `https://wedding-quiz-xxxx.vercel.app`）
   - 末尾スラッシュなし。プレビューURLも使う場合はカンマ区切りで複数指定可
3. 保存すると自動で再デプロイされる。`/api/health` が `{"status":"ok"}` を返せば起動成功

## 4. 動作確認

1. PCで `https://<vercel-url>/host/setup` を開き、`ADMIN_PIN` でログイン
2. クイズを作成 → ルーム開設 → ロビーにQRコードが表示される
3. スマホでQRを読み取って参加（モバイル回線でもOK）
4. プロジェクター用画面は `ロビーの表示用URL` を別タブ/別端末で開く

## トラブルシューティング

- **参加画面が「サーバーに接続できていません」のまま**:
  Renderがスリープから起き上がるまで1分弱待つ。`/api/health` を直接開くと起こせる
- **CORSエラー（コンソールに表示）**:
  `CORS_ORIGIN` の値とVercelのURLが完全一致しているか確認（https、末尾スラッシュなし）
- **管理画面にログインできない**:
  Renderの `ADMIN_PIN` が設定されているか確認。本番モードでは未設定だと全ログイン拒否
- **作ったクイズが消えた**:
  仕様（エフェメラルディスク）。Renderが再起動・再デプロイされるとDBはリセットされる

## 後片付け

テストが終わったら、Render・Vercel双方のダッシュボードからプロジェクトを削除するだけ。
課金要素はないが、公開URLを放置しない（ADMIN_PINのみで管理画面に入れるため）。
