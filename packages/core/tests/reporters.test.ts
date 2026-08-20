import { describe, expect, it } from "vitest";
import { calculateQuickstartHealthScore } from "../src/score/Scorer.js";
import { renderTerminalReport } from "../src/reporters/terminalReporter.js";
import { renderMarkdownReport } from "../src/reporters/markdownReporter.js";
import { renderJsonReport, formatJsonReport } from "../src/reporters/jsonReporter.js";
import { DEFAULT_CONFIG, CheckResult } from "../src/types/index.js";

describe("Reporters", () => {
  const dummyChecks: CheckResult[] = [
    {
      checkId: "dependencies",
      name: "Dependency Install",
      passed: true,
      score: 20,
      maxScore: 20,
      status: "pass",
      summary: "Dependencies install cleanly",
      details: [],
      durationMs: 100,
    },
    {
      checkId: "env",
      name: "Environment Completeness",
      passed: false,
      score: 10,
      maxScore: 20,
      status: "warn",
      summary: "Missing 1 environment variable",
      details: [{ type: "warning", message: "DATABASE_URL missing from .env.example" }],
      durationMs: 50,
    },
  ];

  const score = calculateQuickstartHealthScore(dummyChecks, {
    repoPath: "/tmp/fake-repo",
    version: "0.1.0",
    durationMs: 150,
  });

  it("renders terminal report", () => {
    const report = renderTerminalReport(score);
    expect(report).toContain("QUICKSTART HEALTH SCORE");
    expect(report).toContain("Grade:");
  });

  it("renders markdown report", () => {
    const report = renderMarkdownReport(score);
    expect(report).toContain("# FreshstartCI Report:");
    expect(report).toContain("## Check Breakdown");
  });

  it("renders json report", () => {
    const report = renderJsonReport(score, DEFAULT_CONFIG);
    expect(report.schemaVersion).toBe("1.0");
    expect(report.summary.passed).toBe(1);
    expect(report.summary.warnings).toBe(1);

    const jsonString = formatJsonReport(score, DEFAULT_CONFIG);
    expect(JSON.parse(jsonString)).toBeDefined();
  });
});
