import { getCoreVersion } from "@freshstart-ci/core";
import { Command } from "commander";

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
    .command("run")
    .description("Run quickstart checks. Check implementations are added in the next phases.")
    .action((): void => {
      program.outputHelp();
    });

  await program.parseAsync([...argv]);
}
