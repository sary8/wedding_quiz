# Wedding Quiz App

結婚式の二次会用 Kahoot!形式リアルタイムクイズアプリ。
ホスト（PC/プロジェクター）から問題を出し、参加者約100人がスマホから回答する。

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Node.js + Hono + Socket.io |
| ORM | Drizzle ORM |
| DB | SQLite (@libsql/client) |
| Hosting | Azure Static Web Apps (Frontend) + Azure App Service B1 Linux (Backend) |

## Directory Structure

```
wedding_quiz/
├── CLAUDE.md
├── .gitignore
├── src/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/                  # マイグレーションファイル (自動生成)
│   │   ├── data/                     # SQLite DBファイル (gitignore)
│   │   ├── uploads/                  # アップロードされたメディア (gitignore)
│   │   └── src/
│   │       ├── index.ts              # エントリーポイント (Hono + Socket.io起動)
│   │       ├── db/
│   │       │   ├── schema.ts         # Drizzle スキーマ定義
│   │       │   └── index.ts          # DB接続・初期化
│   │       ├── routes/
│   │       │   ├── quiz.ts           # Quiz CRUD
│   │       │   ├── question.ts       # Question CRUD
│   │       │   └── media.ts          # メディアアップロード・配信
│   │       ├── socket/
│   │       │   └── quizHandler.ts    # Socket.io イベントハンドラ
│   │       ├── services/
│   │       │   ├── quizService.ts    # ビジネスロジック
│   │       │   ├── scoringService.ts # スコア計算
│   │       │   └── timerService.ts   # カウントダウン管理
│   │       └── types/
│   │           └── index.ts          # 共有型定義
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx               # ルーティング定義
│           ├── pages/
│           │   ├── host/
│           │   │   ├── SetupPage.tsx       # 問題作成・編集
│           │   │   ├── LobbyPage.tsx       # QRコード + 参加者一覧
│           │   │   ├── QuestionPage.tsx    # 問題表示 + カウントダウン
│           │   │   ├── ResultsPage.tsx     # 正解 + 回答分布
│           │   │   ├── RankingPage.tsx     # レースアニメーション
│           │   │   └── FinalPage.tsx       # オールスター感謝祭式発表
│           │   └── participant/
│           │       ├── JoinPage.tsx        # ルームコード入力
│           │       ├── ProfilePage.tsx     # ニックネーム + 自撮り
│           │       ├── WaitingPage.tsx     # 待機画面
│           │       ├── AnswerPage.tsx      # 4色回答ボタン
│           │       ├── ResultPage.tsx      # 正解/不正解 + ポイント
│           │       └── FinalPage.tsx       # 自分の最終順位 + 統計
│           ├── components/
│           │   ├── ui/                     # 汎用UIコンポーネント
│           │   ├── quiz/                   # クイズ固有コンポーネント
│           │   └── effects/               # 紙吹雪・花火エフェクト
│           ├── hooks/
│           │   ├── useSocket.ts            # Socket.io接続管理
│           │   ├── useQuizState.ts         # ゲーム状態マシン
│           │   └── useCamera.ts            # カメラ・自撮り
│           ├── services/
│           │   └── api.ts                  # REST API クライアント
│           ├── types/
│           │   └── index.ts               # 型定義
│           └── styles/
│               └── index.css              # グローバルスタイル
```

## Development Commands

### Backend
```bash
cd src/backend
npm install              # 依存インストール
npm run dev              # 開発サーバー起動 (tsx watch, port 3001)
npm run build            # TypeScriptコンパイル
npm run db:generate      # Drizzleマイグレーション生成
npm run db:migrate       # マイグレーション適用
```

### Frontend
```bash
cd src/frontend
npm install              # 依存インストール
npm run dev              # Vite開発サーバー起動 (port 5173)
npm run build            # プロダクションビルド
npm run preview          # ビルド結果のプレビュー
```

### 同時起動（開発時）
Backend (port 3001) と Frontend (port 5173) を別ターミナルで同時起動する。
Viteの proxy 設定で `/api/*` と `/socket.io/*` を backend に転送する。

## Coding Conventions

### TypeScript
- `strict: true` を必ず有効にする
- `any` は原則禁止。やむを得ない場合は `unknown` + 型ガードを使う
- 型定義は `types/index.ts` に集約し、frontend/backend で構造を揃える
- enumの代わりに `as const` + union型を使う
  ```ts
  export const QuizStatus = { Draft: "draft", Lobby: "lobby", InProgress: "in_progress", Finished: "finished" } as const;
  export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];
  ```

