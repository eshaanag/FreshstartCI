import { request } from "undici";

import type { CheckContext, CheckResult } from "../types/index.js";

export interface HealthCheckResponse {
  statusCode: number;
  body: string;
}

export interface HealthCheckOptions {
  requestHealth?: (url: string, timeoutMs: number) => Promise<HealthCheckResponse>;
}

const PASSING_STATUS_CODES = new Set([200, 201, 204, 301, 302]);

/**
 * Requests the detected local health endpoint and scores the response.
 *
 * @param context - Shared check context with detected port and health path.
 * @param options - Optional request hook for tests.
 * @returns Health check result.
 *
 * @example
 * ```ts
 * const result = await runHealthCheck(context);
 * result.score;
 * ```
 */
export async function runHealthCheck(
  context: CheckContext,
  options: HealthCheckOptions = {},
): Promise<CheckResult> {
  const startedAt = Date.now();
  const maxScore = context.config.scoring.weights.server;
  const healthConfig = context.config.checks.health;
  const framework = (context.detectedFramework as any)?.detectedFramework || context.detectedFramework;
  const port = framework?.port ?? 3000;
  const healthPath = framework?.healthPath || healthConfig?.path || "/";
  const url = `http://localhost:${port}${healthPath}`;

  try {
    const requestHealth = options.requestHealth ?? requestHealthEndpoint;
    const response = await requestHealth(url, healthConfig.timeout);

    if (PASSING_STATUS_CODES.has(response.statusCode)) {
      return result({
        score: maxScore,
        maxScore,
        status: "pass",
        summary: "Health endpoint responds successfully.",
        details: [],
        durationMs: Date.now() - startedAt,
      });
    }

    return result({
      score: Math.round(maxScore * 0.5),
      maxScore,
      status: "warn",
      summary: `Health endpoint returned HTTP ${response.statusCode}.`,
      details: [
        {
          type: "warning",
          message: response.body.slice(0, 500) || `HTTP ${response.statusCode}`,
          suggestion: "Return a 2xx or redirect response from the configured health endpoint.",
        },
      ],
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return result({
      score: 0,
      maxScore,
      status: "fail",
      summary: "Health endpoint could not be reached.",
      details: [
        {
          type: "error",
          message: error instanceof Error ? error.message : "Health request failed.",
          suggestion:
            "Ensure the server starts and listens on the detected port before health checks run.",
        },
      ],
      durationMs: Date.now() - startedAt,
    });
  }
}

async function requestHealthEndpoint(url: string, timeoutMs: number): Promise<HealthCheckResponse> {
  const response = await request(url, {
    method: "GET",
    bodyTimeout: timeoutMs,
    headersTimeout: timeoutMs,
  });

  return {
    statusCode: response.statusCode,
    body: await response.body.text(),
  };
}

function result(input: Omit<CheckResult, "checkId" | "name" | "passed">): CheckResult {
  return {
    checkId: "health",
    name: "Health check",
    passed: input.status === "pass" || input.status === "warn" || input.status === "skip",
    ...input,
  };
}
