import { defineConfig } from "vitest/config";

export default defineConfig({
  css: {
    postcss: {},
  },
  test: {
    include: ["packages/*/tests/**/*.test.ts"],
    globals: false,
    passWithNoTests: true,
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
