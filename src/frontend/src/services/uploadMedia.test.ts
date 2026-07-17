import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadMedia } from "./api";

describe("uploadMedia クライアント側検証", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("5MB超のファイルはfetchせずに即エラー", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });

    await expect(uploadMedia(big, { kind: "question", quizId: 1 })).rejects.toThrow(/5MB/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("5MB以下は kind / quizId 付きで送信される", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ url: "/api/media/c_12_x.jpg" }), { status: 201 })
    );
    const small = new File([new Uint8Array(10)], "small.jpg", { type: "image/jpeg" });

    const result = await uploadMedia(small, { kind: "choice", quizId: 12 });
    expect(result.url).toBe("/api/media/c_12_x.jpg");

    const sentBody = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(sentBody.get("kind")).toBe("choice");
    expect(sentBody.get("quizId")).toBe("12");
  });

  it("quizIdなし（バンク問題）はquizIdフィールドを送らない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ url: "/api/media/q_bank_x.jpg" }), { status: 201 })
    );
    const small = new File([new Uint8Array(10)], "small.jpg", { type: "image/jpeg" });

    await uploadMedia(small, { kind: "question" });
    const sentBody = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(sentBody.get("quizId")).toBeNull();
  });
});
