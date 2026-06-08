# FreshstartCI Product Requirements Document

## Summary

FreshstartCI tests whether a repository works for a developer cloning it for the first time. It runs setup-oriented checks in a clean environment, reports precise breakage, and turns the result into a public Quickstart Health Score from 0 to 100.

## Problem

Most CI systems validate code after a repository is already configured. They do not validate the first 15 minutes: installing dependencies, copying environment files, running the README commands, building the app, starting a server, and getting a useful response from localhost.

Broken onboarding wastes time in several ways:

- New contributors lose hours before they can make a first change.
- SDK users abandon evaluation when examples do not run.
- Course students get blocked by setup instead of learning the intended material.
- Internal platform teams answer repeated support questions that could have been caught automatically.

FreshstartCI treats setup instructions as executable product surface area. A repository can have a passing test suite and still have a failing quickstart; this tool measures that gap.

## Target Users

- OSS maintainers who want contributors to start quickly and file fewer setup issues.
- SDK and API companies whose examples must run reliably for evaluation.
- Startup engineering teams onboarding hires into fast-moving repositories.
- Course creators shipping lesson repos to students with varied local machines.
- Agency developers handing off projects to clients or future maintainers.
- Internal platform teams publishing templates and golden-path starter repos.

## Personas

### OSS Maintainer

Maintains a popular package with limited review time. Wants a badge that proves the quickstart still works and a PR comment that catches README drift before release.

### SDK Company

Ships client libraries and example apps. Cares about activation: a developer who cannot run the first example may never reach the API call that shows product value.

### Course Creator

Publishes code for students. Needs setup steps that work on a clean clone so support time is spent on course concepts, not missing env vars.

### Internal Platform Engineer

Owns starter templates used across teams. Needs a repeatable check that templates still install, build, and start after dependency updates.

## User Stories

1. As a maintainer, I want a score badge in my README so visitors can see whether setup is healthy.
2. As a maintainer, I want PR comments that explain quickstart regressions before merge.
3. As a contributor, I want failing setup commands to include concrete suggestions.
4. As an SDK author, I want examples checked in isolation so broken demos do not ship.
5. As a course creator, I want missing `.env.example` variables detected before students clone the repo.
6. As a platform engineer, I want custom score thresholds so template quality gates fit team policy.
7. As a developer, I want the CLI to work without API keys or hosted services.
8. As a CI owner, I want JSON output that other tooling can parse.
9. As a maintainer, I want a markdown report that renders cleanly in GitHub.
10. As a developer, I want README command drift detected when scripts are renamed.
11. As a maintainer, I want the tool to skip non-applicable checks without false failures.
12. As a developer, I want `--fix` to create or update `.env.example` when safe.
13. As a security-conscious team, I want committed `.env` files flagged.
14. As an OSS maintainer, I want the score to be understandable, not a black box.
15. As a release manager, I want setup regressions to fail CI below a configured threshold.
16. As a developer, I want quiet mode for scripts and verbose mode for debugging.
17. As a badge consumer, I want historical public reports when hosted reporting is enabled.

## Feature Priorities

### P0

- Quickstart Health Score with weighted check results.
- Dependency install check.
- Environment completeness check using AST analysis.
- README command validity check.
- Build check.
- Server start and health check.
- CLI `run`, `score`, `fix`, and `init` commands.
- Markdown, terminal, and JSON reporters.
- GitHub Action with PR comment updates.
- Configuration through `.freshstart.yml`.

### P1

- Docs snippet execution.
- Example script checks.
- Dependency staleness check.
- Badge server with SVG badge and public report page.
- Snapshot tests for reporters.
- Example repositories used as fixtures and demos.

### P2

- Framework-specific advice for common stacks.
- Historical score trends in hosted reports.
- Monorepo package-by-package scoring.
- Optional dependency freshness policies.
- SARIF or check-run annotations.

## Success Metrics

- A clean example repository scores 100/100.
- Broken fixtures fail in the expected score ranges with actionable output.
- The full default suite completes in under 60 seconds for a typical Node app after dependencies are cached.
- `freshstart score` completes in under 5 seconds for a simple already-installed project.
- PR comments are updated in place rather than duplicated.
- False positives stay low enough that maintainers keep the action enabled.
- README badge adoption becomes the primary growth loop.

## Non-Goals

- FreshstartCI is not a replacement for unit, integration, or end-to-end tests.
- FreshstartCI is not a dependency security scanner.
- FreshstartCI does not upload source code for core checks.
- FreshstartCI does not guarantee production readiness.
- FreshstartCI does not automatically edit README files except through explicit future workflows.
- FreshstartCI does not require Docker for local CLI usage.

## X-Factor: Quickstart Health Score

The score is the shareable output. A binary pass/fail result hides partial progress and gives maintainers little public incentive. A score creates a target: developers want 90+, contributors understand what lowered the number, and README visitors can click through to a report.

The badge is the viral loop:

```markdown
[![Quickstart Health](https://freshstart-ci.dev/badge/owner/repo)](https://freshstart-ci.dev/report/owner/repo)
```

Every check serves the score. Every report explains how to raise it.
