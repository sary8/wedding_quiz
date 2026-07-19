import { describe, it, expect } from "vitest";
import { isExpired, selectExpiredNames } from "../lib/retention.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-07-19T00:00:00Z");

describe("isExpired", () => {
  it("保持日数より古い → true", () => {
    expect(isExpired(new Date(now.getTime() - 8 * DAY), 7, now)).toBe(true);
  });
  it("保持日数以内 → false", () => {
    expect(isExpired(new Date(now.getTime() - 6 * DAY), 7, now)).toBe(false);
  });
  it("ちょうど境界（7日ちょうど）は未超過 → false", () => {
    expect(isExpired(new Date(now.getTime() - 7 * DAY), 7, now)).toBe(false);
  });
});

describe("selectExpiredNames", () => {
  it("期限切れselfieのみ返す。thumbnails/・新しいもの・他フォルダは除外", () => {
    const blobs = [
      { name: "selfies/A/old.jpg", lastModified: new Date(now.getTime() - 10 * DAY) },
      { name: "selfies/A/new.jpg", lastModified: new Date(now.getTime() - 1 * DAY) },
      { name: "thumbnails/selfies/A/old.webp", lastModified: new Date(now.getTime() - 10 * DAY) },
      { name: "questions/1/q.png", lastModified: new Date(now.getTime() - 100 * DAY) },
    ];
    expect(selectExpiredNames(blobs, 7, now)).toEqual(["selfies/A/old.jpg"]);
  });
  it("lastModified 未定義は対象外（安全側）", () => {
    expect(selectExpiredNames([{ name: "selfies/A/x.jpg" }], 7, now)).toEqual([]);
  });
});
