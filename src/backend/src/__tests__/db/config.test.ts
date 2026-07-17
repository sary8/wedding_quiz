import { describe, it, expect } from "vitest";
import {
  resolveDbConfig,
  isFileUrl,
  localDataDir,
  DEFAULT_DB_URL,
} from "../../db/config.js";

describe("resolveDbConfig", () => {
  it("DATABASE_URL未設定 → ローカルファイルDBにフォールバック", () => {
    expect(resolveDbConfig({})).toEqual({ url: DEFAULT_DB_URL });
  });

  it("空白のみのDATABASE_URL → デフォルト扱い", () => {
    expect(resolveDbConfig({ DATABASE_URL: "   " })).toEqual({ url: DEFAULT_DB_URL });
  });

  it("DATABASE_URL指定 → 前後空白をトリムして使用", () => {
    expect(resolveDbConfig({ DATABASE_URL: " libsql://wq.turso.io " })).toEqual({
      url: "libsql://wq.turso.io",
    });
  });

  it("DATABASE_AUTH_TOKEN指定 → authTokenに設定", () => {
    expect(
      resolveDbConfig({
        DATABASE_URL: "libsql://wq.turso.io",
        DATABASE_AUTH_TOKEN: "tok-123",
      })
    ).toEqual({ url: "libsql://wq.turso.io", authToken: "tok-123" });
  });

  it("空のDATABASE_AUTH_TOKEN → authTokenを含めない", () => {
    expect(resolveDbConfig({ DATABASE_AUTH_TOKEN: "" })).toEqual({ url: DEFAULT_DB_URL });
    expect(resolveDbConfig({ DATABASE_AUTH_TOKEN: "" })).not.toHaveProperty("authToken");
  });
});

describe("isFileUrl", () => {
  it("file: URL → true", () => {
    expect(isFileUrl("file:./data/wedding_quiz.db")).toBe(true);
    expect(isFileUrl("file::memory:")).toBe(true);
  });

  it("リモートURL → false", () => {
    expect(isFileUrl("libsql://wq.turso.io")).toBe(false);
    expect(isFileUrl("https://wq.turso.io")).toBe(false);
  });
});

describe("localDataDir", () => {
  it("ディレクトリ付きfile: URL → ディレクトリを返す", () => {
    expect(localDataDir("file:./data/wedding_quiz.db")).toBe("./data");
  });

  it("インメモリDB → null", () => {
    expect(localDataDir("file::memory:")).toBe(null);
  });

  it("リモートURL → null", () => {
    expect(localDataDir("libsql://wq.turso.io")).toBe(null);
  });

  it("ディレクトリなしのfile: URL → null", () => {
    expect(localDataDir("file:wedding_quiz.db")).toBe(null);
  });
});
