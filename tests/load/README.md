# 負荷テスト手順

100人同時接続の負荷テスト環境です。Artillery（無料・オープンソース）を使用します。

## 前提条件

- バックエンドが起動していること（`cd src/backend && npm run dev`）
- Node.js 18 以上

## セットアップ（初回のみ）

```bash
cd tests/load
npm install
```

## テスト実行手順

### Step 1: ルームを作成する

```bash
node setup.mjs
```

出力例:
```
=== Wedding Quiz 負荷テストセットアップ ===
[1/3] クイズを作成中...
  → quizId=5  hostSecret=abc123...
[2/3] 問題を追加中...
  → "日本の首都は？" 追加完了
[3/3] ルームを開設中...
  → ルームコード: ABCXYZ

✓ セットアップ完了！
次のコマンドで負荷テストを実行:
  npm test
```

### Step 2: 負荷テストを実行

```bash
# デフォルト（最大 ~50 同時ユーザー）
npm test

# 100 ユーザー版
npm run test:100
```

### Step 3: レポートを確認

```bash
npm run report
# → report.html が生成されブラウザで開ける
```

## 見るべき指標

| 指標 | 目安（合格基準） |
|------|----------------|
| `http.response_time.p95` | 500ms 以内 |
| `http.response_time.p99` | 1000ms 以内 |
| `vusers.failed` | 0（エラーなし） |
| `socketio.emit.rate` | joinRoom が全ユーザー分送信されていること |

## クリーンアップ

テスト用に作成したクイズを削除する場合:

```bash
node setup.mjs --cleanup
```

## トラブルシューティング

**"openRoom 失敗" と出る場合**
→ バックエンドが起動しているか確認：`curl http://localhost:3001/api/quizzes`

**Socket.io 接続タイムアウト**
→ バックエンドの CORS 設定を確認。`localhost:3001` が Artillery からアクセスできること

**Artillery コマンドが見つからない**
```bash
npm install  # node_modules/.bin/artillery に入っている
npx artillery run artillery.yml  # npx 経由でも実行可
```