### React
- 関数コンポーネント + hooks のみ（classコンポーネント禁止）
- コンポーネントは `export function ComponentName()` で named export する（default export禁止）
- 1ファイル1コンポーネントを基本とする
- Props型は同一ファイル内でコンポーネント直上に定義
  ```tsx
  type Props = { title: string; onSubmit: (data: FormData) => void };
  export function QuizForm({ title, onSubmit }: Props) { ... }
  ```
- 状態管理: React hooks (`useState`, `useReducer`, `useContext`) で十分。外部ライブラリ不要
- CSSは CSS Modules or Tailwind（後で決定）。inline styleは原則禁止
- `useEffect` の依存配列は正確に書く。ESLint警告を無視しない
- イベントハンドラは `handle` prefix: `handleClick`, `handleSubmit`
- boolean propsは `is` / `has` prefix: `isLoading`, `hasError`

### Naming
| 対象 | 規約 | 例 |
|------|------|----|
| ファイル（コンポーネント） | PascalCase.tsx | `SetupPage.tsx` |
| ファイル（hook） | camelCase.ts | `useSocket.ts` |
| ファイル（その他） | camelCase.ts | `quizService.ts` |
| コンポーネント | PascalCase | `QuizForm` |
| 関数・変数 | camelCase | `handleSubmit`, `roomCode` |
| 定数 | PascalCase (const object) | `QuizStatus` |
| 型・インターフェース | PascalCase | `Participant`, `QuizState` |
| DB テーブル | snake_case (複数形) | `quizzes`, `questions` |
| DB カラム | snake_case | `room_code`, `total_score` |

### Import Order
1. React / Node.js built-ins
2. Third-party packages
3. Internal modules (absolute path)
4. Relative imports
5. Type-only imports

## Git Rules

### Branch & Push（A方式：シンプル個人開発フロー）
- `main` - 本番リリース用。直接commitしない
- `feat/<feature-name>` - 機能開発
- `fix/<bug-name>` - バグ修正
- **タスクごとにブランチを切る**。1タスク = 1ブランチが原則
- タスク完了後のフロー：
  1. feature branch で commit
  2. `git checkout main && git merge <branch>`
  3. `git push origin main`（**マージ後に必ずpush**）
  4. `git branch -d <branch>`
- **mainにマージしたら毎回リモートにpushする**。pushし忘れ厳禁
- 例: `feat/backend-db-schema`, `feat/host-lobby-page`, `fix/socket-reconnect`

### Commit Message
日本語OK。以下のprefix + 簡潔な説明：
```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
style: 見た目の変更（ロジック変更なし）
chore: 設定・ビルド関連
docs: ドキュメント
```
例: `feat: Socket.ioでリアルタイム回答受付を実装`

**禁止事項：**
- `Co-Authored-By` を絶対に付けない
- AI・Claude・LLM が生成したことを示す記述を一切入れない
- コミットメッセージもコード内コメントも、すべて人間が書いたものとして扱う

### Commit単位
- 1つの論理的な変更 = 1コミット
- 動作する状態でコミットする（ビルドが通ること）
- 巨大なコミットは避け、レビュー可能な粒度に分割

## React Best Practices

### Custom Hooks
- ロジックの再利用にはカスタムフックを抽出する
- フック名は `use` prefix 必須
- 副作用（Socket接続、タイマーなど）はフックに閉じ込め、コンポーネントを純粋に保つ

### パフォーマンス
- `React.memo` は実測で遅い場合のみ使う（早すぎる最適化は不要）
- リスト表示には安定した `key` を使う（indexは使わない）
- 重い計算は `useMemo`、コールバック安定化は `useCallback`（必要な場合のみ）

### エラーハンドリング
- API呼び出しには必ずエラーハンドリングをつける
- ユーザー向けエラーメッセージは日本語で表示
- ネットワークエラー時はリトライUIを表示

### アクセシビリティ
- セマンティックHTML（`button`, `form`, `nav` 等）を使う
- 画像には `alt` 属性をつける
- フォーカス管理を意識する（モーダル等）

## Architecture Decisions

### フロント⇔バック通信
- **REST API** (`/api/*`): Quiz/Question のCRUD、メディアアップロード、初期データ取得
- **Socket.io**: ゲーム中のリアルタイムイベント（問題配信、回答、ランキング）
- 使い分けの基準: 永続化が主目的→REST、リアルタイム同期が必要→Socket.io

### 状態管理
- ゲーム状態は `useReducer` でステートマシンとして管理
- Socket.ioイベントで状態遷移をトリガー
- `localStorage` に participantToken を保存して再接続に対応

### セキュリティ
- Host認証: URLクエリパラメータの `key` でsecretKeyを照合（簡易方式）
- 参加者: token (nanoid) でセッション管理
- SQLiteはWALモードで100人同時書き込みに対応
- ファイルアップロード: サイズ上限5MB、画像/動画のみ許可

## UI Language
- すべてのUI文言は **日本語** で表示する
