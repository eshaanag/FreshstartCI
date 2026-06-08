import type { CheckResult, Grade, QuickstartHealthScore } from "../types/index.js";

export interface ScoreCalculationOptions {
  repoPath: string;
  version: string;
  durationMs: number;
  timestamp?: string;
}

const CARD_WIDTH = 50;

/**
 * Calculates the Quickstart Health Score from completed check results.
 *
 * @param checks - Check results to include in the normalized score.
 * @param options - Metadata to attach to the score report.
 * @returns A complete Quickstart Health Score object.
 *
 * @example
 * ```ts
 * const score = calculateQuickstartHealthScore(checks, {
 *   repoPath: process.cwd(),
 *   version: "0.1.0",
 *   durationMs: 1200,
 * });
 * ```
 */
export function calculateQuickstartHealthScore(
  checks: CheckResult[],
  options: ScoreCalculationOptions,
): QuickstartHealthScore {
  const maxScore = checks.reduce((total, check) => total + check.maxScore, 0);
  const earnedScore = checks.reduce((total, check) => total + check.score, 0);
  const total = maxScore === 0 ? 100 : clampScore(Math.round((earnedScore / maxScore) * 100));

  return {
    total,
    grade: gradeForScore(total),
    checks,
    repoPath: options.repoPath,
    timestamp: options.timestamp ?? new Date().toISOString(),
    durationMs: options.durationMs,
    version: options.version,
  };
}

/**
 * Converts a numeric score into a FreshstartCI grade.
 *
 * @param score - Numeric score from 0 to 100.
 * @returns Grade threshold label.
 *
 * @example
 * ```ts
 * gradeForScore(94);
 * ```
 */
export function gradeForScore(score: number): Grade {
  if (score >= 90) {
    return "A";
  }

  if (score >= 75) {
    return "B";
  }

  if (score >= 60) {
    return "C";
  }

  if (score >= 40) {
    return "D";
  }

  return "F";
}

/**
 * Renders the terminal-friendly Quickstart Health Score card.
 *
 * @param score - Calculated health score to render.
 * @returns ASCII score card suitable for terminal and markdown code fences.
 *
 * @example
 * ```ts
 * renderScoreCard(score);
 * ```
 */
export function renderScoreCard(score: QuickstartHealthScore): string {
  const lines = [
    topBorder(),
    row(`QUICKSTART HEALTH SCORE: ${score.total}/100`, true),
    row(`Grade: ${score.grade}`, true),
    middleBorder(),
    ...score.checks.map((check) =>
      row(`${statusLabel(check.status)} ${check.summary} ${check.score}/${check.maxScore}`),
    ),
    middleBorder(),
    row(issueSummary(score.checks)),
    bottomBorder(),
  ];

  return lines.join("\n");
}

function statusLabel(status: CheckResult["status"]): string {
  if (status === "pass") {
    return "PASS";
  }

  if (status === "warn") {
    return "WARN";
  }

  if (status === "skip") {
    return "SKIP";
  }

  return "FAIL";
}

function issueSummary(checks: CheckResult[]): string {
  const issueCount = checks.filter(
    (check) => check.status === "warn" || check.status === "fail",
  ).length;

  if (issueCount === 0) {
    return "No quickstart issues found.";
  }

  return `${issueCount} issue${issueCount === 1 ? "" : "s"} found. Run with --fix to resolve what can be fixed.`;
}

function row(content: string, center = false): string {
  const innerWidth = CARD_WIDTH - 2;
  const trimmed = content.length > innerWidth ? content.slice(0, innerWidth - 1) : content;
  const leftPadding = center ? Math.max(Math.floor((innerWidth - trimmed.length) / 2), 0) : 1;
  const rightPadding = Math.max(innerWidth - trimmed.length - leftPadding, 0);

  return `║${" ".repeat(leftPadding)}${trimmed}${" ".repeat(rightPadding)}║`;
}

function topBorder(): string {
  return `╔${"═".repeat(CARD_WIDTH - 2)}╗`;
}

function middleBorder(): string {
  return `╠${"═".repeat(CARD_WIDTH - 2)}╣`;
}

function bottomBorder(): string {
  return `╚${"═".repeat(CARD_WIDTH - 2)}╝`;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
