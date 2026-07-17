import { ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import type { StorageDriver } from "./driver.js";
import { LocalStorageDriver } from "./local.js";
import { BlobStorageDriver } from "./blob.js";

export type { StorageDriver } from "./driver.js";

const UPLOAD_DIR = "./uploads";
const DEFAULT_CONTAINER = "media";

// STORAGE_DRIVER 環境変数でストレージ実装を選択する。
// - 未設定 / "local": ローカルディスク（./uploads、従来挙動。dev・ローカル開発・テストはこちら）
// - "blob": Azure Blob Storage。認証は接続文字列があればそれを、
//   なければ AZURE_STORAGE_ACCOUNT + DefaultAzureCredential（本番=マネージドID）
// タイポで意図せず local に落ちてデータが分散する事故を防ぐため、未知の値は起動時に throw する
export function createStorageDriver(env: Record<string, string | undefined>): StorageDriver {
  const driver = (env.STORAGE_DRIVER?.trim() || "local").toLowerCase();

  if (driver === "local") {
    return new LocalStorageDriver(UPLOAD_DIR);
  }

  if (driver === "blob") {
    const container = env.AZURE_STORAGE_CONTAINER?.trim() || DEFAULT_CONTAINER;
    const connectionString = env.AZURE_STORAGE_CONNECTION_STRING?.trim();
    if (connectionString) {
      return new BlobStorageDriver(new ContainerClient(connectionString, container));
    }
    const account = env.AZURE_STORAGE_ACCOUNT?.trim();
    if (account) {
      return new BlobStorageDriver(
        new ContainerClient(
          `https://${account}.blob.core.windows.net/${container}`,
          new DefaultAzureCredential()
        )
      );
    }
    throw new Error(
      "STORAGE_DRIVER=blob には AZURE_STORAGE_CONNECTION_STRING または AZURE_STORAGE_ACCOUNT の設定が必要です"
    );
  }

  throw new Error(`未知の STORAGE_DRIVER です: "${driver}"（local または blob を指定）`);
}

export const storage: StorageDriver = createStorageDriver(process.env);
