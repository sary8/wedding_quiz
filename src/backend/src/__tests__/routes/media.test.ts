import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "fs";
import { writeFile, mkdir, rm, unlink } from "fs/promises";
import { join } from "path";
import { mediaRoutes } from "../../routes/media.js";

const UPLOAD_DIR = "./uploads";
const createdFiles: string[] = [];

beforeAll(async () => {
  await mkdir(UPLOAD_DIR, { recursive: true });
});

afterAll(async () => {
  for (const file of createdFiles) {
    try {
      await unlink(join(UPLOAD_DIR, file));
    } catch {
      // ignore
    }
  }
});

function trackFile(filename: string) {
  createdFiles.push(filename);
}

describe("media routes", () => {
  describe("POST /selfie", () => {
    it("正常なbase64 JPEG → 201、filename返却", async () => {
      // 1x1 JPEG (smallest valid JPEG)
      const jpegBase64 =
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAFRABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=";
      const data = `data:image/jpeg;base64,${jpegBase64}`;

      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.filename).toMatch(/^selfie_.*\.jpg$/);
      expect(body.url).toMatch(/^\/api\/media\/selfie_.*\.jpg$/);
      trackFile(body.filename);
    });

    it("正常なbase64 PNG → 201、ext=png", async () => {
      // 1x1 PNG
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const data = `data:image/png;base64,${pngBase64}`;

      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.filename).toMatch(/^selfie_.*\.png$/);
      trackFile(body.filename);
    });

    it("データなし → 400", async () => {
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "" }),
      });
      expect(res.status).toBe(400);
    });

    it("不正なbase64形式 → 400", async () => {
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "not-a-valid-data-url" }),
      });
      expect(res.status).toBe(400);
    });

    it("サイズ超過 → 400", async () => {
      // base64 decodes to 3/4 of string length. Need >5MB decoded = >6.67MB base64
      const largeData = "A".repeat(8 * 1024 * 1024);
      const data = `data:image/jpeg;base64,${largeData}`;

      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /:filename", () => {
    it("存在するファイル → 正しいContent-Type + immutableキャッシュ", async () => {
      const testFilename = "test_serve_file.jpg";
      const filepath = join(UPLOAD_DIR, testFilename);
      await writeFile(filepath, Buffer.from("fake-jpeg-content"));
      trackFile(testFilename);

      const res = await mediaRoutes.request(`/${testFilename}`, {
        method: "GET",
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    });

    it("未知の拡張子 → application/octet-stream", async () => {
      const testFilename = "test_unknown.bin";
      const filepath = join(UPLOAD_DIR, testFilename);
      await writeFile(filepath, Buffer.from("binary-content"));
      trackFile(testFilename);

      const res = await mediaRoutes.request(`/${testFilename}`, {
        method: "GET",
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    });

    it("パストラバーサル(..) → 400", async () => {
      // Hono's /:filename matches single path segment, so use a filename
      // containing ".." without path separators
      const res = await mediaRoutes.request("/..secret.jpg", {
        method: "GET",
      });
      expect(res.status).toBe(400);
    });

    it("パストラバーサル(\\) → 400", async () => {
      // URL-encoded backslash (%5C) gets decoded in the filename param
      const res = await mediaRoutes.request("/test%5Cfile.jpg", {
        method: "GET",
      });
      expect(res.status).toBe(400);
    });

    it("パストラバーサル(%2E%2E) → 400", async () => {
      const res = await mediaRoutes.request("/%2E%2Esecret.jpg", {
        method: "GET",
      });
      expect(res.status).toBe(400);
    });

    it("パストラバーサル(%2F) → 400", async () => {
      const res = await mediaRoutes.request("/etc%2Fpasswd", {
        method: "GET",
      });
      expect(res.status).toBe(400);
    });

    it("存在しないファイル → 404", async () => {
      const res = await mediaRoutes.request("/nonexistent_file.jpg", {
        method: "GET",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /upload", () => {
    it("許可された拡張子 → 201", async () => {
      // 有効なJPEGマジックバイト (FF D8 FF) + ダミーデータ
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, ...Array(20).fill(0)]);
      const file = new File(
        [jpegBytes],
        "test.jpg",
        { type: "image/jpeg" }
      );
      const formData = new FormData();
      formData.append("file", file);

      const res = await mediaRoutes.request("/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.url).toMatch(/^\/api\/media\/.*\.jpg$/);

      // ファイル名を取得してクリーンアップ用に追跡
      const filename = body.url.replace("/api/media/", "");
      trackFile(filename);
    });

    it("許可されない拡張子 → 400", async () => {
      const file = new File(
        [Buffer.from("fake-content")],
        "test.exe",
        { type: "application/octet-stream" }
      );
      const formData = new FormData();
      formData.append("file", file);

      const res = await mediaRoutes.request("/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
    });

    it("サイズ超過 → 400", async () => {
      // 6MB file
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, "x");
      const file = new File([largeBuffer], "large.jpg", {
        type: "image/jpeg",
      });
      const formData = new FormData();
      formData.append("file", file);

      const res = await mediaRoutes.request("/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
    });

    it("拡張子と内容が不一致 → 400", async () => {
      // .jpgだがPNGのマジックバイト
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array(20).fill(0)]);
      const file = new File(
        [pngBytes],
        "fake.jpg",
        { type: "image/jpeg" }
      );
      const formData = new FormData();
      formData.append("file", file);

      const res = await mediaRoutes.request("/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("拡張子と一致しません");
    });

    it("ファイルなし → 400", async () => {
      const formData = new FormData();
      formData.append("file", "not-a-file-string");

      const res = await mediaRoutes.request("/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
    });
  });
});
