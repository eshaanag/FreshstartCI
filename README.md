# FreshstartCI

FreshstartCI tests whether a repository successfully builds and runs for a developer cloning it for the first time.

Most CI configurations verify code after a project is already configured. FreshstartCI verifies the setup path itself: dependency installation, `.env.example` completeness, README command validity, build execution, server startup, and health response. It produces a Quickstart Health Score (0–100) and grade (A–F). Typical runs complete in under 5 seconds locally.

```text
╔════════════════════════════════════════════════╗
║        QUICKSTART HEALTH SCORE: 67/100         ║
║                    Grade: C                    ║
╠════════════════════════════════════════════════╣
║ WARN Dependencies install cleanly. 20/20       ║
║ FAIL 6 env vars are missing from .env.example. ║
║ FAIL 4 README commands have drifted. 0/20      ║
║ PASS Build passes. 20/20                       ║
║ SKIP No start command detected; server check is║
║ SKIP Server check skipped; health check skipped║
╚════════════════════════════════════════════════╝
```

## Quick Start

Run FreshstartCI locally using `npx`:

```bash
# Run all checks on the current directory
npx freshstart-ci run

# Run specific checks
npx freshstart-ci run --only env,build,server

# Automatically apply fixes (e.g. append missing env vars to .env.example)
npx freshstart-ci run --fix

# Print Quickstart Health Score only
npx freshstart-ci score
```

## GitHub Actions Integration

Add `.github/workflows/quickstart.yml` to your repository:

```yaml
name: Quickstart Health Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  freshstart:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: eshaanag/FreshstartCI@v1
        with:
          fail-below: 80
```

### Action Inputs

| Input | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `path` | Path to the repository root | `.` | No |
| `fail-below` | Fail workflow step if total score is below threshold | `80` | No |
| `checks` | Comma-separated list of check IDs to run (`all`, `env`, `build`, etc.) | `all` | No |
| `github-token` | GitHub token for commenting on PRs | `${{ github.token }}` | No |

### Action Outputs

| Output | Description |
| :--- | :--- |
| `score` | Quickstart Health Score integer (0–100) |
| `grade` | Health grade (`A`, `B`, `C`, `D`, `F`) |
| `report-json` | Complete report object formatted as JSON |

## Configuration

Create `.freshstart.yml` in your repository root to customize thresholds and enabled checks:

```yaml
checks:
  dependencies: true
  env: true
  build: true
  server: true
  health:
    enabled: true
    port: 3000
    path: "/health"
    timeout: 10000
  readme: true

scoring:
  weights:
    dependencies: 20
    env: 20
    build: 20
    server: 20
    readme: 20

failBelow: 80
packageManager: "auto"
```

## Architecture

FreshstartCI is structured as a pnpm monorepo:

- `packages/core`: Core checks, AST scanners, scoring engine, and terminal/markdown/JSON reporters.
- `packages/cli`: Command-line interface (`freshstart-ci`).
- `packages/github-action`: Entrypoint and Docker execution context for GitHub Actions.
- `packages/badge-server`: Standalone Hono server for SVG badges and HTML report views.

All checks execute offline locally. No source code or environment variables are transmitted to external servers.

## Documentation

- [PRD](docs/PRD.md)
- [TRD](docs/TRD.md)
- [Design Architecture](docs/DESIGN.md)
- [Execution Flow](docs/FLOW.md)
- [Configuration Schema](docs/SCHEMA.md)
