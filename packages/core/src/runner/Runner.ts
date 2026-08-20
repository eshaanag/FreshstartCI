import type {
  CheckContext,
  CheckId,
  CheckResult,
  FixResult,
  QuickstartHealthScore,
  RunnerOptions,
  ScoreReport,
} from "../types/index.js";
import { loadConfig } from "../config/index.js";
import { detectProject } from "../lib/detector.js";
import { runDependencyCheck } from "../checks/dependencyCheck.js";
import { runEnvCheck } from "../checks/envCheck.js";
import { runReadmeCheck } from "../checks/readmeCheck.js";
import { runBuildCheck } from "../checks/buildCheck.js";
import { runServerCheck } from "../checks/serverCheck.js";
import { runHealthCheck } from "../checks/healthCheck.js";
import { calculateQuickstartHealthScore } from "../score/Scorer.js";
import { renderTerminalReport } from "../reporters/terminalReporter.js";
import { renderMarkdownReport } from "../reporters/markdownReporter.js";
import { formatJsonReport, renderJsonReport } from "../reporters/jsonReporter.js";

export interface RunnerResult {
  score: QuickstartHealthScore;
  report: ScoreReport;
  outputString: string;
  fixesApplied?: FixResult[];
}

export class Runner {
  static async runAll(options: RunnerOptions): Promise<RunnerResult> {
    const startTime = Date.now();
    const config = loadConfig(options.repoPath);
    const detection = await detectProject(options.repoPath, config.packageManager);

    const context: CheckContext = {
      repoPath: options.repoPath,
      config,
      packageManager: detection.packageManager,
      detectedFramework: detection.detectedFramework,
      env: process.env as Record<string, string>,
    };

    const results: CheckResult[] = [];
    const shouldRun = (id: CheckId): boolean => {
      if (options.onlyChecks && options.onlyChecks.length > 0) {
        return options.onlyChecks.includes(id);
      }
      return true;
    };

    // 1. Dependency Check
    if (config.checks.dependencies && shouldRun("dependencies")) {
      const res = await runDependencyCheck(context);
      if (res) results.push(res);
    }

    // 2. Env Check
    if (config.checks.env && shouldRun("env")) {
      const res = await runEnvCheck(context);
      if (res) results.push(res);
    }

    // 3. Readme Check
    if (config.checks.readme && shouldRun("readme")) {
      const res = await runReadmeCheck(context);
      if (res) results.push(res);
    }

    // 4. Build Check
    if (config.checks.build && shouldRun("build")) {
      const res = await runBuildCheck(context);
      if (res) results.push(res);
    }

    // 5. Server Check
    if (config.checks.server && shouldRun("server")) {
      const res = await runServerCheck(context);
      if (res) results.push(res);
    }

    // 6. Health Check
    if (config.checks.health.enabled && shouldRun("health")) {
      const res = await runHealthCheck(context);
      if (res) results.push(res);
    }

    // Apply fixes if requested
    let fixesApplied: FixResult[] | undefined;
    if (options.fix) {
      fixesApplied = await Runner.applyFixes(results);
    }

    const durationMs = Date.now() - startTime;
    const score = calculateQuickstartHealthScore(results, {
      repoPath: options.repoPath,
      version: "0.1.0",
      durationMs,
    });

    const report = renderJsonReport(score, config);

    let outputString = "";
    if (options.outputFormat === "json") {
      outputString = formatJsonReport(score, config);
    } else if (options.outputFormat === "markdown") {
      outputString = renderMarkdownReport(score);
    } else {
      outputString = renderTerminalReport(score, {
        quiet: options.quiet,
        verbose: options.verbose,
      });
    }

    const runnerResult: RunnerResult = {
      score,
      report,
      outputString,
    };

    if (fixesApplied) {
      runnerResult.fixesApplied = fixesApplied;
    }

    return runnerResult;
  }

  static async applyFixes(checks: CheckResult[]): Promise<FixResult[]> {
    const fixResults: FixResult[] = [];
    for (const check of checks) {
      if (check.fix) {
        try {
          await check.fix.apply();
          fixResults.push({
            description: check.fix.description,
            applied: true,
          });
        } catch (err) {
          fixResults.push({
            description: check.fix.description,
            applied: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    return fixResults;
  }
}
