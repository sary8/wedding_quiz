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

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${nanoid(16)}${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
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
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > MAX_FILE_SIZE) {
    return c.json({ error: "画像サイズが5MBを超えています" }, 400);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `selfie_${nanoid(16)}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  return c.json({ url: `/api/media/${filename}`, filename }, 201);
});

// メディア配信
mediaRoutes.get("/:filename", async (c) => {
  const filename = c.req.param("filename");

  // パストラバーサル防止
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
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
