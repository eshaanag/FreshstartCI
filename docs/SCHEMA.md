# FreshstartCI Schema Reference

## TypeScript Types

```typescript
export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
export type CheckId =
  | "dependencies"
  | "env"
  | "build"
  | "test"
  | "server"
  | "health"
  | "readme"
  | "examples"
  | "docs";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type CheckStatus = "pass" | "warn" | "fail" | "skip";
export type DetailType = "error" | "warning" | "info";

export interface CheckContext {
  repoPath: string;
  config: FreshstartConfig;
  packageManager: PackageManager;
  detectedFramework: DetectedFramework;
  env: Record<string, string>;
}

export interface CheckResult {
  checkId: CheckId;
  name: string;
  passed: boolean;
  score: number;
  maxScore: number;
  status: CheckStatus;
  summary: string;
  details: CheckDetail[];
  fix?: AutoFix;
  durationMs: number;
}

export interface CheckDetail {
  type: DetailType;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface AutoFix {
  description: string;
  apply: () => Promise<void>;
}

export interface QuickstartHealthScore {
  total: number;
  grade: Grade;
  checks: CheckResult[];
  repoPath: string;
  timestamp: string;
  durationMs: number;
  version: string;
}

export interface FreshstartConfig {
  checks: ChecksConfig;
  scoring: ScoringConfig;
  failBelow: number;
  ignore: string[];
  packageManager: "auto" | PackageManager;
}

export interface ChecksConfig {
  dependencies: boolean;
  env: boolean;
  build: boolean;
  test: boolean;
  server: boolean;
  health: HealthCheckConfig;
  readme: boolean;
  examples: boolean;
  docs: boolean;
}

export interface HealthCheckConfig {
  enabled: boolean;
  port: number;
  path: string;
  timeout: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
}

export interface ScoringWeights {
  dependencies: number;
  env: number;
  build: number;
  server: number;
  readme: number;
}

export interface DetectedFramework {
  name: string;
  startCommand: string;
  buildCommand: string;
  port: number;
  healthPath: string;
}

export interface ScoreReport {
  schemaVersion: "1.0";
  score: QuickstartHealthScore;
  config: FreshstartConfig;
  summary: ReportSummary;
}

export interface ReportSummary {
  passed: number;
  warnings: number;
  failed: number;
  skipped: number;
}

export interface FixResult {
  description: string;
  applied: boolean;
  file?: string;
  error?: string;
}
```

## Config File

Example `.freshstart.yml`:

```yaml
checks:
  dependencies: true
  env: true
  build: true
  test: true
  server: true
  health:
    enabled: true
    port: 3000
    path: /health
    timeout: 10000
  readme: true
  examples: false
  docs: false

scoring:
  weights:
    dependencies: 20
    env: 20
    build: 20
    server: 20
    readme: 20

fail-below: 80
ignore:
  - examples/legacy/
package-manager: auto
```

## Zod Schemas

```typescript
import { z } from "zod";

export const PackageManagerSchema = z.enum(["auto", "npm", "yarn", "pnpm", "bun"]);

export const HealthCheckConfigSchema = z.object({
  enabled: z
    .boolean({
      invalid_type_error: "checks.health.enabled must be a boolean",
    })
    .default(true),
  port: z
    .number({
      invalid_type_error: "checks.health.port must be a number",
    })
    .int()
    .min(1)
    .max(65535)
    .default(3000),
  path: z
    .string({
      invalid_type_error: "checks.health.path must be a string",
    })
    .startsWith("/")
    .default("/health"),
  timeout: z
    .number({
      invalid_type_error: "checks.health.timeout must be a number",
    })
    .int()
    .positive()
    .default(10000),
});

export const ChecksConfigSchema = z.object({
  dependencies: z
    .boolean({
      invalid_type_error: "checks.dependencies must be a boolean",
    })
    .default(true),
  env: z
    .boolean({
      invalid_type_error: "checks.env must be a boolean",
    })
    .default(true),
  build: z
    .boolean({
      invalid_type_error: "checks.build must be a boolean",
    })
    .default(true),
  test: z
    .boolean({
      invalid_type_error: "checks.test must be a boolean",
    })
    .default(true),
  server: z
    .boolean({
      invalid_type_error: "checks.server must be a boolean",
    })
    .default(true),
  health: HealthCheckConfigSchema.default({}),
  readme: z
    .boolean({
      invalid_type_error: "checks.readme must be a boolean",
    })
    .default(true),
  examples: z
    .boolean({
      invalid_type_error: "checks.examples must be a boolean",
    })
    .default(false),
  docs: z
    .boolean({
      invalid_type_error: "checks.docs must be a boolean",
    })
    .default(false),
});

export const ScoringWeightsSchema = z.object({
  dependencies: z.number().nonnegative().default(20),
  env: z.number().nonnegative().default(20),
  build: z.number().nonnegative().default(20),
  server: z.number().nonnegative().default(20),
  readme: z.number().nonnegative().default(20),
});

export const FreshstartConfigSchema = z.object({
  checks: ChecksConfigSchema.default({}),
  scoring: z
    .object({
      weights: ScoringWeightsSchema.default({}),
    })
    .default({}),
  failBelow: z
    .number({
      invalid_type_error: "fail-below must be a number",
    })
    .min(0)
    .max(100)
    .default(80),
  ignore: z
    .array(z.string(), {
      invalid_type_error: "ignore must be a list of strings",
    })
    .default([]),
  packageManager: PackageManagerSchema.default("auto"),
});
```

The implementation maps YAML key `fail-below` to `failBelow` and `package-manager` to `packageManager` before validation.

## JSON Report Format

```json
{
  "schemaVersion": "1.0",
  "score": {
    "total": 87,
    "grade": "B",
    "repoPath": "/repo",
    "timestamp": "2026-06-08T16:30:00.000Z",
    "durationMs": 12450,
    "version": "0.1.0",
    "checks": []
  },
  "config": {},
  "summary": {
    "passed": 3,
    "warnings": 1,
    "failed": 1,
    "skipped": 0
  }
}
```

`schemaVersion` is stable and required so integrations can detect breaking report changes.

## Badge Server Storage Schema

```typescript
export interface StoredScore {
  owner: string;
  repo: string;
  score: number;
  grade: Grade;
  timestamp: string;
  version: string;
  reportUrl: string;
}

export interface ScoreHistory {
  owner: string;
  repo: string;
  latest: StoredScore;
  history: StoredScore[];
}

export interface RepoTokenRecord {
  owner: string;
  repo: string;
  tokenHash: string;
  createdAt: string;
  lastUsedAt?: string;
}
```

KV keys:

- `score:{owner}:{repo}:latest`
- `score:{owner}:{repo}:history`
- `token:{owner}:{repo}`
