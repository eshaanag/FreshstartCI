import { z } from "zod";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
export type PackageManagerPreference = "auto" | PackageManager;
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
export type OutputFormat = "terminal" | "markdown" | "json";
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

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
  packageManager: PackageManagerPreference;
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

export interface DetectionWarning {
  message: string;
  file?: string;
  suggestion?: string;
}

export interface ProjectDetectionResult {
  packageManager: PackageManager;
  detectedFramework: DetectedFramework;
  warnings: DetectionWarning[];
}

export interface RunnerOptions {
  repoPath: string;
  onlyChecks?: CheckId[];
  fix: boolean;
  outputFormat: OutputFormat;
  quiet: boolean;
  verbose: boolean;
}

export interface ReporterRenderOptions {
  quiet: boolean;
  verbose: boolean;
  compact: boolean;
}

export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  port: 3000,
  path: "/health",
  timeout: 10000,
};

export const DEFAULT_CHECKS_CONFIG: ChecksConfig = {
  dependencies: true,
  env: true,
  build: true,
  test: true,
  server: true,
  health: DEFAULT_HEALTH_CHECK_CONFIG,
  readme: true,
  examples: false,
  docs: false,
};

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  dependencies: 20,
  env: 20,
  build: 20,
  server: 20,
  readme: 20,
};

export const DEFAULT_CONFIG: FreshstartConfig = {
  checks: DEFAULT_CHECKS_CONFIG,
  scoring: {
    weights: DEFAULT_SCORING_WEIGHTS,
  },
  failBelow: 80,
  ignore: [],
  packageManager: "auto",
};

export const PackageManagerSchema = z.enum(["npm", "yarn", "pnpm", "bun"]);
export const PackageManagerPreferenceSchema = z.enum(["auto", "npm", "yarn", "pnpm", "bun"]);

export const HealthCheckConfigSchema = z
  .object({
    enabled: z
      .boolean({
        invalid_type_error: "checks.health.enabled must be a boolean",
      })
      .default(DEFAULT_HEALTH_CHECK_CONFIG.enabled),
    port: z
      .number({
        invalid_type_error: "checks.health.port must be a number",
      })
      .int("checks.health.port must be an integer")
      .min(1, "checks.health.port must be between 1 and 65535")
      .max(65535, "checks.health.port must be between 1 and 65535")
      .default(DEFAULT_HEALTH_CHECK_CONFIG.port),
    path: z
      .string({
        invalid_type_error: "checks.health.path must be a string",
      })
      .startsWith("/", "checks.health.path must start with /")
      .default(DEFAULT_HEALTH_CHECK_CONFIG.path),
    timeout: z
      .number({
        invalid_type_error: "checks.health.timeout must be a number",
      })
      .int("checks.health.timeout must be an integer")
      .positive("checks.health.timeout must be positive")
      .default(DEFAULT_HEALTH_CHECK_CONFIG.timeout),
  })
  .default(DEFAULT_HEALTH_CHECK_CONFIG);

export const ChecksConfigSchema = z
  .object({
    dependencies: z
      .boolean({
        invalid_type_error: "checks.dependencies must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.dependencies),
    env: z
      .boolean({
        invalid_type_error: "checks.env must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.env),
    build: z
      .boolean({
        invalid_type_error: "checks.build must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.build),
    test: z
      .boolean({
        invalid_type_error: "checks.test must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.test),
    server: z
      .boolean({
        invalid_type_error: "checks.server must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.server),
    health: HealthCheckConfigSchema,
    readme: z
      .boolean({
        invalid_type_error: "checks.readme must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.readme),
    examples: z
      .boolean({
        invalid_type_error: "checks.examples must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.examples),
    docs: z
      .boolean({
        invalid_type_error: "checks.docs must be a boolean",
      })
      .default(DEFAULT_CHECKS_CONFIG.docs),
  })
  .default(DEFAULT_CHECKS_CONFIG);

export const ScoringWeightsSchema = z
  .object({
    dependencies: z
      .number({
        invalid_type_error: "scoring.weights.dependencies must be a number",
      })
      .nonnegative("scoring.weights.dependencies must be non-negative")
      .default(DEFAULT_SCORING_WEIGHTS.dependencies),
    env: z
      .number({
        invalid_type_error: "scoring.weights.env must be a number",
      })
      .nonnegative("scoring.weights.env must be non-negative")
      .default(DEFAULT_SCORING_WEIGHTS.env),
    build: z
      .number({
        invalid_type_error: "scoring.weights.build must be a number",
      })
      .nonnegative("scoring.weights.build must be non-negative")
      .default(DEFAULT_SCORING_WEIGHTS.build),
    server: z
      .number({
        invalid_type_error: "scoring.weights.server must be a number",
      })
      .nonnegative("scoring.weights.server must be non-negative")
      .default(DEFAULT_SCORING_WEIGHTS.server),
    readme: z
      .number({
        invalid_type_error: "scoring.weights.readme must be a number",
      })
      .nonnegative("scoring.weights.readme must be non-negative")
      .default(DEFAULT_SCORING_WEIGHTS.readme),
  })
  .default(DEFAULT_SCORING_WEIGHTS);

export const ScoringConfigSchema = z
  .object({
    weights: ScoringWeightsSchema,
  })
  .default(DEFAULT_CONFIG.scoring);

export const FreshstartConfigSchema = z
  .object({
    checks: ChecksConfigSchema,
    scoring: ScoringConfigSchema,
    failBelow: z
      .number({
        invalid_type_error: "fail-below must be a number",
      })
      .min(0, "fail-below must be between 0 and 100")
      .max(100, "fail-below must be between 0 and 100")
      .default(DEFAULT_CONFIG.failBelow),
    ignore: z
      .array(z.string(), {
        invalid_type_error: "ignore must be a list of strings",
      })
      .default(DEFAULT_CONFIG.ignore),
    packageManager: PackageManagerPreferenceSchema.default(DEFAULT_CONFIG.packageManager),
  })
  .default(DEFAULT_CONFIG);

export const FreshstartConfigFileSchema = z
  .object({
    checks: ChecksConfigSchema.optional(),
    scoring: ScoringConfigSchema.optional(),
    "fail-below": z
      .number({
        invalid_type_error: "fail-below must be a number",
      })
      .min(0, "fail-below must be between 0 and 100")
      .max(100, "fail-below must be between 0 and 100")
      .optional(),
    failBelow: z
      .number({
        invalid_type_error: "failBelow must be a number",
      })
      .min(0, "failBelow must be between 0 and 100")
      .max(100, "failBelow must be between 0 and 100")
      .optional(),
    ignore: z
      .array(z.string(), {
        invalid_type_error: "ignore must be a list of strings",
      })
      .optional(),
    "package-manager": PackageManagerPreferenceSchema.optional(),
    packageManager: PackageManagerPreferenceSchema.optional(),
  })
  .strict()
  .transform(
    (input): FreshstartConfig =>
      FreshstartConfigSchema.parse({
        checks: input.checks,
        scoring: input.scoring,
        failBelow: input["fail-below"] ?? input.failBelow,
        ignore: input.ignore,
        packageManager: input["package-manager"] ?? input.packageManager,
      }),
  );
