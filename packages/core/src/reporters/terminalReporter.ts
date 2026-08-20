import type { QuickstartHealthScore, ReporterRenderOptions } from "../types/index.js";
import { renderScoreCard } from "../score/Scorer.js";

export function renderTerminalReport(
  score: QuickstartHealthScore,
  options?: Partial<ReporterRenderOptions>,
): string {
  const card = renderScoreCard(score);
  if (options?.compact) {
    return card;
  }

  const output: string[] = [card];

  if (options?.verbose) {
    output.push("");
    output.push("CHECK DETAILS");
    output.push("=============");
    for (const check of score.checks) {
      output.push(
        `\n[${check.status.toUpperCase()}] ${check.name} (${check.score}/${check.maxScore})`,
      );
      output.push(`  ${check.summary}`);
      for (const detail of check.details) {
        output.push(`    - [${detail.type.toUpperCase()}] ${detail.message}`);
        if (detail.suggestion) {
          output.push(`      Suggestion: ${detail.suggestion}`);
        }
      }
      if (check.fix) {
        output.push(`    - [FIX AVAILABLE] ${check.fix.description}`);
      }
    }
  }

  return output.join("\n");
}
