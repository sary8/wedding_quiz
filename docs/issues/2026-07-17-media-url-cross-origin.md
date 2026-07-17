# 2026-07-17 メディアURLが別オリジン構成（SWA + App Service）で解決されないバグ

## 症状
prod（SWA）の問題作成フォームで選択肢画像のプレビューが表示されない（ユーザー報告）。

## 原因
バックエンドが返すメディアURLは相対パス（`/api/media/...`）であり、フロントはそれをそのまま
`<img src>` に渡していた。フロント（SWA）とバックエンド（App Service）が**別オリジン**のため、
相対パスはSWA自身に解決されて404になる。

- ローカル開発は Vite の `/api` プロキシが、（Vercel試用時は未検証だった）ため潜在化していた
- 問題画像のフォーム内プレビューだけは `URL.createObjectURL` のローカルURLを表示していたため
  「選択肢だけ壊れて見える」症状になったが、実際は**プレイ画面・ロビーのアバター・最終発表の
  写真などメディア表示ほぼ全箇所**が対象の系統的バグ

## 対応
`sanitizeMediaUrl()` を単一の解決ポイントとして拡張:
- 相対パス（`/`始まり）は `VITE_API_URL` が設定されていれば前置して絶対URL化
  （未設定=ローカルdev/同一オリジンでは従来どおり相対のまま）
- ローカルプレビュー用の `blob:` objectURL を許可
- 既に `sanitizeMediaUrl` を通していた画面（QuestionPage / AnswerPage / ResultPage /
  ResultsPage / PreviewPage / ChoiceButton / Avatar経由の全アバター表示）は中央修正で自動解決
- 素通しだった8ファイルを `sanitizeMediaUrl` 経由に修正（サニタイズ漏れの防御強化も兼ねる）:
  QuestionInlineForm（プレビュー・選択肢画像）/ QuestionLibraryView / ParticipantGalleryView /
  GameHistoryView / FinalPage / RankingPage / ThankYouScreen / ParticipantRankingPage

## テスト
- sanitizeUrl.test: VITE_API_URL設定時の絶対URL化・絶対URLの二重前置なし・blob:許可を追加
