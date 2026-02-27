import { describe, it, expect } from "vitest";
import { calculateScore } from "../../services/scoringService.js";

describe("calculateScore", () => {
  it("正解時: 即答(0ms) → 1000点", () => {
    expect(calculateScore(true, 0, 20)).toBe(1000);
  });

  it("正解時: 制限時間の半分で回答 → 750点", () => {
    // ratio = 10000 / (20000 * 2) = 0.25
    // score = 1000 * (1 - 0.25) = 750
    expect(calculateScore(true, 10000, 20)).toBe(750);
  });

  it("正解時: 制限時間ちょうどで回答 → 500点", () => {
    // ratio = 20000 / (20000 * 2) = 0.5
    // score = 1000 * (1 - 0.5) = 500
    expect(calculateScore(true, 20000, 20)).toBe(500);
  });

  it("正解時: 制限時間*2で回答 → 500点(下限クランプ)", () => {
    // ratio = 40000 / (20000 * 2) = 1.0
    // score = 1000 * (1 - 1) = 0 → clamped to 500
    expect(calculateScore(true, 40000, 20)).toBe(500);
  });

  it("正解時: 負の応答時間 → 1000点(上限クランプ)", () => {
    // ratio = -5000 / (20000 * 2) = -0.125
    // score = 1000 * (1 - (-0.125)) = 1125 → clamped to 1000
    expect(calculateScore(true, -5000, 20)).toBe(1000);
  });

  it("不正解時 → 0点", () => {
    expect(calculateScore(false, 5000, 20)).toBe(0);
  });

  it("不正解時: 即答でも → 0点", () => {
    expect(calculateScore(false, 0, 20)).toBe(0);
  });

  it("境界: timeLimitSeconds=0で応答時間>0 → 500点(下限)", () => {
    // timeLimitMs = 0, ratio = 5000 / (0 * 2) = Infinity
    // score = 1000 * (1 - Infinity) = -Infinity → clamped to 500
    expect(calculateScore(true, 5000, 0)).toBe(500);
  });

  // ポイント倍率テスト
  it("2倍: 即答 → 2000点", () => {
    expect(calculateScore(true, 0, 20, 2)).toBe(2000);
  });

  it("3倍: 即答 → 3000点", () => {
    expect(calculateScore(true, 0, 20, 3)).toBe(3000);
  });

  it("2倍: 制限時間ちょうど → 1000点", () => {
    // baseScore = 500, 500 * 2 = 1000
    expect(calculateScore(true, 20000, 20, 2)).toBe(1000);
  });

  it("3倍: 制限時間の半分 → 2250点", () => {
    // baseScore = 750, 750 * 3 = 2250
    expect(calculateScore(true, 10000, 20, 3)).toBe(2250);
  });

  it("不正解時: 倍率があっても0点", () => {
    expect(calculateScore(false, 0, 20, 3)).toBe(0);
  });

  it("倍率省略 → デフォルト1倍", () => {
    expect(calculateScore(true, 0, 20)).toBe(1000);
  });
});
