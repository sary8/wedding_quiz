import { describe, it, expect } from "vitest";
import { toHalfWidth, normalizeRoomCode } from "./normalizeInput";

describe("toHalfWidth", () => {
  it("全角英字を半角に変換する", () => {
    expect(toHalfWidth("Ａｂｃ")).toBe("Abc");
  });

  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
  });

  it("半角はそのまま返す", () => {
    expect(toHalfWidth("ABC123")).toBe("ABC123");
  });

  it("混在文字列を変換する", () => {
    expect(toHalfWidth("Ａ1Ｂ2")).toBe("A1B2");
  });

  it("全角記号も変換する", () => {
    expect(toHalfWidth("＠＃")).toBe("@#");
  });

  it("日本語はそのまま残る", () => {
    expect(toHalfWidth("あいう")).toBe("あいう");
  });
});

describe("normalizeRoomCode", () => {
  it("全角英数字を半角大文字に変換する", () => {
    expect(normalizeRoomCode("ａｂｃ１２３")).toBe("ABC123");
  });

  it("小文字を大文字にする", () => {
    expect(normalizeRoomCode("abcdef")).toBe("ABCDEF");
  });

  it("英数字以外を除去する", () => {
    expect(normalizeRoomCode("AB-CD_12")).toBe("ABCD12");
  });

  it("日本語文字を除去する", () => {
    expect(normalizeRoomCode("あABいC")).toBe("ABC");
  });

  it("空文字列を処理する", () => {
    expect(normalizeRoomCode("")).toBe("");
  });

  it("スペースを除去する", () => {
    expect(normalizeRoomCode("AB CD")).toBe("ABCD");
  });
});
