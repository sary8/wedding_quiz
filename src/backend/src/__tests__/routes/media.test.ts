import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "fs";
import { writeFile, mkdir, rm, unlink } from "fs/promises";
import { join } from "path";

// quizService モック
vi.mock("../../services/quizService.js", () => ({
  getQuizByRoom: vi.fn(),
}));

import { mediaRoutes, deleteMediaFile, storageKeyFor } from "../../routes/media.js";
import { getQuizByRoom } from "../../services/quizService.js";

const mockGetQuizByRoom = vi.mocked(getQuizByRoom);

const UPLOAD_DIR = "./uploads";
const createdFiles: string[] = [];

beforeAll(async () => {
  await mkdir(UPLOAD_DIR, { recursive: true });
});

afterAll(async () => {
  for (const file of createdFiles) {
    // フォルダ付きキーにも対応するため実装側の削除経路を使う
    await deleteMediaFile(file).catch(() => {});
  }
});

function trackFile(filename: string) {
  createdFiles.push(filename);
}

describe("storageKeyFor", () => {
  it("問題画像 → questions/{quizId}/", () => {
    expect(storageKeyFor("q_12_abc.jpg")).toBe("questions/12/q_12_abc.jpg");
    expect(storageKeyFor("q_bank_abc.png")).toBe("questions/bank/q_bank_abc.png");
  });

  it("選択肢画像 → choices/{quizId}/", () => {
    expect(storageKeyFor("c_3_xyz.webp")).toBe("choices/3/c_3_xyz.webp");
  });

  it("セルフィー → selfies/{roomCode}/", () => {
    expect(storageKeyFor("selfie_123456_abc.jpg")).toBe("selfies/123456/selfie_123456_abc.jpg");
  });

  it("旧形式はルート直下（後方互換）", () => {
    expect(storageKeyFor("V1StGXR8z5jdHi.png")).toBe("V1StGXR8z5jdHi.png");
    expect(storageKeyFor("selfie_V1StGXR8z5jdHi.jpg")).toBe("selfie_V1StGXR8z5jdHi.jpg");
  });
});

describe("media routes", () => {
  describe("POST /selfie", () => {
    // 1x1 JPEG (smallest valid JPEG)
    const jpegBase64 =
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAFRABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=";

    beforeEach(() => {
      mockGetQuizByRoom.mockReset();
    });

    it("正常なbase64 JPEG + roomCode → 201、filename返却", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "lobby" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const data = `data:image/jpeg;base64,${jpegBase64}`;

      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, roomCode: "123456" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.filename).toMatch(/^selfie_.*\.jpg$/);
      expect(body.url).toMatch(/^\/api\/media\/selfie_.*\.jpg$/);
      trackFile(body.filename);
    });

    it("セルフィーはルームコード入りの名前になり、そのまま配信できる", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "lobby" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const data = `data:image/jpeg;base64,${jpegBase64}`;

      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, roomCode: "123456" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.filename).toMatch(/^selfie_123456_[A-Za-z0-9_-]+\.jpg$/);
      trackFile(body.filename);

      const getRes = await mediaRoutes.request(`/${body.filename}`);
      expect(getRes.status).toBe(200);
    });

    it("正常なbase64 PNG + in_progress ルーム → 201", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "in_progress" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const data = `data:image/png;base64,${pngBase64}`;

      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, roomCode: "123456" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.filename).toMatch(/^selfie_.*\.png$/);
      trackFile(body.filename);
    });

    it("roomCode なし → 400", async () => {
      const data = `data:image/jpeg;base64,${jpegBase64}`;
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("ルームコード");
    });

    it("存在しないルーム → 404", async () => {
      mockGetQuizByRoom.mockResolvedValue(undefined);
      const data = `data:image/jpeg;base64,${jpegBase64}`;
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, roomCode: "999999" }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("ルームが見つかりません");
    });

    it("draft ステータスのルーム → 400", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "draft" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const data = `data:image/jpeg;base64,${jpegBase64}`;
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, roomCode: "123456" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("参加を受け付けていません");
    });

    it("finished ステータスのルーム → 400", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "finished" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const data = `data:image/jpeg;base64,${jpegBase64}`;
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, roomCode: "123456" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("参加を受け付けていません");
    });

    it("データなし → 400", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "lobby" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "", roomCode: "123456" }),
      });
      expect(res.status).toBe(400);
    });

    it("不正なbase64形式 → 400", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "lobby" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "not-a-valid-data-url", roomCode: "123456" }),
      });
      expect(res.status).toBe(400);
    });

    it("サイズ超過 → 400", async () => {
      mockGetQuizByRoom.mockResolvedValue({ status: "lobby" } as ReturnType<typeof getQuizByRoom> extends Promise<infer T> ? T : never);
      const largeData = "A".repeat(8 * 1024 * 1024);
      const data = `data:image/jpeg;base64,${largeData}`;

      const res = await mediaRoutes.request("/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, roomCode: "123456" }),
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
      const res = await mediaRoutes.request("/..secret.jpg", {
        method: "GET",
      });
      expect(res.status).toBe(400);
    });

    it("パストラバーサル(\\) → 400", async () => {
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

    it("不正なURIエンコード → 400", async () => {
      const res = await mediaRoutes.request("/%FF", {
        method: "GET",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("不正なファイル名");
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

      const filename = body.url.replace("/api/media/", "");
      trackFile(filename);
    });

    it("kind=question + quizId → q_{quizId}_ 名になり、そのまま配信できる", async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(16).fill(0)]);
      const formData = new FormData();
      formData.append("file", new File([jpegBytes], "新郎の写真.jpg", { type: "image/jpeg" }));
      formData.append("kind", "question");
      formData.append("quizId", "12");

      const res = await mediaRoutes.request("/upload", { method: "POST", body: formData });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.url).toMatch(/^\/api\/media\/q_12_[A-Za-z0-9_-]+\.jpg$/);

      const filename = body.url.replace("/api/media/", "");
      trackFile(filename);

      // フォルダ付きキーに保存されたファイルがURL経由で読めること（保存→導出→配信の往復）
      const getRes = await mediaRoutes.request(`/${filename}`);
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get("Content-Type")).toBe("image/jpeg");
    });

    it("kind=choice → c_ プレフィックス、quizIdなし → scope=bank", async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(16).fill(0)]);
      const formData = new FormData();
      formData.append("file", new File([jpegBytes], "choice.jpg", { type: "image/jpeg" }));
      formData.append("kind", "choice");

      const res = await mediaRoutes.request("/upload", { method: "POST", body: formData });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.url).toMatch(/^\/api\/media\/c_bank_[A-Za-z0-9_-]+\.jpg$/);
      trackFile(body.url.replace("/api/media/", ""));
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

