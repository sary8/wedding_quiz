import { Hono } from "hono";
import { existsSync } from "fs";
import { writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { join, extname, basename } from "path";
import { nanoid } from "nanoid";
import { readFile } from "fs/promises";

export const mediaRoutes = new Hono();

const UPLOAD_DIR = "./uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_STORAGE_BYTES = (Number(process.env.MAX_STORAGE_MB) || 500) * 1024 * 1024; // デフォルト500MB
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm"]);

// アップロード時の命名パターン (nanoid + 許容拡張子) にマッチするファイルのみ削除許可
const SAFE_FILENAME_RE = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|gif|webp|mp4|webm)$/;

/**
 * メディアファイルを削除する。
 * URLパス (/api/media/xxx.jpg) またはファイル名 (xxx.jpg) を受け取る。
 */
export async function deleteMediaFile(fileNameOrUrl: string | null): Promise<void> {
  if (!fileNameOrUrl) return;
  const filename = basename(fileNameOrUrl);
  if (!filename || !SAFE_FILENAME_RE.test(filename)) return;
  const filepath = join(UPLOAD_DIR, filename);
  await unlink(filepath).catch(() => {});
}

// ストレージ使用量チェック
async function getStorageUsage(): Promise<number> {
  if (!existsSync(UPLOAD_DIR)) return 0;
  const files = await readdir(UPLOAD_DIR);
  let total = 0;
  for (const file of files) {
    const fileStat = await stat(join(UPLOAD_DIR, file)).catch(() => null);
    if (fileStat?.isFile()) total += fileStat.size;
  }
  return total;
}

// IP単位のレート制限（アップロード用）
const RATE_LIMIT_WINDOW_MS = 60_000; // 1分
const RATE_LIMIT_MAX = 20; // 1分あたり最大20リクエスト
const uploadRateMap = new Map<string, { count: number; resetAt: number }>();

function checkUploadRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = uploadRateMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    uploadRateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// 定期クリーンアップ（期限切れエントリを削除）
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of uploadRateMap) {
    if (now >= entry.resetAt) uploadRateMap.delete(ip);
  }
}, 60_000);

// マジックバイトによるファイルタイプ検証
function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    case ".png":
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    case ".gif":
      return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    case ".webp":
      return buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
        && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    case ".mp4":
      // ftyp box
      return buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
    case ".webm":
      // EBML header
      return buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
    default:
      return false;
  }
}

// メディアアップロード
mediaRoutes.post("/upload", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkUploadRateLimit(ip)) {
    return c.json({ error: "アップロードが多すぎます。しばらくしてから再試行してください" }, 429);
  }

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!(file instanceof File)) {
    return c.json({ error: "ファイルが見つかりません" }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "ファイルサイズが5MBを超えています" }, 400);
  }

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json({ error: "許可されていないファイル形式です" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!validateMagicBytes(buffer, ext)) {
    return c.json({ error: "ファイルの内容が拡張子と一致しません" }, 400);
  }

  // ストレージ上限チェック
  const usage = await getStorageUsage();
  if (usage + buffer.length > MAX_STORAGE_BYTES) {
    return c.json({ error: "ストレージ容量の上限に達しました" }, 413);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${nanoid(16)}${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  await writeFile(filepath, buffer);

  return c.json({ url: `/api/media/${filename}` }, 201);
});

// 自撮り画像アップロード (base64)
mediaRoutes.post("/selfie", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkUploadRateLimit(ip)) {
    return c.json({ error: "アップロードが多すぎます。しばらくしてから再試行してください" }, 429);
  }

  const body = await c.req.json<{ data: string }>().catch(() => null);
  if (!body) {
    return c.json({ error: "リクエストの形式が不正です" }, 400);
  }

  if (!body.data) {
    return c.json({ error: "画像データが見つかりません" }, 400);
  }

  // data:image/jpeg;base64,... の形式からデータ部分を抽出
  const match = body.data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    return c.json({ error: "不正な画像データ形式です" }, 400);
  }

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const dotExt = `.${ext}`;
  if (!ALLOWED_EXTENSIONS.has(dotExt)) {
    return c.json({ error: "許可されていない画像形式です" }, 400);
  }

  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > MAX_FILE_SIZE) {
    return c.json({ error: "画像サイズが5MBを超えています" }, 400);
  }

  if (!validateMagicBytes(buffer, dotExt)) {
    return c.json({ error: "画像データの内容が形式と一致しません" }, 400);
  }

  // ストレージ上限チェック
  const usage = await getStorageUsage();
  if (usage + buffer.length > MAX_STORAGE_BYTES) {
    return c.json({ error: "ストレージ容量の上限に達しました" }, 413);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `selfie_${nanoid(16)}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  return c.json({ url: `/api/media/${filename}`, filename }, 201);
});

// メディア配信
mediaRoutes.get("/:filename", async (c) => {
  const rawFilename = c.req.param("filename");
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawFilename);
  } catch {
    return c.json({ error: "不正なファイル名です" }, 400);
  }

  // パストラバーサル防止: basename + バックスラッシュ明示チェック（Linuxのbasenameは\を無視するため）
  const safe = basename(decoded);
  if (!safe || safe !== decoded || safe.includes("..") || decoded.includes("\\")) {
    return c.json({ error: "不正なファイル名です" }, 400);
  }

  const filepath = join(UPLOAD_DIR, safe);
  if (!existsSync(filepath)) {
    return c.json({ error: "ファイルが見つかりません" }, 404);
  }

  const ext = extname(safe).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };

  const contentType = contentTypes[ext] || "application/octet-stream";
  const data = await readFile(filepath);

  // ファイル名にnanoidハッシュを含むためimmutableで長期キャッシュ可
  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
