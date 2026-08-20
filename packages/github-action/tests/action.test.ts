import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runAction } from "../entrypoint.js";

describe("GitHub Action", () => {
  it("runs action and populates step summary and outputs", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "freshstart-action-test-"));
    const summaryFile = path.join(tmpDir, "summary.md");
    const outputFile = path.join(tmpDir, "output.txt");

    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "action-test" }));
    fs.writeFileSync(summaryFile, "");
    fs.writeFileSync(outputFile, "");

    const origSummary = process.env.GITHUB_STEP_SUMMARY;
    const origOutput = process.env.GITHUB_OUTPUT;
    const origPath = process.env.INPUT_PATH;

    process.env.GITHUB_STEP_SUMMARY = summaryFile;
    process.env.GITHUB_OUTPUT = outputFile;
    process.env.INPUT_PATH = tmpDir;

    try {
      await runAction();

      const summaryContent = fs.readFileSync(summaryFile, "utf8");
      expect(summaryContent).toContain("FreshstartCI Report:");

      const outputContent = fs.readFileSync(outputFile, "utf8");
      expect(outputContent).toContain("score=");
      expect(outputContent).toContain("grade=");
    } finally {
      process.env.GITHUB_STEP_SUMMARY = origSummary;
      process.env.GITHUB_OUTPUT = origOutput;
      process.env.INPUT_PATH = origPath;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
