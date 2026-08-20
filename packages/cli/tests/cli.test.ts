import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../src/index.js";

describe("CLI", () => {
  it("runs init command to generate .freshstart.yml", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "freshstart-cli-test-"));
    try {
      await runCli(["node", "freshstart", "init", tmpDir]);
      const configFile = path.join(tmpDir, ".freshstart.yml");
      expect(fs.existsSync(configFile)).toBe(true);
      const content = fs.readFileSync(configFile, "utf8");
      expect(content).toContain("fail-below: 80");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
