// メディアファイルの保存先を抽象化するインターフェース。
// 実装は local（./uploads、従来挙動）と blob（Azure Blob Storage）の2種
// （2026-07-17 Phase 4: docs/issues/2026-07-17-blob-storage-migration.md 参照）
export interface StorageDriver {
  save(filename: string, data: Buffer): Promise<void>;
  /** 存在しない場合は null を返す */
  read(filename: string): Promise<Buffer | null>;
  /** 冪等: 存在しないファイルを指定してもエラーにしない */
  delete(filename: string): Promise<void>;
  /** 保存済み全ファイルの合計バイト数（ストレージ上限チェック用） */
  totalSize(): Promise<number>;
}
