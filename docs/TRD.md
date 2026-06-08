# FreshstartCI Technical Requirements Document

## Architecture

FreshstartCI is a TypeScript monorepo with four packages:

- `packages/core`: check implementations, detection, runner, scoring, reporters, config, and shared types.
- `packages/cli`: thin command-line entrypoint that delegates to core.
- `packages/github-action`: Docker-based GitHub Action wrapper.
- `packages/badge-server`: optional Hono service for score badges and public reports.

Core functionality runs locally with no paid APIs and no remote calls. The badge server is optional and receives explicit JSON score submissions.

## Runtime Requirements

- Node.js 20 or newer.
- TypeScript strict mode.
- pnpm workspaces.
- ESM-first builds with CJS compatibility where package consumers need it.

Node 20 is required for current LTS behavior, modern fetch APIs, stable test tooling, and predictable process handling.

## Data Flow

1. CLI parses arguments and validates them.
2. `loadConfig()` reads `.freshstart.yml` or returns defaults.
3. `detectProject()` identifies package manager, framework, scripts, port, and health path.
4. `Runner.runAll()` creates a check context and runs enabled checks.
5. Each check returns a `CheckResult`; failures are data, not thrown crashes.
6. `Scorer.calculate()` normalizes results into a `QuickstartHealthScore`.
7. Reporters render terminal, markdown, or JSON output.
8. CLI exits 0 or 1 based on `failBelow`.

## Check Algorithms

### Dependency Install

Runs the detected package manager's install command in a clean copy of the repository without `node_modules`.

- `pnpm install --frozen-lockfile` when a pnpm lockfile exists.
- `npm ci` when a package lock exists, otherwise `npm install`.
- `yarn install --frozen-lockfile` for Yarn classic lockfiles.
- `bun install --frozen-lockfile` for Bun lockfiles.

It distinguishes install failure, authentication errors, timeout, peer dependency warnings, and missing `package.json`.

### Environment Completeness

Parses `.env.example` into declared variable names. Scans source files with `ts-morph` to find:

- `process.env.NAME`
- `process.env["NAME"]`
- `process.env['NAME']`
- destructuring from `process.env`
- `import.meta.env.NAME`
- dynamic access that cannot be verified

AST scanning wins over regex because it understands property access, bracket notation, destructuring, JSX/TSX syntax, and multiline code. Regex either misses common patterns or creates noisy false positives.

### README Command Validity

Uses `remark` and `remark-gfm` to parse root `README.md`. Extracts fenced code blocks with shell-like languages or unlabeled blocks that look like shell commands. For each command:

- `npm run x`, `pnpm x`, `yarn x`, and `bun run x` are checked against `package.json` scripts.
- `cp .env.example .env` verifies the source file exists.
- `node file.js` verifies the referenced file exists.
- Package-manager drift is detected when README uses `npm install` but the lockfile indicates pnpm, Yarn, or Bun.
- Known system commands such as `cp`, `cat`, `mkdir`, `cd`, `export`, and `echo` are treated as valid.

The checker reports command, source block, and suggested replacement where confidence is high.

### Build

Runs the detected build command when applicable. Missing build scripts are skipped with full points because not every package has a build step.

Common stderr patterns are parsed into actionable details:

- `Cannot find module`
- TypeScript property/type errors
- `ENOENT`
- `SyntaxError`
- missing env var errors routed to env guidance

### Test

Runs the detected test command when present. Missing tests are reported as skipped, not failed, unless configuration requires tests.

### Server Start

Starts the detected command as a background process, waits up to 30 seconds for the configured port to respond, and captures the last output lines for failure context. It detects early exits and common `EADDRINUSE` failures.

### Health Check

Sends `GET http://localhost:{port}{healthPath}` with `undici`. Accepts 200, 201, 204, 301, and 302. Reports 4xx/5xx with status and body excerpt. The runner kills the process group after health checks to avoid orphaned processes in CI.

### Example Scripts

Finds configured examples and verifies that declared example commands still run. This is opt-in where projects have expensive examples.

### Docs Snippets

Parses docs markdown and extracts executable shell snippets. This is opt-in because docs can contain illustrative commands that are not intended for CI.

### Dependency Staleness

Compares installed dependency versions to package metadata when network access is explicitly available. This is not required for core offline scoring.

## Scoring Algorithm

Default weights total 100:

| Check        | Points |
| ------------ | -----: |
| dependencies |     20 |
| env          |     20 |
| build        |     20 |
| server       |     20 |
| readme       |     20 |

Skipped non-applicable checks receive full configured weight when the absence is legitimate, such as no build script in a simple package. Disabled checks are removed from the denominator and the final score is normalized to 100.

Grades:

- A: 90-100
- B: 75-89
- C: 60-74
- D: 40-59
- F: 0-39

## Package Manager Detection

Lockfile priority:

1. `pnpm-lock.yaml`
2. `yarn.lock`
3. `package-lock.json`
4. `bun.lockb` or `bun.lock`

Multiple lockfiles produce a warning and the priority order decides. Explicit config overrides auto-detection.

## Framework Detection

Detection uses `package.json` dependencies, devDependencies, and scripts:

- `next`: Next.js, `next start`, port 3000.
- `vite`: Vite, `vite preview`, port 5173.
- `express`, `fastify`, `hono`: Node server, start script or `node` entry, port 3000.
- `astro`: Astro, `astro preview`, port 4321.
- `nuxt`: Nuxt, `nuxt start`, port 3000.
- fallback: `scripts.start`, then `scripts.dev`, then unknown.

Port parsing recognizes `--port 4000`, `-p 4000`, `PORT=4000`, and common URL literals.

## Core Data Models

The source of truth lives in `packages/core/src/types/index.ts`. Major interfaces include:

- `CheckContext`
- `CheckResult`
- `CheckDetail`
- `AutoFix`
- `QuickstartHealthScore`
- `FreshstartConfig`
- `DetectedFramework`
- `ScoreReport`
- `FixResult`

See `docs/SCHEMA.md` for full fields and validation rules.

## Error Handling Strategy

Checks never crash the runner for expected repo failures. Each check catches filesystem, process, parse, timeout, and validation errors and returns a failed or skipped `CheckResult` with actionable details.

Unexpected exceptions are converted into a failed check with:

- check id
- message
- failure category
- suggestion
- duration

The runner continues unless configuration explicitly requests fail-fast behavior in a future release.

## Performance Targets

- Score-only command on installed simple project: under 5 seconds.
- Default full suite with cached dependencies: under 60 seconds.
- Dependency install timeout: 120 seconds.
- Build timeout: 180 seconds.
- Server startup timeout: 30 seconds.
- Health request timeout: 10 seconds.

Expensive checks such as docs snippet execution and dependency freshness are opt-in.
