import path from "node:path";
import { Runner } from "@freshstart-ci/core";

export interface ScoreCommandOptions {
  json?: boolean;
}

export async function executeScoreCommand(
  targetPath = ".",
  options: ScoreCommandOptions = {},
): Promise<void> {
  const repoPath = path.resolve(process.cwd(), targetPath);
  const result = await Runner.runAll({
    repoPath,
    fix: false,
    outputFormat: options.json ? "json" : "terminal",
    quiet: false,
    verbose: false,
  });

  process.stdout.write(`${result.outputString}\n`);
}
