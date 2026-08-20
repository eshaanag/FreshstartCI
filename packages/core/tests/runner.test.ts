import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Runner } from "../src/runner/Runner.js";

describe("Runner", () => {
  it("runs enabled checks on a project directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "freshstart-runner-test-"));
    try {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ name: "test-app", version: "1.0.0" }),
      );

      const result = await Runner.runAll({
        repoPath: tmpDir,
        fix: false,
        outputFormat: "terminal",
        quiet: false,
        verbose: false,
      });

      expect(result.score).toBeDefined();
      expect(result.report).toBeDefined();
      expect(result.outputString).toContain("QUICKSTART HEALTH SCORE");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
