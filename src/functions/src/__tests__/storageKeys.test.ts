import { describe, it, expect } from "vitest";
import { isSelfieBlob, thumbnailKeyFor } from "../lib/storageKeys.js";

describe("isSelfieBlob", () => {
  it("selfies/ 配下は対象", () => {
    expect(isSelfieBlob("selfies/AB12/selfie_AB12_x.jpg")).toBe(true);
  });
  it("thumbnails/ は対象外（再発火防止）", () => {
    expect(isSelfieBlob("thumbnails/selfies/AB12/selfie_AB12_x.webp")).toBe(false);
  });
  it("questions/ など他フォルダは対象外", () => {
    expect(isSelfieBlob("questions/12/q_12_x.png")).toBe(false);
  });
});

describe("thumbnailKeyFor", () => {
  it("拡張子をwebpに変えて thumbnails/ 配下へ", () => {
    expect(thumbnailKeyFor("selfies/AB12/selfie_AB12_x.jpg")).toBe(
      "thumbnails/selfies/AB12/selfie_AB12_x.webp"
    );
  });
  it("png も同様", () => {
    expect(thumbnailKeyFor("selfies/R/x.png")).toBe("thumbnails/selfies/R/x.webp");
  });
  it("拡張子なしキーは .webp を付す", () => {
    expect(thumbnailKeyFor("selfies/R/x")).toBe("thumbnails/selfies/R/x.webp");
  });
});