describe("deleteMediaFile", () => {
  it("ファイルが存在する場合は削除する", async () => {
    const testFilename = "delete_test_file.jpg";
    const filepath = join(UPLOAD_DIR, testFilename);
    await writeFile(filepath, Buffer.from("test-content"));
    expect(existsSync(filepath)).toBe(true);

    await deleteMediaFile(testFilename);
    expect(existsSync(filepath)).toBe(false);
  });

  it("URLパスからファイル名を抽出して削除する", async () => {
    const testFilename = "delete_url_test.jpg";
    const filepath = join(UPLOAD_DIR, testFilename);
    await writeFile(filepath, Buffer.from("test-content"));
    expect(existsSync(filepath)).toBe(true);

    await deleteMediaFile(`/api/media/${testFilename}`);
    expect(existsSync(filepath)).toBe(false);
  });

  it("nullの場合は何もしない", async () => {
    await expect(deleteMediaFile(null)).resolves.toBeUndefined();
  });

  it("存在しないファイルでもエラーにならない", async () => {
    await expect(deleteMediaFile("nonexistent_file.jpg")).resolves.toBeUndefined();
  });

  it("パストラバーサルを含む場合は何もしない", async () => {
    await expect(deleteMediaFile("../etc/passwd")).resolves.toBeUndefined();
  });

  it("許容外の拡張子は削除しない", async () => {
    const filepath = join(UPLOAD_DIR, "malicious.exe");
    await writeFile(filepath, Buffer.from("bad"));
    createdFiles.push(filepath);

    await deleteMediaFile("malicious.exe");
    expect(existsSync(filepath)).toBe(true);
  });

  it("拡張子なしのファイル名は削除しない", async () => {
    await expect(deleteMediaFile("noextension")).resolves.toBeUndefined();
  });

  it("空文字は何もしない", async () => {
    await expect(deleteMediaFile("")).resolves.toBeUndefined();
  });
});

describe("ストレージ上限", () => {
  it("MAX_STORAGE_MB環境変数がモジュール読み込み時に評価される", async () => {
    const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, ...Array(20).fill(0)]);
    const file = new File([jpegBytes], "test_storage.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);

    const res = await mediaRoutes.request("/upload", {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    const filename = body.url.replace("/api/media/", "");
    createdFiles.push(filename);
  });
});
