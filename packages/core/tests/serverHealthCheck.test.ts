import { describe, expect, it } from "vitest";

import { runHealthCheck } from "../src/checks/healthCheck.js";
import { runServerCheck, type ServerProcess } from "../src/checks/serverCheck.js";
import { DEFAULT_CONFIG, type CheckContext } from "../src/types/index.js";

describe("runServerCheck", () => {
  it("passes when the server port opens", async () => {
    let killed = false;
    const result = await runServerCheck(context(), {
      startProcess: async () =>
        fakeServerProcess({
          kill: async () => {
            killed = true;
          },
        }),
      waitForServer: async () => true,
    });

    expect(result.status).toBe("pass");
    expect(result.score).toBe(20);
    expect(killed).toBe(true);
  });

  it("fails when the server never opens its port", async () => {
    const result = await runServerCheck(context(), {
      startProcess: async () => fakeServerProcess({ stderr: ["waiting for db"] }),
      waitForServer: async () => false,
    });

    expect(result.status).toBe("fail");
    expect(result.summary).toContain("timeout");
    expect(result.details[0]?.message).toContain("waiting for db");
  });

  it("reports early process exit", async () => {
    const result = await runServerCheck(context(), {
      startProcess: async () => fakeServerProcess({ exited: true, stderr: ["EADDRINUSE"] }),
      waitForServer: async () => false,
    });

    expect(result.summary).toContain("exited");
    expect(result.details[0]?.message).toContain("EADDRINUSE");
  });
});

describe("runHealthCheck", () => {
  it("passes on a successful health response", async () => {
    const result = await runHealthCheck(context(), {
      requestHealth: async () => ({ statusCode: 200, body: "ok" }),
    });

    expect(result.status).toBe("pass");
    expect(result.score).toBe(20);
  });

  it("warns and gives partial score on failing HTTP status", async () => {
    const result = await runHealthCheck(context(), {
      requestHealth: async () => ({ statusCode: 500, body: "database unavailable" }),
    });

    expect(result.status).toBe("warn");
    expect(result.score).toBe(10);
  });

  it("fails when the health endpoint cannot be reached", async () => {
    const result = await runHealthCheck(context(), {
      requestHealth: async () => {
        throw new Error("connection refused");
      },
    });

    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
  });
});

function fakeServerProcess(options: {
  exited?: boolean;
  stderr?: string[];
  kill?: () => Promise<void>;
}): ServerProcess {
  return {
    pid: 123,
    hasExited: () => options.exited ?? false,
    stderrLines: () => options.stderr ?? [],
    kill: options.kill ?? (async (): Promise<void> => {}),
  };
}

function context(): CheckContext {
  return {
    repoPath: process.cwd(),
    config: DEFAULT_CONFIG,
    packageManager: "npm",
    detectedFramework: {
      name: "express",
      startCommand: "node server.js",
      buildCommand: "",
      port: 3000,
      healthPath: "/health",
    },
    env: {},
  };
}
