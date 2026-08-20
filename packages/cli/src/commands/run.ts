import path from "node:path";
import { Runner, CheckId, RunnerOptions, OutputFormat } from "@freshstart-ci/core";

export interface RunCommandOptions {
  only?: string;
  fix?: boolean;
  reporter?: string;
  failBelow?: string;
  quiet?: boolean;
  verbose?: boolean;
}

export async function executeRunCommand(
  targetPath = ".",
  options: RunCommandOptions = {},
): Promise<void> {
  const repoPath = path.resolve(process.cwd(), targetPath);
  const onlyChecks = options.only
    ? (options.only.split(",").map((s) => s.trim()) as CheckId[])
    : undefined;

  const outputFormat: OutputFormat =
    options.reporter === "json"
      ? "json"
      : options.reporter === "markdown"
        ? "markdown"
        : "terminal";

  const runnerOptions: RunnerOptions = {
    repoPath,
    fix: Boolean(options.fix),
    outputFormat,
    quiet: Boolean(options.quiet),
    verbose: Boolean(options.verbose),
  };

  if (onlyChecks) {
    runnerOptions.onlyChecks = onlyChecks;
  }

  const result = await Runner.runAll(runnerOptions);

  if (result.outputString) {
    process.stdout.write(`${result.outputString}\n`);
  }

  const failBelowThreshold = options.failBelow
    ? Number.parseInt(options.failBelow, 10)
    : result.report.config.failBelow;

  if (result.score.total < failBelowThreshold) {
    process.exitCode = 1;
  }
}
