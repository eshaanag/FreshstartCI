import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runDependencyCheck, type DependencyCheckOptions } from "../src/checks/dependencyCheck.js";
import { DEFAULT_CONFIG, type CheckContext } from "../src/types/index.js";

const createdPaths: string[] = [];

describe("runDependencyCheck", () => {
  afterEach(async () => {
    await Promise.all(
      createdPaths.splice(0).map((repoPath) => rm(repoPath, { recursive: true, force: true })),
    );
  });

  it("passes when install succeeds and node_modules is created", async () => {
    const repoPath = await createRepo();
    const result = await runDependencyCheck(
      context(repoPath),
      optionsForCommand(async (command) => {
        await mkdir(path.join(command.cwd, "node_modules"));

        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      }),
    );

    expect(result.status).toBe("pass");
    expect(result.score).toBe(20);
  });

  it("warns when install reports peer dependency warnings", async () => {
    const repoPath = await createRepo();
    const result = await runDependencyCheck(
      context(repoPath),
      optionsForCommand(async (command) => {
        await mkdir(path.join(command.cwd, "node_modules"));

        return {
          exitCode: 0,
          stdout: "",
          stderr: "warning unmet peer dependency react@18",
          timedOut: false,
        };
      }),
    );

    expect(result.status).toBe("warn");
    expect(result.score).toBe(16);
    expect(result.details[0]?.message).toContain("peer dependency warnings");
  });

  it("fails with an auth-specific message for private package auth errors", async () => {
    const repoPath = await createRepo();
    const result = await runDependencyCheck(
      context(repoPath),
      optionsForCommand(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "npm ERR! code E401 Unauthorized",
        timedOut: false,
      })),
    );

    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
    expect(result.details[0]?.message).toContain("requires authentication");
  });

  it("fails when install times out", async () => {
    const repoPath = await createRepo();
    const result = await runDependencyCheck(
      context(repoPath),
      optionsForCommand(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
        timedOut: true,
      })),
    );

    expect(result.status).toBe("fail");
    expect(result.summary).toBe("Dependency install timed out.");
  });

  it("skips when package.json is missing", async () => {
    const repoPath = await mkdtemp(path.join(tmpdir(), "freshstart-deps-no-package-"));
    createdPaths.push(repoPath);

    const result = await runDependencyCheck(context(repoPath));

    expect(result.status).toBe("skip");
    expect(result.score).toBe(20);
  });
});

function optionsForCommand(
  runCommand: NonNullable<DependencyCheckOptions["runCommand"]>,
): DependencyCheckOptions {
  return {
    createSandbox: async (repoPath) => ({
      repoPath,
      sourceHadNodeModules: false,
      cleanup: async (): Promise<void> => {},
    }),
    runCommand,
  };
}

async function createRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(tmpdir(), "freshstart-deps-"));
  createdPaths.push(repoPath);
  await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ scripts: {} }));

  return repoPath;
}

function context(repoPath: string): CheckContext {
  return {
    repoPath,
    config: DEFAULT_CONFIG,
    packageManager: "npm",
    detectedFramework: {
      name: "unknown",
      startCommand: "",
      buildCommand: "",
      port: 3000,
      healthPath: "/",
    },
    env: {},
  };
}
