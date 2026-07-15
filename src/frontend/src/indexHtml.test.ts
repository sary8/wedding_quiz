import { describe, it, expect } from "vitest";
// Vite の ?raw / import.meta.glob で読む（node:fs 不要 = tsconfig.app の types を汚さない）
import html from "../index.html?raw";
import mainTsx from "./main.tsx?raw";
import robots from "../public/robots.txt?raw";

describe("index.html（Lighthouse 100点対応の回帰防止）", () => {
  it("meta description がある", () => {
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]+"/);
  });

  it("favicon（svg / ico / apple-touch-icon）のリンクがある", () => {
    expect(html).toContain('rel="icon" href="/favicon.svg"');
    expect(html).toContain('rel="icon" href="/favicon.ico"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
  });

  it("外部フォント（Google Fonts）を参照していない — フォントはセルフホスト", () => {
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
  });
});

describe("フォントのセルフホスト", () => {
  it("index.html が装飾書体 2 つを preload + インライン @font-face で宣言している", () => {
    for (const file of [
      "/fonts/great-vibes-latin-400-normal.woff2",
      "/fonts/cormorant-infant-latin-400-normal.woff2",
    ]) {
      expect(html).toContain(`<link rel="preload" as="font" type="font/woff2" crossorigin href="${file}" />`);
      expect(html).toContain(`src: url(${file}) format('woff2')`);
    }
    expect(html).toContain("font-family: 'Great Vibes'");
    expect(html).toContain("font-family: 'Cormorant Infant'");
  });

  it("日本語 Web フォントは使わない（システムフォントに任せる）", () => {
    // Noto Sans JP を Web フォント化すると @font-face 360宣言 / CSS +300KB で FCP が悪化する
    expect(mainTsx).not.toContain("@fontsource");
    expect(html).not.toContain("noto-sans-jp");
  });
});

describe("静的アプリシェル（index.html #root 内）", () => {
  it("JoinPage と同じタイトル・カードが先行描画される", () => {
    expect(html).toContain("Wedding Quiz</h1>");
    expect(html).toContain("Celebration Game");
    expect(html).toContain("ルームコード（6桁）");
    expect(html).toContain("参加する</button>");
  });
});

describe("public アセット", () => {
  const publicFiles = Object.keys(import.meta.glob("../public/*"));

  it.each(["favicon.svg", "favicon.ico", "apple-touch-icon.png", "robots.txt"])(
    "%s が存在する",
    (name) => {
      expect(publicFiles).toContain(`../public/${name}`);
    }
  );

  it("robots.txt が全クローラー許可の有効な構文", () => {
    expect(robots).toMatch(/^User-agent: \*/m);
    expect(robots).toMatch(/^Allow: \//m);
  });
});
