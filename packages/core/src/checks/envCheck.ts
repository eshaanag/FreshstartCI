import { access, appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { scanEnvUsage } from "../lib/astScanner.js";
import type { AutoFix, CheckContext, CheckDetail, CheckResult } from "../types/index.js";

interface EnvExampleParseResult {
  exists: boolean;
  declared: Set<string>;
}

const ENV_FIX_COMMENT = "# Added by freshstart-ci - fill in before running";

/**
 * Checks whether env vars used in code are declared in `.env.example`.
 *
 * @param context - Shared check context containing repo path and config.
 * @returns Env completeness check result with missing/unused vars and optional auto-fix.
 *
 * @example
 * ```ts
 * const result = await runEnvCheck(context);
 * result.status;
 * ```
 */
export async function runEnvCheck(context: CheckContext): Promise<CheckResult> {
  const startedAt = Date.now();
  const maxScore = context.config.scoring.weights.env;

  try {
    const envExamplePath = path.join(context.repoPath, ".env.example");
    const envExample = await parseEnvExample(envExamplePath);
    const scan = await scanEnvUsage(context.repoPath, context.config.ignore);
    const usedNames = new Set(scan.usages.map((usage) => usage.name));
    const missing = [...usedNames].filter((name) => !envExample.declared.has(name)).sort();
    const unused = [...envExample.declared].filter((name) => !usedNames.has(name)).sort();
    const details = buildDetails(
      missing,
      unused,
      scan.dynamicAccesses,
      await hasCommittedEnv(context.repoPath),
    );

    if (!envExample.exists) {
      const fix =
        missing.length > 0 ? createEnvExampleFix(envExamplePath, missing, false) : undefined;

      return result({
        score: 0,
        maxScore,
        status: "fail",
        summary: ".env.example is missing.",
        details: [
          {
            type: "error",
            message: ".env.example does not exist.",
            file: ".env.example",
            suggestion: "Create .env.example with every required environment variable.",
          },
          ...details,
        ],
        ...(fix !== undefined ? { fix } : {}),
        durationMs: Date.now() - startedAt,
      });
    }

    if (missing.length >= 3) {
      return result({
        score: 0,
        maxScore,
        status: "fail",
        summary: `${missing.length} env vars are missing from .env.example.`,
        details,
        fix: createEnvExampleFix(envExamplePath, missing, true),
        durationMs: Date.now() - startedAt,
      });
    }

    if (missing.length > 0) {
      return result({
        score: Math.round(maxScore * 0.5),
        maxScore,
        status: "warn",
        summary: `${missing.length} env var${missing.length === 1 ? " is" : "s are"} missing from .env.example.`,
        details,
        fix: createEnvExampleFix(envExamplePath, missing, true),
        durationMs: Date.now() - startedAt,
      });
    }

    return result({
      score: maxScore,
      maxScore,
      status: details.some((detail) => detail.type === "warning") ? "warn" : "pass",
      summary: ".env.example is complete.",
      details,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return result({
      score: 0,
      maxScore,
      status: "fail",
      summary: "Env completeness check crashed.",
      details: [
        {
          type: "error",
          message: `Env completeness check failed unexpectedly: ${
            error instanceof Error ? error.message : "unknown error"
          }.`,
          suggestion: "Run FreshstartCI with --verbose and file an issue if this persists.",
        },
      ],
      durationMs: Date.now() - startedAt,
    });
  }
}

async function parseEnvExample(envExamplePath: string): Promise<EnvExampleParseResult> {
  try {
    const contents = await readFile(envExamplePath, "utf8");
    const declared = new Set<string>();

    for (const line of contents.split("\n")) {
      const trimmed = line.trim();

      if (trimmed.length === 0 || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);

      if (match?.[1] !== undefined) {
        declared.add(match[1]);
      }
    }

    return { exists: true, declared };
  } catch {
    return { exists: false, declared: new Set<string>() };
  }
}

function buildDetails(
  missing: string[],
  unused: string[],
  dynamicAccesses: Array<{ file: string; line: number; expression: string }>,
  committedEnv: boolean,
): CheckDetail[] {
  const details: CheckDetail[] = [];

  for (const name of missing) {
    details.push({
      type: "error",
      message: `${name} is used in code but missing from .env.example.`,
      file: ".env.example",
      suggestion: `Add ${name}= to .env.example.`,
    });
  }

  for (const name of unused) {
    details.push({
      type: "warning",
      message: `${name} is declared in .env.example but was not found in source code.`,
      file: ".env.example",
      suggestion: "Remove stale example variables or verify they are loaded dynamically.",
    });
  }

  for (const access of dynamicAccesses) {
    details.push({
      type: "warning",
      message: `Dynamic env access cannot be verified statically: ${access.expression}.`,
      file: access.file,
      line: access.line,
      suggestion: "Document dynamically accessed env vars in .env.example manually.",
    });
  }

  if (committedEnv) {
    details.push({
      type: "warning",
      message: ".env appears to be present in the repository.",
      file: ".env",
      suggestion: "Remove committed secrets and keep only .env.example in version control.",
    });
  }

  return details;
}

function createEnvExampleFix(envExamplePath: string, missing: string[], append: boolean): AutoFix {
  return {
    description: append
      ? `Append ${missing.length} missing env var${missing.length === 1 ? "" : "s"} to .env.example.`
      : "Create .env.example with detected env vars.",
    apply: async (): Promise<void> => {
      const block = [`${ENV_FIX_COMMENT}`, ...missing.map((name) => `${name}=`), ""].join("\n");

      if (append) {
        await appendFile(envExamplePath, `\n${block}`);
        return;
      }

      await writeFile(envExamplePath, block);
    },
  };
}

async function hasCommittedEnv(repoPath: string): Promise<boolean> {
  try {
    await access(path.join(repoPath, ".env"));
    return true;
  } catch {
    return false;
  }
}

function result(input: Omit<CheckResult, "checkId" | "name" | "passed">): CheckResult {
  return {
    checkId: "env",
    name: "Environment completeness",
    passed: input.status === "pass" || input.status === "warn" || input.status === "skip",
    ...input,
  };
}
