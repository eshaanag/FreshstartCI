import { execa } from "execa";

import type { CheckContext, CheckDetail, CheckResult } from "../types/index.js";

export interface BuildCommand {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}

export interface BuildCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface BuildCheckOptions {
  timeoutMs?: number;
  runCommand?: (command: BuildCommand) => Promise<BuildCommandResult>;
}

const DEFAULT_TIMEOUT_MS = 180000;

/**
 * Runs the detected project build command and classifies common failures.
 *
 * @param context - Shared check context with repo path and detected build command.
 * @param options - Optional command runner and timeout overrides for tests.
 * @returns Build check result with score, status, and actionable details.
 *
 * @example
 * ```ts
 * const result = await runBuildCheck(context);
 * result.summary;
 * ```
 */
export async function runBuildCheck(
  context: CheckContext,
  options: BuildCheckOptions = {},
): Promise<CheckResult> {
  const startedAt = Date.now();
  const maxScore = context.config.scoring.weights.build;
  const framework = (context.detectedFramework as any)?.detectedFramework || context.detectedFramework;
  const buildCommand = framework?.buildCommand?.trim() ?? "";

  try {
    if (buildCommand.length === 0) {
      return result({
        score: maxScore,
        maxScore,
        status: "skip",
        summary: "No build command detected; build check is not applicable.",
        details: [
          {
            type: "info",
            message: "No build script or framework build command was detected.",
            suggestion: "Add a build script if this project requires a compile or bundle step.",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    }

    const command = splitCommand(buildCommand);
    const runCommand = options.runCommand ?? runBuildCommand;
    const commandResult = await runCommand({
      ...command,
      cwd: context.repoPath,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    if (commandResult.timedOut) {
      return result({
        score: 0,
        maxScore,
        status: "fail",
        summary: "Build timed out.",
        details: [
          {
            type: "error",
            message: `Build exceeded ${(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000} seconds.`,
            suggestion:
              "Check slow build steps, network-dependent build plugins, or missing caches.",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    }

    if (commandResult.exitCode !== 0) {
      return result({
        score: 0,
        maxScore,
        status: "fail",
        summary: "Build failed.",
        details: [classifyBuildFailure(commandResult.stderr || commandResult.stdout)],
        durationMs: Date.now() - startedAt,
      });
    }

    if (hasBuildWarning(commandResult.stdout) || hasBuildWarning(commandResult.stderr)) {
      return result({
        score: Math.round(maxScore * 0.9),
        maxScore,
        status: "warn",
        summary: "Build passed with warnings.",
        details: [
          {
            type: "warning",
            message:
              firstUsefulLine(commandResult.stderr || commandResult.stdout) ??
              "Build emitted warnings.",
            suggestion: "Review build warnings before they become quickstart failures.",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    }

    return result({
      score: maxScore,
      maxScore,
      status: "pass",
      summary: "Build passes.",
      details: [],
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return result({
      score: 0,
      maxScore,
      status: "fail",
      summary: "Build check crashed.",
      details: [
        {
          type: "error",
          message: `Build check failed unexpectedly: ${
            error instanceof Error ? error.message : "unknown error"
          }.`,
          suggestion: "Run FreshstartCI with --verbose and file an issue if this persists.",
        },
      ],
      durationMs: Date.now() - startedAt,
    });
  }
}

async function runBuildCommand(command: BuildCommand): Promise<BuildCommandResult> {
  const output = await execa(command.command, command.args, {
    cwd: command.cwd,
    timeout: command.timeoutMs,
    reject: false,
  });

  return {
    exitCode: output.exitCode ?? (output.failed ? 1 : 0),
    stdout: output.stdout,
    stderr: output.stderr,
    timedOut: output.timedOut ?? false,
  };
}

function splitCommand(command: string): { command: string; args: string[] } {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const [binary, ...args] = parts.map((part) => part.replace(/^"|"$/g, ""));

  return {
    command: binary ?? command,
    args,
  };
}

function classifyBuildFailure(output: string): CheckDetail {
  const moduleMatch = output.match(/Cannot find module ['"]([^'"]+)['"]/);

  if (moduleMatch?.[1] !== undefined) {
    return {
      type: "error",
      message: `Build cannot find module "${moduleMatch[1]}".`,
      suggestion: `Install ${moduleMatch[1]} or fix the import path referenced by the build.`,
    };
  }

  if (/Type error:|TS\d{4}|Property .+ does not exist/.test(output)) {
    return {
      type: "error",
      message: firstUsefulLine(output) ?? "Build failed with a TypeScript error.",
      suggestion: "Fix the TypeScript error reported by the build.",
    };
  }

  const missingFileMatch = output.match(/ENOENT.*?['"]([^'"]+)['"]/);

  if (missingFileMatch?.[1] !== undefined) {
    return {
      type: "error",
      message: `Build references missing file ${missingFileMatch[1]}.`,
      suggestion: "Restore the missing file or update the build reference.",
    };
  }

  if (output.includes("SyntaxError")) {
    return {
      type: "error",
      message: firstUsefulLine(output) ?? "Build failed with a syntax error.",
      suggestion: "Fix the first syntax error reported by the build.",
    };
  }

  if (/[_A-Z0-9]+ is not defined/.test(output) && output.includes("_KEY")) {
    return {
      type: "error",
      message:
        firstUsefulLine(output) ?? "Build failed because an environment variable is missing.",
      suggestion:
        "Add the missing variable to .env.example and ensure the build can run without secrets.",
    };
  }

  return {
    type: "error",
    message: firstUsefulLine(output) ?? "Build command exited with a non-zero status.",
    suggestion: "Run the build command locally and fix the first reported error.",
  };
}

function hasBuildWarning(output: string): boolean {
  return /\bwarning\b/i.test(output);
}

function firstUsefulLine(output: string): string | undefined {
  return output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function result(input: Omit<CheckResult, "checkId" | "name" | "passed">): CheckResult {
  return {
    checkId: "build",
    name: "Build pass",
    passed: input.status === "pass" || input.status === "warn" || input.status === "skip",
    ...input,
  };
}
