import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/services/**/*.ts",
        "src/routes/**/*.ts",
        "src/socket/**/*.ts",
        "src/utils/**/*.ts",
        "src/storage/**/*.ts",
      ],
      exclude: ["src/__tests__/**"],
      all: true,
      // 実測値（2026-06: stmts 82% / branch 86% / funcs 90%）の少し下に設定し、
      // カバレッジの大幅な低下をCIで検出する
      thresholds: {
        lines: 78,
        statements: 78,
        branches: 80,
        functions: 85,
      },
    },
  },
});
