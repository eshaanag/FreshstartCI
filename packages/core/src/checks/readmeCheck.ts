import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { remark } from "remark";
import remarkGfm from "remark-gfm";
import { z } from "zod";

import type { CheckContext, CheckDetail, CheckResult, PackageManager } from "../types/index.js";

interface MarkdownNode {
  type?: string;
  lang?: string;
  value?: string;
  children?: MarkdownNode[];
}

interface ReadmeCommand {
  command: string;
  blockIndex: number;
}

interface PackageJsonForReadme {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh"]);
const SYSTEM_COMMANDS = new Set([
  "cd",
  "cp",
  "cat",
  "mkdir",
  "touch",
  "echo",
  "export",
  "pwd",
  "ls",
]);

const PackageJsonSchema = z
  .object({
    scripts: z.record(z.string()).optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

/**
 * Checks whether shell commands in the root README still match the repository.
 *
 * @param context - Shared check context with repo path and detected package manager.
 * @returns README command validity result with drift details.
 *
 * @example
 * ```ts
 * const result = await runReadmeCheck(context);
 * result.summary;
 * ```
 */
export async function runReadmeCheck(context: CheckContext): Promise<CheckResult> {
  const startedAt = Date.now();
  const maxScore = context.config.scoring.weights.readme;

  try {
    const readmePath = path.join(context.repoPath, "README.md");

    if (!(await fileExists(readmePath))) {
      return result({
        score: 0,
        maxScore,
        status: "fail",
        summary: "README.md is missing.",
        details: [
          {
            type: "error",
            message: "README.md does not exist.",
            file: "README.md",
            suggestion: "Add setup instructions with copy-pasteable commands.",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    }

    const commands = extractReadmeCommands(await readFile(readmePath, "utf8"));

    if (commands.length === 0) {
      return result({
        score: Math.round(maxScore * 0.7),
        maxScore,
        status: "warn",
        summary: "No setup commands found in README.md.",
        details: [
          {
            type: "warning",
            message: "README.md has no shell command code blocks.",
            file: "README.md",
            suggestion: "Add install and run commands so new developers can start quickly.",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    }

    const packageJson = await readPackageJson(context.repoPath);
    const driftDetails = await validateCommands(context, packageJson, commands);
    const driftCount = driftDetails.filter((detail) => detail.type === "error").length;

    return result({
      score: scoreForDrift(maxScore, driftCount),
      maxScore,
      status: driftCount === 0 ? "pass" : driftCount >= 3 ? "fail" : "warn",
      summary:
        driftCount === 0
          ? "README commands are current."
          : `${driftCount} README command${driftCount === 1 ? " has" : "s have"} drifted.`,
      details: driftDetails,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return result({
      score: 0,
      maxScore,
      status: "fail",
      summary: "README command check crashed.",
      details: [
        {
          type: "error",
          message: `README command check failed unexpectedly: ${
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
 * Extracts likely shell commands from fenced README code blocks.
 *
 * @param markdown - README markdown contents.
 * @returns Normalized shell command lines.
 *
 * @example
 * ```ts
 * extractReadmeCommands("```bash\nnpm run dev\n```");
 * ```
 */
export function extractReadmeCommands(markdown: string): ReadmeCommand[] {
  const gfmPlugin = typeof remarkGfm === "function" ? remarkGfm : (remarkGfm as { default?: any }).default ?? remarkGfm;
  const tree = remark().use(gfmPlugin).parse(markdown) as MarkdownNode;
  const codeBlocks: MarkdownNode[] = [];
  collectCodeBlocks(tree, codeBlocks);

  return codeBlocks.flatMap((block, index) => {
    const language = block.lang?.toLowerCase();
    const value = block.value ?? "";

    if (language !== undefined && !SHELL_LANGUAGES.has(language)) {
      return [];
    }

    if (language === undefined && !looksLikeShell(value)) {
      return [];
    }

    return value
      .split("\n")
      .map((line) => normalizeCommandLine(line))
      .filter((line): line is string => line !== undefined)
      .map((command) => ({ command, blockIndex: index + 1 }));
  });
}

async function validateCommands(
  context: CheckContext,
  packageJson: PackageJsonForReadme,
  commands: ReadmeCommand[],
): Promise<CheckDetail[]> {
  const details: CheckDetail[] = [];

  for (const command of commands) {
    const parts = command.command.split(/\s+/);
    const binary = parts[0];

    if (binary === undefined) {
      continue;
    }

    if (SYSTEM_COMMANDS.has(binary)) {
      if (binary === "cp") {
        await validateCopyCommand(context.repoPath, parts, command, details);
      }

      continue;
    }

    if (isPackageManager(binary)) {
      validatePackageManagerCommand(context.packageManager, binary, command, details);
      validatePackageScript(packageJson, parts, command, details);
      continue;
    }

    if (binary === "npx") {
      validateNpxCommand(packageJson, parts, command, details);
      continue;
    }

    if (binary === "node") {
      await validateNodeCommand(context.repoPath, parts, command, details);
    }
  }

  return details;
}

function validatePackageManagerCommand(
  expected: PackageManager,
  actual: string,
  command: ReadmeCommand,
  details: CheckDetail[],
): void {
  if (actual === "npm" && command.command === "npm install" && expected !== "npm") {
    details.push({
      type: "error",
      message: `README uses npm install, but detected package manager is ${expected}.`,
      file: "README.md",
      suggestion: `${expected} install`,
    });
  }
}

function validatePackageScript(
  packageJson: PackageJsonForReadme,
  parts: string[],
  command: ReadmeCommand,
  details: CheckDetail[],
): void {
  const scriptName = scriptNameFromCommand(parts);

  if (scriptName === undefined || packageJson.scripts[scriptName] !== undefined) {
    return;
  }

  const suggestion =
    packageJson.scripts.start !== undefined
      ? command.command.replace(scriptName, "start")
      : undefined;

  details.push({
    type: "error",
    message: `README command "${command.command}" references missing script "${scriptName}".`,
    file: "README.md",
    ...(suggestion !== undefined ? { suggestion } : {}),
  });
}

function validateNpxCommand(
  packageJson: PackageJsonForReadme,
  parts: string[],
  command: ReadmeCommand,
  details: CheckDetail[],
): void {
  const binary = parts[1];

  if (
    binary === undefined ||
    packageJson.dependencies[binary] !== undefined ||
    packageJson.devDependencies[binary] !== undefined
  ) {
    return;
  }

  details.push({
    type: "error",
    message: `README command "${command.command}" references "${binary}", but it is not installed.`,
    file: "README.md",
    suggestion: `Add ${binary} as a dependency or update the README command.`,
  });
}

async function validateCopyCommand(
  repoPath: string,
  parts: string[],
  command: ReadmeCommand,
  details: CheckDetail[],
): Promise<void> {
  const source = parts[1];

  if (source !== undefined && !(await fileExists(path.join(repoPath, source)))) {
    details.push({
      type: "error",
      message: `README command "${command.command}" references missing file ${source}.`,
      file: "README.md",
      suggestion: `Create ${source} or update the README command.`,
    });
  }
}

async function validateNodeCommand(
  repoPath: string,
  parts: string[],
  command: ReadmeCommand,
  details: CheckDetail[],
): Promise<void> {
  const scriptPath = parts[1];

  if (scriptPath !== undefined && !(await fileExists(path.join(repoPath, scriptPath)))) {
    details.push({
      type: "error",
      message: `README command "${command.command}" references missing file ${scriptPath}.`,
      file: "README.md",
      suggestion: "Update the command to the current entry file.",
    });
  }
}

async function readPackageJson(repoPath: string): Promise<PackageJsonForReadme> {
  try {
    const raw = await readFile(path.join(repoPath, "package.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const parsedPackageJson = PackageJsonSchema.safeParse(parsed);

    if (!parsedPackageJson.success) {
      return emptyPackageJson();
    }

    return {
      scripts: parsedPackageJson.data.scripts ?? {},
      dependencies: parsedPackageJson.data.dependencies ?? {},
      devDependencies: parsedPackageJson.data.devDependencies ?? {},
    };
  } catch {
    return emptyPackageJson();
  }
}

function collectCodeBlocks(node: MarkdownNode, codeBlocks: MarkdownNode[]): void {
  if (node.type === "code") {
    codeBlocks.push(node);
  }

  for (const child of node.children ?? []) {
    collectCodeBlocks(child, codeBlocks);
  }
}

function normalizeCommandLine(line: string): string | undefined {
  const trimmed = line.trim().replace(/^\$\s*/, "");

  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return undefined;
  }

  return trimmed;
}

function looksLikeShell(value: string): boolean {
  return value
    .split("\n")
    .map((line) => normalizeCommandLine(line))
    .some((line) => line !== undefined && /^(npm|pnpm|yarn|bun|npx|node|cp|cd|mkdir)\b/.test(line));
}

function scriptNameFromCommand(parts: string[]): string | undefined {
  const [binary, firstArg, secondArg] = parts;

  if (binary === "npm" && firstArg === "run") {
    return secondArg;
  }

  if ((binary === "pnpm" || binary === "bun") && firstArg === "run") {
    return secondArg;
  }

  if (binary === "yarn" && firstArg !== undefined && firstArg !== "install") {
    return firstArg === "run" ? secondArg : firstArg;
  }

  return undefined;
}

function scoreForDrift(maxScore: number, driftCount: number): number {
  if (driftCount === 0) {
    return maxScore;
  }

  if (driftCount === 1) {
    return Math.round(maxScore * 0.7);
  }

  if (driftCount === 2) {
    return Math.round(maxScore * 0.4);
  }

  return 0;
}

function isPackageManager(binary: string): boolean {
  return binary === "npm" || binary === "pnpm" || binary === "yarn" || binary === "bun";
}

function emptyPackageJson(): PackageJsonForReadme {
  return {
    scripts: {},
    dependencies: {},
    devDependencies: {},
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function result(input: Omit<CheckResult, "checkId" | "name" | "passed">): CheckResult {
  return {
    checkId: "readme",
    name: "README command validity",
    passed: input.status === "pass" || input.status === "warn" || input.status === "skip",
    ...input,
  };
}
