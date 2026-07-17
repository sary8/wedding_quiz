import { describe, it, expect, afterEach } from "vitest";
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

  it("blob:（ローカルプレビュー用objectURL）→ そのまま返す", () => {
    expect(sanitizeMediaUrl("blob:http://localhost/abc-123")).toBe("blob:http://localhost/abc-123");
  });

  describe("VITE_API_URL設定時（SWA+App Serviceの別オリジン構成）", () => {
    const ORIGINAL = import.meta.env.VITE_API_URL;

    afterEach(() => {
      import.meta.env.VITE_API_URL = ORIGINAL;
    });

    it("相対パスはAPIオリジン付き絶対URLに解決される", () => {
      import.meta.env.VITE_API_URL = "https://quiz-prod.example.azurewebsites.net";
      expect(sanitizeMediaUrl("/api/media/q_1_abc.jpg")).toBe(
        "https://quiz-prod.example.azurewebsites.net/api/media/q_1_abc.jpg"
      );
    });

    it("絶対URLはそのまま（二重前置しない）", () => {
      import.meta.env.VITE_API_URL = "https://quiz-prod.example.azurewebsites.net";
      expect(sanitizeMediaUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    });
  });
});
