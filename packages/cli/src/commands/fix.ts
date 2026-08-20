import path from "node:path";
import { Runner } from "@freshstart-ci/core";

export async function executeFixCommand(targetPath = "."): Promise<void> {
  const repoPath = path.resolve(process.cwd(), targetPath);
  const result = await Runner.runAll({
    repoPath,
    fix: true,
    outputFormat: "terminal",
    quiet: false,
    verbose: false,
  });

  if (result.fixesApplied && result.fixesApplied.length > 0) {
    process.stdout.write("\nApplied Fixes:\n");
    for (const fix of result.fixesApplied) {
      if (fix.applied) {
        process.stdout.write(`  ✅ ${fix.description}\n`);
      } else {
        process.stdout.write(`  ❌ ${fix.description}: ${fix.error ?? "Failed"}\n`);
      }
    }
  } else {
    process.stdout.write("\nNo automatic fixes were applicable.\n");
  }

  process.stdout.write(`\nUpdated Score:\n${result.outputString}\n`);
}
