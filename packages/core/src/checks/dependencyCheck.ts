import { access, cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { execa } from "execa";

import type { CheckContext, CheckDetail, CheckResult, PackageManager } from "../types/index.js";

export interface DependencyCommand {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}

export interface DependencyCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface DependencySandbox {
  repoPath: string;
  sourceHadNodeModules: boolean;
  cleanup: () => Promise<void>;
}

export interface DependencyCheckOptions {
  timeoutMs?: number;
  createSandbox?: (repoPath: string) => Promise<DependencySandbox>;
  runCommand?: (command: DependencyCommand) => Promise<DependencyCommandResult>;
}

const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Runs the dependency installation check in a clean repository sandbox.
 *
 * @param context - Shared check context containing repo path, config, and package manager.
 * @param options - Optional test hooks for sandbox creation and command execution.
 * @returns A dependency install check result with score, details, and duration.
 *
 * @example
 * ```ts
 * const result = await runDependencyCheck(context);
 * result.score;
 * ```
 */
export async function runDependencyCheck(
  context: CheckContext,
  options: DependencyCheckOptions = {},
): Promise<CheckResult> {
  const startedAt = Date.now();
  const maxScore = context.config.scoring.weights.dependencies;

  try {
    if (!(await fileExists(path.join(context.repoPath, "package.json")))) {
      return result({
        score: maxScore,
        maxScore,
        status: "skip",
        summary: "No package.json found; dependency install is not applicable.",
        details: [
          {
            type: "info",
            message: "Dependency install check was skipped because this is not a Node.js project.",
            file: "package.json",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    }

    const createSandbox = options.createSandbox ?? createCleanRepositoryCopy;
    const runCommand = options.runCommand ?? runInstallCommand;
    const sandbox = await createSandbox(context.repoPath);

    try {
      const details: CheckDetail[] = [];

      if (sandbox.sourceHadNodeModules) {
        details.push({
          type: "warning",
          message: "Source repo already had node_modules; install still ran in a clean sandbox.",
          suggestion: "Keep node_modules out of committed and local quickstart state.",
        });
      }

      const installCommand = await resolveInstallCommand(sandbox.repoPath, context.packageManager);
      const commandResult = await runCommand({
        ...installCommand,
        cwd: sandbox.repoPath,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });

      if (commandResult.timedOut) {
        return result({
          score: 0,
          maxScore,
          status: "fail",
          summary: "Dependency install timed out.",
          details: [
            ...details,
            {
              type: "error",
              message: `Install exceeded ${(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000} seconds.`,
              suggestion:
                "Check network access, package registry availability, or slow install scripts.",
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
          summary: "Dependency install failed.",
          details: [...details, classifyInstallFailure(commandResult.stderr)],
          durationMs: Date.now() - startedAt,
        });
      }

      if (!(await hasAnyNodeModules(sandbox.repoPath))) {
        return result({
          score: 0,
          maxScore,
          status: "fail",
          summary: "Install exited successfully but node_modules was not created.",
          details: [
            ...details,
            {
              type: "error",
              message: "The package manager exited 0 but no node_modules directory exists.",
              suggestion: "Verify install scripts and package manager configuration.",
            },
          ],
          durationMs: Date.now() - startedAt,
        });
      }

      if (
        hasPeerDependencyWarning(commandResult.stderr) ||
        hasPeerDependencyWarning(commandResult.stdout)
      ) {
        return result({
          score: Math.round(maxScore * 0.8),
          maxScore,
          status: "warn",
          summary: "Dependencies installed with peer dependency warnings.",
          details: [
            ...details,
            {
              type: "warning",
              message: "Install completed, but peer dependency warnings were reported.",
              suggestion:
                "Align peer dependency versions so new contributors do not inherit warnings.",
            },
          ],
          durationMs: Date.now() - startedAt,
        });
      }

      return result({
        score: maxScore,
        maxScore,
        status: details.length > 0 ? "warn" : "pass",
        summary: "Dependencies install cleanly.",
        details,
        durationMs: Date.now() - startedAt,
      });
    } finally {
      await sandbox.cleanup();
    }
  } catch (error) {
    return result({
      score: 0,
      maxScore,
      status: "fail",
      summary: "Dependency install check crashed.",
      details: [
        {
          type: "error",
          message: `Dependency install check failed unexpectedly: ${
            error instanceof Error ? error.message : "unknown error"
          }.`,
          suggestion: "Run FreshstartCI with --verbose and file an issue if this persists.",
        },
      ],
      durationMs: Date.now() - startedAt,
    });
  }
}

/**
 * Creates a clean temporary copy of the repository for dependency installation.
 *
 * @param repoPath - Source repository path.
 * @returns Sandbox path, source cleanliness metadata, and cleanup callback.
 *
 * @example
 * ```ts
 * const sandbox = await createCleanRepositoryCopy("/repo");
 * await sandbox.cleanup();
 * ```
 */
export async function createCleanRepositoryCopy(repoPath: string): Promise<DependencySandbox> {
  const sourceHadNodeModules = await hasAnyNodeModules(repoPath);
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), "freshstart-ci-install-"));
  const sandboxRepoPath = path.join(sandboxRoot, "repo");

  await cp(repoPath, sandboxRepoPath, {
    recursive: true,
    filter: (source): boolean => !isExcludedCopyPath(repoPath, source),
  });

  return {
    repoPath: sandboxRepoPath,
    sourceHadNodeModules,
    cleanup: async (): Promise<void> => {
      await rm(sandboxRoot, { recursive: true, force: true });
    },
  };
}

async function runInstallCommand(command: DependencyCommand): Promise<DependencyCommandResult> {
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

async function resolveInstallCommand(
  repoPath: string,
  packageManager: PackageManager,
): Promise<{ command: string; args: string[] }> {
  if (packageManager === "pnpm") {
    return { command: "pnpm", args: ["install", "--frozen-lockfile"] };
  }

  if (packageManager === "yarn") {
    return { command: "yarn", args: ["install", "--frozen-lockfile"] };
  }

  if (packageManager === "bun") {
    return { command: "bun", args: ["install", "--frozen-lockfile"] };
  }

  return {
    command: "npm",
    args: (await fileExists(path.join(repoPath, "package-lock.json"))) ? ["ci"] : ["install"],
  };
}

function result(input: Omit<CheckResult, "checkId" | "name" | "passed">): CheckResult {
  return {
    checkId: "dependencies",
    name: "Dependency installation",
    passed: input.status === "pass" || input.status === "warn" || input.status === "skip",
    ...input,
  };
}

function classifyInstallFailure(stderr: string): CheckDetail {
  const normalized = stderr.toLowerCase();

  if (
    normalized.includes("e401") ||
    normalized.includes("e403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("authentication")
  ) {
    return {
      type: "error",
      message: "Dependency install failed because a package registry requires authentication.",
      suggestion: "Check private package registry credentials or document required npm auth setup.",
    };
  }

  return {
    type: "error",
    message: firstUsefulLine(stderr) ?? "Package manager exited with a non-zero status.",
    suggestion:
      "Run the install command locally in a clean clone and fix the reported package error.",
  };
}

function hasPeerDependencyWarning(output: string): boolean {
  const normalized = output.toLowerCase();

  return normalized.includes("peer dep") || normalized.includes("peer dependency");
}

function firstUsefulLine(output: string): string | undefined {
  return output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function isExcludedCopyPath(repoPath: string, source: string): boolean {
  const relative = path.relative(repoPath, source);
  const firstSegment = relative.split(path.sep)[0];

  return (
    firstSegment === ".git" ||
    firstSegment === "node_modules" ||
    firstSegment === "dist" ||
    firstSegment === ".next"
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasAnyNodeModules(dirPath: string): Promise<boolean> {
  if (await fileExists(path.join(dirPath, "node_modules"))) {
    return true;
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        entry.name !== ".git" &&
        entry.name !== "dist" &&
        entry.name !== ".next"
      ) {
        const subPath = path.join(dirPath, entry.name);
        if (await hasAnyNodeModules(subPath)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return false;
}
