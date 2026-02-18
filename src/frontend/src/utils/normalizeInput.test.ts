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
  it("全角数字を半角に変換して数字のみ抽出する", () => {
    expect(normalizeRoomCode("１２３４５６")).toBe("123456");
  });

  it("英字を除去する", () => {
    expect(normalizeRoomCode("abc123")).toBe("123");
  });

  it("数字以外を除去する", () => {
    expect(normalizeRoomCode("12-34_56")).toBe("123456");
  });

  it("日本語文字を除去する", () => {
    expect(normalizeRoomCode("あ1い2う3")).toBe("123");
  });

  it("空文字列を処理する", () => {
    expect(normalizeRoomCode("")).toBe("");
  });

  it("スペースを除去する", () => {
    expect(normalizeRoomCode("12 34")).toBe("1234");
  });

  it("数字のみ保持する", () => {
    expect(normalizeRoomCode("0123456789")).toBe("0123456789");
  });
});
