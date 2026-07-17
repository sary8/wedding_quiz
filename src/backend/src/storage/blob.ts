import type { StorageDriver } from "./driver.js";

// テスト容易性のため、@azure/storage-blob の ContainerClient のうち
// 使用するメソッドだけを構造的型として受け取る（フェイク注入可能にする）
export interface BlockBlobClientLike {
  uploadData(data: Buffer): Promise<unknown>;
  downloadToBuffer(): Promise<Buffer>;
  deleteIfExists(): Promise<unknown>;
}

export interface ContainerClientLike {
  getBlockBlobClient(blobName: string): BlockBlobClientLike;
  createIfNotExists(): Promise<unknown>;
  listBlobsFlat(): AsyncIterable<{ properties: { contentLength?: number } }>;
}

function isNotFoundError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    (e as { statusCode?: number }).statusCode === 404
  );
}

// Azure Blob Storage 実装
export class BlobStorageDriver implements StorageDriver {
  private containerReady: Promise<unknown> | null = null;

  constructor(private readonly container: ContainerClientLike) {}

  // コンテナ作成は初回書き込み時に一度だけ（存在すれば no-op）
  private ensureContainer(): Promise<unknown> {
    if (!this.containerReady) {
      this.containerReady = this.container.createIfNotExists();
    }
    return this.containerReady;
  }

  async save(filename: string, data: Buffer): Promise<void> {
    await this.ensureContainer();
    await this.container.getBlockBlobClient(filename).uploadData(data);
  }

  async read(filename: string): Promise<Buffer | null> {
    try {
      return await this.container.getBlockBlobClient(filename).downloadToBuffer();
    } catch (e) {
      if (isNotFoundError(e)) return null;
      throw e;
    }
  }

  async delete(filename: string): Promise<void> {
    await this.container.getBlockBlobClient(filename).deleteIfExists();
  }

  async totalSize(): Promise<number> {
    let total = 0;
    try {
      for await (const blob of this.container.listBlobsFlat()) {
        total += blob.properties.contentLength ?? 0;
      }
    } catch (e) {
      // コンテナ未作成（初回書き込み前）は使用量0として扱う
      if (isNotFoundError(e)) return 0;
      throw e;
    }
    return total;
  }
}
