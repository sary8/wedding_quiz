import { Hono } from "hono";
import { createReadStream, existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { nanoid } from "nanoid";
import { stream } from "hono/streaming";
import { readFile } from "fs/promises";

export const mediaRoutes = new Hono();

const UPLOAD_DIR = "./uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm"]);

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

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${nanoid(16)}${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  await writeFile(filepath, buffer);

  return c.json({ url: `/api/media/${filename}` }, 201);
});

// 自撮り画像アップロード (base64)
mediaRoutes.post("/selfie", async (c) => {
  const body = await c.req.json<{ data: string }>();

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

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `selfie_${nanoid(16)}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  return c.json({ url: `/api/media/${filename}`, filename }, 201);
});

// メディア配信
mediaRoutes.get("/:filename", async (c) => {
  const rawFilename = c.req.param("filename");
  const filename = decodeURIComponent(rawFilename);

  // パストラバーサル防止
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\") || filename !== rawFilename) {
    return c.json({ error: "不正なファイル名です" }, 400);
  }

  const filepath = join(UPLOAD_DIR, filename);
  if (!existsSync(filepath)) {
    return c.json({ error: "ファイルが見つかりません" }, 404);
  }

  const ext = extname(filename).toLowerCase();
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

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
});
