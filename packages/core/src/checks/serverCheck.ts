import { spawn, type ChildProcess } from "node:child_process";

import { request } from "undici";

import type { CheckContext, CheckResult } from "../types/index.js";

export interface ServerProcess {
  pid?: number;
  hasExited: () => boolean;
  stderrLines: () => string[];
  kill: () => Promise<void>;
}

export interface ServerCheckOptions {
  timeoutMs?: number;
  startProcess?: (command: string, cwd: string) => Promise<ServerProcess>;
  waitForServer?: (
    port: number,
    timeoutMs: number,
    serverProcess: ServerProcess,
  ) => Promise<boolean>;
}

const DEFAULT_SERVER_TIMEOUT_MS = 30000;

/**
 * Starts the detected server command and waits for its port to respond.
 *
 * @param context - Shared check context with start command and port.
 * @param options - Optional process and polling hooks for tests.
 * @returns Server startup check result.
 *
 * @example
 * ```ts
 * const result = await runServerCheck(context);
 * result.status;
 * ```
 */
export async function runServerCheck(
  context: CheckContext,
  options: ServerCheckOptions = {},
): Promise<CheckResult> {
  const startedAt = Date.now();
  const maxScore = context.config.scoring.weights.server;
  const framework = (context.detectedFramework as any)?.detectedFramework || context.detectedFramework;
  const startCommand = framework?.startCommand?.trim() ?? "";

  try {
    if (startCommand.length === 0) {
      return result({
        score: maxScore,
        maxScore,
        status: "skip",
        summary: "No start command detected; server check is not applicable.",
        details: [
          {
            type: "info",
            message: "No start or dev command was detected.",
            suggestion: "Add a start script so FreshstartCI can verify server startup.",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    }

    const startProcess = options.startProcess ?? startServerProcess;
    const waitForServer = options.waitForServer ?? waitForPort;
    const serverProcess = await startProcess(startCommand, context.repoPath);

    try {
      const opened = await waitForServer(
        framework?.port ?? 3000,
        options.timeoutMs ?? DEFAULT_SERVER_TIMEOUT_MS,
        serverProcess,
      );

      if (opened) {
        return result({
          score: maxScore,
          maxScore,
          status: "pass",
          summary: "Server starts and opens its port.",
          details: [],
          durationMs: Date.now() - startedAt,
        });
      }

      return result({
        score: 0,
        maxScore,
        status: "fail",
        summary: serverProcess.hasExited()
          ? "Server process exited before opening its port."
          : "Server did not open its port before timeout.",
        details: [
          {
            type: "error",
            message:
              tail(serverProcess.stderrLines()).join("\n") || "No server stderr was captured.",
            suggestion: serverProcess.hasExited()
              ? "Fix the startup error shown above."
              : "Check whether the app binds to the detected port or needs external services.",
          },
        ],
        durationMs: Date.now() - startedAt,
      });
    } finally {
      await serverProcess.kill();
    }
  } catch (error) {
    return result({
      score: 0,
      maxScore,
      status: "fail",
      summary: "Server start check crashed.",
      details: [
        {
          type: "error",
          message: `Server start check failed unexpectedly: ${
            error instanceof Error ? error.message : "unknown error"
          }.`,
          suggestion: "Run FreshstartCI with --verbose and file an issue if this persists.",
        },
      ],
      durationMs: Date.now() - startedAt,
    });
  }
}

async function startServerProcess(command: string, cwd: string): Promise<ServerProcess> {
  const [binary, ...args] = splitCommand(command);
  const child = spawn(binary ?? command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderrLines: string[] = [];
  let exited = false;

  child.stderr.on("data", (chunk: Buffer): void => {
    stderrLines.push(
      ...chunk
        .toString("utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0),
    );
  });
  child.on("exit", (): void => {
    exited = true;
  });

  return {
    ...(child.pid !== undefined ? { pid: child.pid } : {}),
    hasExited: () => exited,
    stderrLines: () => stderrLines,
    kill: async (): Promise<void> => {
      killProcessGroup(child);
    },
  };
}

async function waitForPort(
  port: number,
  timeoutMs: number,
  serverProcess: ServerProcess,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (serverProcess.hasExited()) {
      return false;
    }

    try {
      await request(`http://localhost:${port}/`, {
        method: "HEAD",
        bodyTimeout: 1000,
        headersTimeout: 1000,
      });
      return true;
    } catch {
      await sleep(250);
    }
  }

  return false;
}

async function killProcessGroup(child: ChildProcess, gracePeriodMs = 3000): Promise<void> {
  if (child.pid === undefined || child.exitCode !== null) {
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }

  const deadline = Date.now() + gracePeriodMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      return;
    }
    await sleep(100);
  }

  // Grace period expired; force kill process group with SIGKILL
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

function splitCommand(command: string): string[] {
  return (command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [command]).map((part) =>
    part.replace(/^"|"$/g, ""),
  );
}

function tail(lines: string[]): string[] {
  return lines.slice(-20);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function result(input: Omit<CheckResult, "checkId" | "name" | "passed">): CheckResult {
  return {
    checkId: "server",
    name: "Server start",
    passed: input.status === "pass" || input.status === "warn" || input.status === "skip",
    ...input,
  };
}
