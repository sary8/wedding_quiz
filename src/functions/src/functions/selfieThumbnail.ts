import { app, type InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { generateThumbnail } from "../lib/thumbnail.js";
import { thumbnailKeyFor } from "../lib/storageKeys.js";

const container = process.env.STORAGE_CONTAINER ?? "media";
const account = process.env.STORAGE_ACCOUNT ?? "";
const width = Number(process.env.THUMBNAIL_WIDTH) || 320;

// コールドスタート時のみ生成して使い回す（DefaultAzureCredential=ローカルはaz login / 本番はMI）
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
 * selfies/{room}/{name} に新規blobが来たらWebPサムネを生成し
 * thumbnails/selfies/{room}/{name}.webp に保存する。
 */
export async function selfieThumbnail(blob: Buffer, context: InvocationContext): Promise<void> {
  const room = context.triggerMetadata?.room as string | undefined;
  const name = context.triggerMetadata?.name as string | undefined;
  if (!room || !name) {
    context.warn(`triggerMetadata に room/name がありません: ${context.triggerMetadata?.blobTrigger}`);
    return;
  }

  const thumbKey = thumbnailKeyFor(`selfies/${room}/${name}`);
  const thumb = await generateThumbnail(blob, { width });

  await getServiceClient()
    .getContainerClient(container)
    .getBlockBlobClient(thumbKey)
    .uploadData(thumb, { blobHTTPHeaders: { blobContentType: "image/webp" } });

  context.log(`サムネイル生成: ${thumbKey} (${thumb.length} bytes)`);
}

// Blobトリガー登録。%STORAGE_CONTAINER% は環境変数展開。selfies/ 配下のみ監視し
// 出力先の thumbnails/ は監視対象外にすることで再発火を防ぐ。
app.storageBlob("selfieThumbnail", {
  path: "%STORAGE_CONTAINER%/selfies/{room}/{name}",
  connection: "StorageConnection",
  // Flex Consumption は BlobTrigger のソースに EventGrid のみ対応（ポーリング型は不可）。
  // 別途、Storageアカウントに Blob Created の Event Grid サブスクリプションが必要。
  source: "EventGrid",
  handler: selfieThumbnail,
});
