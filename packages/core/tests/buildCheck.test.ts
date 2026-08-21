import { describe, expect, it } from "vitest";

import { runBuildCheck, type BuildCheckOptions } from "../src/checks/buildCheck.js";
import { DEFAULT_CONFIG, type CheckContext } from "../src/types/index.js";

describe("runBuildCheck", () => {
  it("skips with full score when no build command is detected", async () => {
    const result = await runBuildCheck(context(""));

    expect(result.status).toBe("skip");
    expect(result.score).toBe(20);
  });

  it("passes when the build exits cleanly", async () => {
    const result = await runBuildCheck(
      context("npm run build"),
      options(async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false })),
    );

    expect(result.status).toBe("pass");
    expect(result.score).toBe(20);
  });

  it("warns when the build exits cleanly with warnings", async () => {
    const result = await runBuildCheck(
      context("vite build"),
      options(async () => ({
        exitCode: 0,
        stdout: "warning: large chunk",
        stderr: "",
        timedOut: false,
      })),
    );

    expect(result.status).toBe("warn");
    expect(result.score).toBe(18);
  });

  it("fails with a module-specific suggestion when a module is missing", async () => {
    const result = await runBuildCheck(
      context("next build"),
      options(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "Error: Cannot find module 'sharp'",
        timedOut: false,
      })),
    );

    expect(result.status).toBe("fail");
    expect(result.details[0]?.message).toContain("sharp");
  });

  it("fails when the build times out", async () => {
    const result = await runBuildCheck(
      context("npm run build"),
      options(async () => ({ exitCode: 1, stdout: "", stderr: "", timedOut: true })),
    );

    expect(result.status).toBe("fail");
    expect(result.summary).toBe("Build timed out.");
  });

  it("handles nested detectedFramework and undefined buildCommand safely", async () => {
    const customContext = {
      repoPath: process.cwd(),
      config: DEFAULT_CONFIG,
      packageManager: "npm",
      detectedFramework: {
        detectedFramework: {
          name: "vite",
          buildCommand: undefined,
          startCommand: "vite preview",
          port: 5173,
          healthPath: "/",
        },
      },
      env: {},
    } as unknown as CheckContext;

    const result = await runBuildCheck(customContext);
    expect(result.status).toBe("skip");
    expect(result.score).toBe(20);
  });
});

function options(runCommand: NonNullable<BuildCheckOptions["runCommand"]>): BuildCheckOptions {
  return { runCommand };
}

function context(buildCommand: string): CheckContext {
  return {
    repoPath: process.cwd(),
    config: DEFAULT_CONFIG,
    packageManager: "npm",
    detectedFramework: {
      name: "unknown",
      startCommand: "",
      buildCommand,
      port: 3000,
      healthPath: "/",
    },
    env: {},
  };
}
