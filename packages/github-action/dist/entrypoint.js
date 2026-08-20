// entrypoint.ts
import fs from "fs";
import path from "path";
import {
  Runner,
  renderMarkdownReport,
  formatJsonReport
} from "@freshstart-ci/core";
async function runAction() {
  const targetPath = process.env.INPUT_PATH || ".";
  const repoPath = path.resolve(process.cwd(), targetPath);
  const failBelow = process.env["INPUT_FAIL-BELOW"] ? Number.parseInt(process.env["INPUT_FAIL-BELOW"], 10) : void 0;
  const checksInput = process.env.INPUT_CHECKS;
  const onlyChecks = checksInput && checksInput !== "all" ? checksInput.split(",").map((s) => s.trim()) : void 0;
  const runnerOptions = {
    repoPath,
    fix: false,
    outputFormat: "terminal",
    quiet: false,
    verbose: false
  };
  if (onlyChecks) {
    runnerOptions.onlyChecks = onlyChecks;
  }
  const result = await Runner.runAll(runnerOptions);
  const markdownReport = renderMarkdownReport(result.score);
  const jsonReportStr = formatJsonReport(result.score, result.report.config, false);
  const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryFile) {
    fs.appendFileSync(stepSummaryFile, `${markdownReport}
`, "utf8");
  }
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `score=${result.score.total}
`, "utf8");
    fs.appendFileSync(outputFile, `grade=${result.score.grade}
`, "utf8");
    fs.appendFileSync(outputFile, `report-json=${jsonReportStr}
`, "utf8");
  }
  const effectiveFailBelow = failBelow ?? result.report.config.failBelow;
  if (result.score.total < effectiveFailBelow) {
    process.stderr.write(
      `FreshstartCI Score (${result.score.total}) is below threshold (${effectiveFailBelow}).
`
    );
    process.exitCode = 1;
  }
}
if (process.env.GITHUB_ACTIONS) {
  runAction().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Action failed: ${msg}
`);
    process.exitCode = 1;
  });
}
export {
  runAction
};
//# sourceMappingURL=entrypoint.js.map