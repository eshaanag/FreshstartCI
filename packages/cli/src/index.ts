import { getCoreVersion } from "@freshstart-ci/core";
import { Command } from "commander";
import { executeRunCommand } from "./commands/run.js";
import { executeScoreCommand } from "./commands/score.js";
import { executeInitCommand } from "./commands/init.js";
import { executeFixCommand } from "./commands/fix.js";

/**
 * Builds and executes the FreshstartCI command-line parser.
 *
 * @param argv - The process argument vector to parse.
 * @returns A promise that resolves after command parsing completes.
 *
 * @example
 * ```ts
 * await runCli(process.argv);
 * ```
 */
export async function runCli(argv: readonly string[]): Promise<void> {
  const program = new Command();

  program
    .name("freshstart")
    .description("Test whether a repository works for someone cloning it fresh.")
    .version(getCoreVersion());

  program
    .command("run [path]")
    .description("Run quickstart checks on a repository")
    .option(
      "-o, --only <checks>",
      "Comma-separated list of check IDs to run (e.g. env,build,server)",
    )
    .option("-f, --fix", "Automatically apply fixes for failing checks where safe")
    .option("-r, --reporter <format>", "Reporter format: terminal, markdown, json", "terminal")
    .option("--fail-below <score>", "Minimum score threshold to pass CI")
    .option("-q, --quiet", "Suppress non-essential output")
    .option("-v, --verbose", "Show detailed failure and warning context")
    .action(async (targetPath?: string, options?: unknown) => {
      await executeRunCommand(targetPath, options as Record<string, unknown>);
    });

  program
    .command("score [path]")
    .description("Quickly score a repository without modifying workspace")
    .option("--json", "Output raw JSON score report")
    .action(async (targetPath?: string, options?: unknown) => {
      await executeScoreCommand(targetPath, options as Record<string, unknown>);
    });

  program
    .command("init [path]")
    .description("Initialize a .freshstart.yml configuration file")
    .action(async (targetPath?: string) => {
      await executeInitCommand(targetPath);
    });

  program
    .command("fix [path]")
    .description("Automatically fix setup issues in a repository")
    .action(async (targetPath?: string) => {
      await executeFixCommand(targetPath);
    });

  await program.parseAsync([...argv]);
}
