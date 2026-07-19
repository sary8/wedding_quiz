import { app, type InvocationContext, type Timer } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { selectExpiredNames, type BlobInfo } from "../lib/retention.js";
import { thumbnailKeyFor } from "../lib/storageKeys.js";

const container = process.env.STORAGE_CONTAINER ?? "media";
const account = process.env.STORAGE_ACCOUNT ?? "";
const retentionDays = Number(process.env.SELFIE_RETENTION_DAYS) || 7;

let serviceClient: BlobServiceClient | null = null;
function getServiceClient(): BlobServiceClient {
  if (!serviceClient) {
    serviceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      new DefaultAzureCredential()
    );
  }
  return serviceClient;
}

/**
 * 毎日1回、保持期限（既定7日）を過ぎた selfie を、対応するサムネごと削除する。
 * lastModified だけで判定し DB は参照しない（Function単体で完結）。
 */
export async function selfieCleanup(_myTimer: Timer, context: InvocationContext): Promise<void> {
  const cc = getServiceClient().getContainerClient(container);

  const blobs: BlobInfo[] = [];
  for await (const b of cc.listBlobsFlat({ prefix: "selfies/" })) {
    blobs.push({ name: b.name, lastModified: b.properties.lastModified });
  }

  const expired = selectExpiredNames(blobs, retentionDays);
  for (const name of expired) {
    await cc.getBlockBlobClient(name).deleteIfExists();
    await cc.getBlockBlobClient(thumbnailKeyFor(name)).deleteIfExists();
  }

  context.log(`定期削除: ${expired.length}件のselfie(+サムネ)を削除（保持${retentionDays}日 / 走査${blobs.length}件）`);
}

app.timer("selfieCleanup", {
  schedule: "0 0 3 * * *", // 毎日 03:00（UTC基準。Flex=Linux のため WEBSITE_TIME_ZONE は不使用）
  handler: selfieCleanup,
});
