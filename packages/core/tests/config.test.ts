import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig } from "../src/config/index.js";
import { DEFAULT_CONFIG } from "../src/types/index.js";

describe("loadConfig", () => {
  it("returns DEFAULT_CONFIG when no config file exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "freshstart-config-test-"));
    try {
      const config = loadConfig(tmpDir);
      expect(config).toEqual(DEFAULT_CONFIG);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("loads and parses a valid .freshstart.yml file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "freshstart-config-test-"));
    try {
      const yamlContent = `
fail-below: 85
package-manager: pnpm
checks:
  dependencies: true
  build: false
`;
      fs.writeFileSync(path.join(tmpDir, ".freshstart.yml"), yamlContent, "utf8");
      const config = loadConfig(tmpDir);
      expect(config.failBelow).toBe(85);
      expect(config.packageManager).toBe("pnpm");
      expect(config.checks.dependencies).toBe(true);
      expect(config.checks.build).toBe(false);
      expect(config.checks.env).toBe(true); // default fallback
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
