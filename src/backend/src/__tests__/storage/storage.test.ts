import { describe, it, expect, vi } from "vitest";
import { unlink } from "fs/promises";
import { createStorageDriver } from "../../storage/index.js";
import { LocalStorageDriver } from "../../storage/local.js";
import {
  BlobStorageDriver,
  type ContainerClientLike,
  type BlockBlobClientLike,
} from "../../storage/blob.js";

// 構文的に有効な接続文字列（ネットワークアクセスは発生しない）
const FAKE_CONNECTION_STRING =
  "DefaultEndpointsProtocol=https;AccountName=testacct;AccountKey=dGVzdGtleQ==;EndpointSuffix=core.windows.net";

describe("createStorageDriver", () => {
  it("STORAGE_DRIVER未設定 → LocalStorageDriver", () => {
    expect(createStorageDriver({})).toBeInstanceOf(LocalStorageDriver);
  });

  it("STORAGE_DRIVER=local → LocalStorageDriver", () => {
    expect(createStorageDriver({ STORAGE_DRIVER: "local" })).toBeInstanceOf(LocalStorageDriver);
  });

  it("STORAGE_DRIVER=blob + 接続文字列 → BlobStorageDriver", () => {
    const driver = createStorageDriver({
      STORAGE_DRIVER: "blob",
      AZURE_STORAGE_CONNECTION_STRING: FAKE_CONNECTION_STRING,
    });
    expect(driver).toBeInstanceOf(BlobStorageDriver);
  });

  it("STORAGE_DRIVER=blob + アカウント名（マネージドID認証）→ BlobStorageDriver", () => {
    const driver = createStorageDriver({
      STORAGE_DRIVER: "blob",
      AZURE_STORAGE_ACCOUNT: "testacct",
    });
    expect(driver).toBeInstanceOf(BlobStorageDriver);
  });

  it("STORAGE_DRIVER=blob で設定不足 → throw（fail-fast）", () => {
    expect(() => createStorageDriver({ STORAGE_DRIVER: "blob" })).toThrow(
      /AZURE_STORAGE_CONNECTION_STRING|AZURE_STORAGE_ACCOUNT/
    );
  });

  it("未知のSTORAGE_DRIVER → throw（タイポでlocalに落ちる事故防止）", () => {
    expect(() => createStorageDriver({ STORAGE_DRIVER: "blobb" })).toThrow(/未知/);
  });
});

describe("LocalStorageDriver", () => {
  const driver = new LocalStorageDriver("./uploads");

  it("save → read → delete のラウンドトリップ", async () => {
    const filename = `test_storage_${Date.now()}.png`;
    const data = Buffer.from("test-data");
    try {
      await driver.save(filename, data);

      const read = await driver.read(filename);
      expect(read).not.toBeNull();
      expect(read!.toString()).toBe("test-data");

      expect(await driver.totalSize()).toBeGreaterThanOrEqual(data.length);

      await driver.delete(filename);
      expect(await driver.read(filename)).toBeNull();
    } finally {
      await unlink(`./uploads/${filename}`).catch(() => {});
    }
  });

  it("存在しないファイルのread → null、delete → エラーにならない", async () => {
    expect(await driver.read("no_such_file.png")).toBeNull();
    await expect(driver.delete("no_such_file.png")).resolves.toBeUndefined();
  });

  it("フォルダ付きキーの save/read/delete と再帰totalSize", async () => {
    const key = `questions/999/test_nested_${Date.now()}.png`;
    const data = Buffer.from("nested");
    try {
      await driver.save(key, data);

      const read = await driver.read(key);
      expect(read!.toString()).toBe("nested");

      // サブフォルダ内のファイルも合計に含まれること
      expect(await driver.totalSize()).toBeGreaterThanOrEqual(data.length);

      await driver.delete(key);
      expect(await driver.read(key)).toBeNull();
    } finally {
      await unlink(`./uploads/${key}`).catch(() => {});
    }
  });
});

