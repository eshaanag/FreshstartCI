import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type {
  DetectedFramework,
  DetectionWarning,
  PackageManager,
  PackageManagerPreference,
  ProjectDetectionResult,
} from "../types/index.js";

interface PackageManagerDetection {
  packageManager: PackageManager;
  warnings: DetectionWarning[];
}

const LOCKFILE_PRIORITY: Array<{ file: string; packageManager: PackageManager }> = [
  { file: "pnpm-lock.yaml", packageManager: "pnpm" },
  { file: "yarn.lock", packageManager: "yarn" },
  { file: "package-lock.json", packageManager: "npm" },
  { file: "bun.lockb", packageManager: "bun" },
  { file: "bun.lock", packageManager: "bun" },
];

const PackageJsonSchema = z
  .object({
    scripts: z.record(z.string()).optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

type PackageJson = z.infer<typeof PackageJsonSchema>;

const UNKNOWN_FRAMEWORK: DetectedFramework = {
  name: "unknown",
  startCommand: "",
  buildCommand: "",
  port: 3000,
  healthPath: "/",
};

/**
 * Detects the package manager, framework, commands, port, and health path for a repository.
 *
 * @param repoPath - Absolute or relative path to the repository root.
 * @param packageManagerPreference - Optional package-manager override from config.
 * @returns Structured project detection data and warnings.
 *
 * @example
 * ```ts
 * const detection = await detectProject(process.cwd(), "auto");
 * detection.detectedFramework.name;
 * ```
 */
export async function detectProject(
  repoPath: string,
  packageManagerPreference: PackageManagerPreference = "auto",
): Promise<ProjectDetectionResult> {
  const warnings: DetectionWarning[] = [];
  const packageJsonPath = path.join(repoPath, "package.json");
  const packageJson = await readPackageJson(packageJsonPath, warnings);

  if (packageJson === null) {
    return {
      isNodeProject: false,
      packageManager: packageManagerPreference === "auto" ? "npm" : packageManagerPreference,
      detectedFramework: UNKNOWN_FRAMEWORK,
      warnings: [
        ...warnings,
        {
          message: "No package.json found; FreshstartCI will treat this as a non-Node project.",
          file: "package.json",
          suggestion: "Run FreshstartCI in a Node.js project root or add a package.json.",
        },
      ],
    };
  }

  const packageManagerDetection = await detectPackageManager(repoPath, packageManagerPreference);
  const detectedFramework = await detectFramework(repoPath, packageJson, warnings);

  return {
    isNodeProject: true,
    packageManager: packageManagerDetection.packageManager || "npm",
    detectedFramework,
    warnings: [...warnings, ...packageManagerDetection.warnings],
    packageJsonPath,
  };
}

/**
 * Detects the package manager from config override or lockfiles.
 *
 * @param repoPath - Repository root path.
 * @param packageManagerPreference - Configured package-manager preference.
 * @returns Detected package manager and lockfile conflict warnings.
 *
 * @example
 * ```ts
 * const result = await detectPackageManager("/repo", "auto");
 * result.packageManager;
 * ```
 */
export async function detectPackageManager(
  repoPath: string,
  packageManagerPreference: PackageManagerPreference = "auto",
): Promise<PackageManagerDetection> {
  if (packageManagerPreference !== "auto") {
    return {
      packageManager: packageManagerPreference,
      warnings: [],
    };
  }

  const presentLockfiles: Array<{ file: string; packageManager: PackageManager }> = [];

  for (const lockfile of LOCKFILE_PRIORITY) {
    if (await fileExists(path.join(repoPath, lockfile.file))) {
      presentLockfiles.push(lockfile);
    }
  }

  if (presentLockfiles.length === 0) {
    return {
      packageManager: "npm",
      warnings: [
        {
          message: "No lockfile found; defaulting to npm.",
          suggestion: "Commit a lockfile so fresh installs are deterministic.",
        },
      ],
    };
  }

  const selected = presentLockfiles[0];

  if (selected === undefined) {
    return {
      packageManager: "npm",
      warnings: [
        {
          message: "No usable lockfile found; defaulting to npm.",
          suggestion: "Commit a lockfile so fresh installs are deterministic.",
        },
      ],
    };
  }
  const warnings =
    presentLockfiles.length > 1
      ? [
          {
            message: `Multiple lockfiles found (${presentLockfiles
              .map((lockfile) => lockfile.file)
              .join(", ")}); using ${selected.packageManager} by priority.`,
            suggestion: "Keep one lockfile to avoid package-manager drift.",
          },
        ]
      : [];

  return {
    packageManager: selected.packageManager,
    warnings,
  };
}

async function detectFramework(
  repoPath: string,
  packageJson: PackageJson,
  warnings: DetectionWarning[],
): Promise<DetectedFramework> {
  const scripts = packageJson.scripts ?? {};
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  const healthPath = await inferHealthPath(repoPath);

  if (hasDependency(dependencies, "next")) {
    const startCommand = scripts.start ?? "next start";
    const buildCommand = scripts.build ?? "next build";

    return framework(
      "next",
      startCommand,
      buildCommand,
      parsePort(startCommand) ?? 3000,
      healthPath,
    );
  }

  if (hasDependency(dependencies, "vite")) {
    const startCommand = scripts.start ?? scripts.preview ?? "vite preview";
    const buildCommand = scripts.build ?? "vite build";

    return framework(
      "vite",
      startCommand,
      buildCommand,
      parsePort(startCommand) ?? 5173,
      healthPath,
    );
  }

  if (hasDependency(dependencies, "astro")) {
    const startCommand = scripts.start ?? scripts.preview ?? "astro preview";
    const buildCommand = scripts.build ?? "astro build";

    return framework(
      "astro",
      startCommand,
      buildCommand,
      parsePort(startCommand) ?? 4321,
      healthPath,
    );
  }

  if (hasDependency(dependencies, "nuxt")) {
    const startCommand = scripts.start ?? "nuxt start";
    const buildCommand = scripts.build ?? "nuxt build";

    return framework(
      "nuxt",
      startCommand,
      buildCommand,
      parsePort(startCommand) ?? 3000,
      healthPath,
    );
  }

  if (
    hasDependency(dependencies, "express") ||
    hasDependency(dependencies, "fastify") ||
    hasDependency(dependencies, "hono")
  ) {
    const startCommand = inferStartCommand(scripts, warnings);

    return framework(
      "node-server",
      startCommand,
      scripts.build ?? "",
      parsePort(startCommand) ?? 3000,
      healthPath,
    );
  }

  const startCommand = inferStartCommand(scripts, warnings);

  return framework(
    "unknown",
    startCommand,
    scripts.build ?? "",
    parsePort(startCommand) ?? 3000,
    healthPath,
  );
}

function inferStartCommand(scripts: Record<string, string>, warnings: DetectionWarning[]): string {
  if (scripts.start !== undefined) {
    return scripts.start;
  }

  if (scripts.dev !== undefined) {
    warnings.push({
      message: "package.json has no start script; falling back to dev script.",
      file: "package.json",
      suggestion: "Add a start script for production-like quickstart checks.",
    });

    return scripts.dev;
  }

  warnings.push({
    message: "package.json has no start or dev script.",
    file: "package.json",
    suggestion: "Add a start script so FreshstartCI can verify server startup.",
  });

  return "";
}

function framework(
  name: string,
  startCommand: string,
  buildCommand: string,
  port: number,
  healthPath: string,
): DetectedFramework {
  return {
    name,
    startCommand,
    buildCommand,
    port,
    healthPath,
  };
}

function hasDependency(dependencies: Record<string, string>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(dependencies, name);
}

function parsePort(command: string): number | undefined {
  const match =
    command.match(/(?:--port|-p)\s+(\d{2,5})/) ??
    command.match(/PORT=(\d{2,5})/) ??
    command.match(/localhost:(\d{2,5})/) ??
    command.match(/:(\d{2,5})/);

  if (match?.[1] === undefined) {
    return undefined;
  }

  const port = Number.parseInt(match[1], 10);

  return port >= 1 && port <= 65535 ? port : undefined;
}

async function inferHealthPath(repoPath: string): Promise<string> {
  const searchableFiles = await listSearchableRootFiles(repoPath);

  for (const candidate of ["/health", "/healthz"]) {
    for (const file of searchableFiles) {
      const contents = await readFile(file, "utf8");

      if (hasPathLiteral(contents, candidate)) {
        return candidate;
      }
    }
  }

  return "/";
}

function hasPathLiteral(contents: string, candidate: string): boolean {
  return (
    contents.includes(`"${candidate}"`) ||
    contents.includes(`'${candidate}'`) ||
    contents.includes(`\`${candidate}\``)
  );
}

async function listSearchableRootFiles(repoPath: string): Promise<string[]> {
  try {
    const entries = await readdir(repoPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && /\.(?:js|jsx|ts|tsx|mjs|cjs|json|md)$/.test(entry.name)) {
        files.push(path.join(repoPath, entry.name));
      }
    }

    return files;
  } catch {
    return [];
  }
}

async function readPackageJson(
  packageJsonPath: string,
  warnings: DetectionWarning[],
): Promise<PackageJson | null> {
  try {
    const rawPackageJson = await readFile(packageJsonPath, "utf8");
    const parsedPackageJson: unknown = JSON.parse(rawPackageJson);
    const result = PackageJsonSchema.safeParse(parsedPackageJson);

    if (!result.success) {
      warnings.push({
        message: "package.json has an unsupported shape.",
        file: "package.json",
        suggestion:
          "Ensure scripts, dependencies, and devDependencies are objects with string values.",
      });

      return {
        scripts: {},
        dependencies: {},
        devDependencies: {},
      };
    }

    return result.data;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    warnings.push({
      message: `Could not parse package.json: ${error instanceof Error ? error.message : "unknown error"}.`,
      file: "package.json",
      suggestion: "Fix package.json syntax before running FreshstartCI.",
    });

    return {
      scripts: {},
      dependencies: {},
      devDependencies: {},
    };
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT"
  );
}
