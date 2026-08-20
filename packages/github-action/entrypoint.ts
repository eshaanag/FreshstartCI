import fs from "node:fs";
import path from "node:path";
import {
  Runner,
  CheckId,
  RunnerOptions,
  renderMarkdownReport,
  formatJsonReport,
} from "@freshstart-ci/core";

export async function runAction(): Promise<void> {
  const targetPath = process.env.INPUT_PATH || ".";
  const repoPath = path.resolve(process.cwd(), targetPath);
  const failBelow = process.env["INPUT_FAIL-BELOW"]
    ? Number.parseInt(process.env["INPUT_FAIL-BELOW"], 10)
    : undefined;

  const checksInput = process.env.INPUT_CHECKS;
  const onlyChecks =
    checksInput && checksInput !== "all"
      ? (checksInput.split(",").map((s) => s.trim()) as CheckId[])
      : undefined;

  const runnerOptions: RunnerOptions = {
    repoPath,
    fix: false,
    outputFormat: "terminal",
    quiet: false,
    verbose: false,
  };

  if (onlyChecks) {
    runnerOptions.onlyChecks = onlyChecks;
  }

  const result = await Runner.runAll(runnerOptions);

  const markdownReport = renderMarkdownReport(result.score);
  const jsonReportStr = formatJsonReport(result.score, result.report.config, false);

  // Write GitHub Action Step Summary if available
  const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryFile) {
    fs.appendFileSync(stepSummaryFile, `${markdownReport}\n`, "utf8");
  }

  // Write GitHub Action Outputs if available
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `score=${result.score.total}\n`, "utf8");
    fs.appendFileSync(outputFile, `grade=${result.score.grade}\n`, "utf8");
    fs.appendFileSync(outputFile, `report-json=${jsonReportStr}\n`, "utf8");
  }

  const effectiveFailBelow = failBelow ?? result.report.config.failBelow;
  if (result.score.total < effectiveFailBelow) {
    process.stderr.write(
      `FreshstartCI Score (${result.score.total}) is below threshold (${effectiveFailBelow}).\n`,
    );
    process.exitCode = 1;
  }
}

if (process.env.GITHUB_ACTIONS) {
  runAction().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Action failed: ${msg}\n`);
    process.exitCode = 1;
  });
}