describe("BlobStorageDriver", () => {
  function makeFakeContainer(blobs: Record<string, Buffer> = {}) {
    const createIfNotExists = vi.fn().mockResolvedValue(undefined);
    const uploadData = vi.fn(
      async (data: Buffer, _options?: { metadata?: Record<string, string> }) => data
    );
    const deleteIfExists = vi.fn().mockResolvedValue(undefined);

    const container: ContainerClientLike = {
      createIfNotExists,
      getBlockBlobClient(name: string): BlockBlobClientLike {
        return {
          uploadData: async (data: Buffer, options?: { metadata?: Record<string, string> }) => {
            blobs[name] = data;
            return uploadData(data, options);
          },
          downloadToBuffer: async () => {
            const found = blobs[name];
            if (!found) throw Object.assign(new Error("not found"), { statusCode: 404 });
            return found;
          },
          deleteIfExists: async () => {
            delete blobs[name];
            return deleteIfExists();
          },
        };
      },
      async *listBlobsFlat() {
        for (const data of Object.values(blobs)) {
          yield { properties: { contentLength: data.length } };
        }
      },
    };
    return { container, createIfNotExists, uploadData, deleteIfExists };
  }

  it("save → read → delete がフェイクコンテナに反映される", async () => {
    const { container } = makeFakeContainer();
    const driver = new BlobStorageDriver(container);
    const data = Buffer.from("blob-data");

    await driver.save("a.png", data);
    const read = await driver.read("a.png");
    expect(read!.toString()).toBe("blob-data");

    await driver.delete("a.png");
    expect(await driver.read("a.png")).toBeNull();
  });

  it("saveはメタデータをblobへ渡す（トレーサビリティ）", async () => {
    const { container, uploadData } = makeFakeContainer();
    const driver = new BlobStorageDriver(container);

    await driver.save("questions/12/q_12_a.png", Buffer.from("x"), {
      kind: "question",
      quizid: "12",
      originalname: "photo.png",
    });
    expect(uploadData).toHaveBeenCalledWith(expect.anything(), {
      metadata: { kind: "question", quizid: "12", originalname: "photo.png" },
    });
  });

  it("コンテナ作成は初回saveの一度だけ（メモ化）", async () => {
    const { container, createIfNotExists } = makeFakeContainer();
    const driver = new BlobStorageDriver(container);

    await driver.save("a.png", Buffer.from("1"));
    await driver.save("b.png", Buffer.from("2"));
    expect(createIfNotExists).toHaveBeenCalledTimes(1);
  });

  it("存在しないblobのread → null（404）", async () => {
    const { container } = makeFakeContainer();
    const driver = new BlobStorageDriver(container);
    expect(await driver.read("missing.png")).toBeNull();
  });

  it("404以外のエラーは透過する", async () => {
    const container = makeFakeContainer().container;
    container.getBlockBlobClient = () => ({
      uploadData: async () => undefined,
      downloadToBuffer: async () => {
        throw Object.assign(new Error("auth failed"), { statusCode: 403 });
      },
      deleteIfExists: async () => undefined,
    });
    const driver = new BlobStorageDriver(container);
    await expect(driver.read("x.png")).rejects.toThrow("auth failed");
  });

  it("totalSize は全blobの合計を返す", async () => {
    const { container } = makeFakeContainer({
      "a.png": Buffer.alloc(100),
      "b.mp4": Buffer.alloc(250),
    });
    const driver = new BlobStorageDriver(container);
    expect(await driver.totalSize()).toBe(350);
  });

  it("コンテナ未作成のtotalSize → 0（404）", async () => {
    const container = makeFakeContainer().container;
    container.listBlobsFlat = () => {
      throw Object.assign(new Error("container not found"), { statusCode: 404 });
    };
    const driver = new BlobStorageDriver(container);
    expect(await driver.totalSize()).toBe(0);
  });
});
