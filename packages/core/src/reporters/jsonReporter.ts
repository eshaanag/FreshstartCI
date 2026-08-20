import type { FreshstartConfig, QuickstartHealthScore, ScoreReport } from "../types/index.js";

export function renderJsonReport(
  score: QuickstartHealthScore,
  config: FreshstartConfig,
): ScoreReport {
  const passed = score.checks.filter((c) => c.status === "pass").length;
  const warnings = score.checks.filter((c) => c.status === "warn").length;
  const failed = score.checks.filter((c) => c.status === "fail").length;
  const skipped = score.checks.filter((c) => c.status === "skip").length;

  return {
    schemaVersion: "1.0",
    score,
    config,
    summary: {
      passed,
      warnings,
      failed,
      skipped,
    },
  };
}

export function formatJsonReport(
  score: QuickstartHealthScore,
  config: FreshstartConfig,
  pretty = true,
): string {
  const report = renderJsonReport(score, config);
  return JSON.stringify(report, null, pretty ? 2 : undefined);
}
