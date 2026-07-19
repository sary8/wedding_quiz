import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { generateThumbnail } from "../lib/thumbnail.js";

async function makePng(width: number, height: number): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .png()
    .toBuffer();
}

describe("generateThumbnail", () => {
  it("大きい画像を指定幅のWebPに縮小する", async () => {
    const input = await makePng(1200, 900);
    const out = await generateThumbnail(input, { width: 320 });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(320);
    expect(out.length).toBeLessThan(input.length);
  });

  it("指定幅より小さい画像は拡大しない（withoutEnlargement）", async () => {
    const input = await makePng(200, 150);
    const out = await generateThumbnail(input, { width: 320 });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(200);
  });

  it("既定幅は320px", async () => {
    const input = await makePng(1000, 1000);
    const out = await generateThumbnail(input);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(320);
  });
});
