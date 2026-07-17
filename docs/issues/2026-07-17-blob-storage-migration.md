# 2026-07-17 アップロード画像/動画の Azure Blob Storage 対応（Phase 4）

## 背景 / 目的
メディアファイル（問題画像・動画、参加者セルフィー）は `./uploads` のローカルディスク保存であり:
- Render等のエフェメラル環境では再起動で消える（deployment-trial.md の既知の制約）
- App Service では `/home` 頼みで、スケール・バックアップ・別サービスからの参照が不自由

Azureデプロイロードマップ Phase 4 として、ストレージをアダプタ化し Azure Blob Storage を選択可能にする。

## 方針（roadmap Phase 4 の設計を具体化）
### ストレージアダプタ
`src/storage/` を新設し、media.ts のファイルI/Oを `StorageDriver` インターフェースに抽象化する:

```ts
interface StorageDriver {
  save(filename, data): Promise<void>;
  read(filename): Promise<Buffer | null>;  // null = not found
  delete(filename): Promise<void>;         // 冪等（存在しなくてもエラーにしない）
  totalSize(): Promise<number>;            // ストレージ上限チェック用
}
```

- `local.ts`: 現行の fs 実装をそのまま移設（`./uploads`）
- `blob.ts`: `@azure/storage-blob`。**ContainerClient をコンストラクタ注入**にして、
  ユニットテストはフェイクオブジェクトで実施（SDKモック不要の設計）
- `index.ts`: `STORAGE_DRIVER` 環境変数で選択するファクトリ + シングルトン
  - 未設定 or `local` → local（**既存の挙動・既存テストは無変更**）
  - `blob` → 認証は次の優先順:
    1. `AZURE_STORAGE_CONNECTION_STRING`（ローカル検証・Render用）
    2. `AZURE_STORAGE_ACCOUNT` + `DefaultAzureCredential`（本番=マネージドID。Phase 1のIDを再利用）
  - `blob` 指定で設定不足なら**起動時に throw（fail-fast）**
  - コンテナ名: `AZURE_STORAGE_CONTAINER`（デフォルト `media`）。初回書き込み時に createIfNotExists

### media.ts の変更
- `writeFile/readFile/unlink/readdir+stat` → driver 呼び出しに置換
- 配信は現行どおりプロキシ（`GET /api/media/:filename`）を維持。
  パストラバーサル防御・Content-Type判定・immutableキャッシュヘッダは不変
- ストレージ使用量の30秒キャッシュ + 書込時加算ロジックは維持
  （blobの totalSize は listBlobsFlat の合計。式規模=数百blobなら軽量、かつキャッシュで呼び出し頻度も低い）
- ルーム単位セルフィー上限・レート制限・マジックバイト検証は無変更

### 対象環境
- **prod のみ blob 化**（dev/ローカル/テストは local のまま — Phase 3と同じ「prodだけ」方針）
- prod の認証は App Service の**システム割り当てマネージドID**（Phase 1で有効化済み）に
  **ストレージ BLOB データ共同作成者**を付与

## テスト
- 既存 media.test.ts 31件: 無変更でパス（local がデフォルトのため）
- 新規 `__tests__/storage/`:
  - ファクトリ: 未設定→local / blob+接続文字列→blob / blob+設定不足→throw
  - BlobStorageDriver: フェイクContainerClientで save/read(404→null)/delete/totalSize
  - LocalStorageDriver: save→read→delete のラウンドトリップ

## 検証
- vitest / build
- デプロイ後: prod で画像アップロード→表示→クイズ削除で画像も消える、App Service再起動後も画像が残る
