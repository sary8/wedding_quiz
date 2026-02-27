import { describe, it, expect } from "vitest";
import { sanitizeMediaUrl } from "./sanitizeUrl";

describe("sanitizeMediaUrl", () => {
  it("null → null", () => {
    expect(sanitizeMediaUrl(null)).toBeNull();
  });

  it("undefined → null", () => {
    expect(sanitizeMediaUrl(undefined)).toBeNull();
  });

  it("空文字 → null", () => {
    expect(sanitizeMediaUrl("")).toBeNull();
  });

  it("相対パス /api/media/xxx → そのまま返す", () => {
    expect(sanitizeMediaUrl("/api/media/abc123.jpg")).toBe("/api/media/abc123.jpg");
  });

  it("相対パス / → そのまま返す", () => {
    expect(sanitizeMediaUrl("/")).toBe("/");
  });

  it("https URL → そのまま返す", () => {
    expect(sanitizeMediaUrl("https://cdn.example.com/image.jpg")).toBe("https://cdn.example.com/image.jpg");
  });

  it("http URL → そのまま返す", () => {
    expect(sanitizeMediaUrl("http://localhost:3001/api/media/file.png")).toBe("http://localhost:3001/api/media/file.png");
  });

  it("javascript: → null", () => {
    expect(sanitizeMediaUrl("javascript:alert(1)")).toBeNull();
  });

  it("data: → null", () => {
    expect(sanitizeMediaUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("ftp: → null", () => {
    expect(sanitizeMediaUrl("ftp://example.com/file")).toBeNull();
  });

  it("不正なURL → null", () => {
    expect(sanitizeMediaUrl("not a url")).toBeNull();
  });
});
