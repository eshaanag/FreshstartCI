import { describe, expect, it } from "vitest";

import {
  calculateQuickstartHealthScore,
  gradeForScore,
  renderScoreCard,
} from "../src/score/Scorer.js";
import type { CheckResult } from "../src/types/index.js";

describe("gradeForScore", () => {
  it.each([
    [100, "A"],
    [90, "A"],
    [89, "B"],
    [75, "B"],
    [74, "C"],
    [60, "C"],
    [59, "D"],
    [40, "D"],
    [39, "F"],
  ] as const)("maps %s to grade %s", (score, grade) => {
    expect(gradeForScore(score)).toBe(grade);
  });
});

describe("calculateQuickstartHealthScore", () => {
  it("normalizes weighted check scores to 100", () => {
    const score = calculateQuickstartHealthScore(
      [
        check({ score: 20, maxScore: 20, status: "pass" }),
        check({ score: 10, maxScore: 20, status: "warn" }),
        check({ score: 0, maxScore: 20, status: "fail" }),
      ],
      {
        repoPath: "/repo",
        version: "0.1.0",
        durationMs: 100,
        timestamp: "2026-06-08T00:00:00.000Z",
      },
    );

    expect(score.total).toBe(50);
    expect(score.grade).toBe("D");
  });

  it("returns 100 when no checks are included", () => {
    const score = calculateQuickstartHealthScore([], {
      repoPath: "/repo",
      version: "0.1.0",
      durationMs: 0,
    });

    expect(score.total).toBe(100);
    expect(score.grade).toBe("A");
  });
});

describe("renderScoreCard", () => {
  it("renders score, grade, checks, and issue summary", () => {
    const score = calculateQuickstartHealthScore(
      [
        check({
          name: "Dependencies",
          summary: "Dependencies install cleanly",
          score: 20,
          maxScore: 20,
          status: "pass",
        }),
        check({
          name: "README",
          summary: "README commands drifted",
          score: 14,
          maxScore: 20,
          status: "warn",
        }),
      ],
      {
        repoPath: "/repo",
        version: "0.1.0",
        durationMs: 100,
        timestamp: "2026-06-08T00:00:00.000Z",
      },
    );

    const card = renderScoreCard(score);

    expect(card).toContain("QUICKSTART HEALTH SCORE: 85/100");
    expect(card).toContain("Grade: B");
    expect(card).toContain("WARN README commands drifted 14/20");
    expect(card).toContain("1 issue found");
  });
});

function check(overrides: Partial<CheckResult>): CheckResult {
  return {
    checkId: "dependencies",
    name: "Dependency installation",
    passed: overrides.status !== "fail",
    score: 20,
    maxScore: 20,
    status: "pass",
    summary: "Dependencies install cleanly",
    details: [],
    durationMs: 1,
    ...overrides,
  };
}
