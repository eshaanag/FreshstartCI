# FreshstartCI Architecture

FreshstartCI is a developer tool and CI utility designed to verify whether a repository can be cloned, configured, built, and run cleanly by a developer setting it up for the first time.

Instead of testing code logic in pre-configured environments, FreshstartCI evaluates the **onboarding setup path** itself: dependency installation, `.env.example` completeness, README command validity, build execution, server startup, and health response.

---

## Workspace Structure

FreshstartCI is structured as a `pnpm` monorepo containing four packages:

* [`packages/core`](file:///Users/eshaanog/Documents/eshaanagtools/FreshstartCI/packages/core) — Core inspection engine, project detector, AST scanners, scoring algorithms, and terminal/JSON/Markdown reporters.
* [`packages/cli`](file:///Users/eshaanog/Documents/eshaanagtools/FreshstartCI/packages/cli) — CLI entrypoint (`freshstart-ci run`, `freshstart-ci score`, `freshstart-ci fix`).
* [`packages/github-action`](file:///Users/eshaanog/Documents/eshaanagtools/FreshstartCI/packages/github-action) — GitHub Action entrypoint and bundled CJS execution context.
* [`packages/badge-server`](file:///Users/eshaanog/Documents/eshaanagtools/FreshstartCI/packages/badge-server) — Hono web server providing dynamic SVG health badges and HTML report views.

All core checks execute locally without remote server dependencies or API keys.

---

## Execution & Data Flow

1. **Configuration Loading**: Reads `.freshstart.yml` or loads standard defaults.
2. **Project Detection**: Analyzes `package.json`, lockfiles, scripts, and framework indicators to identify package managers (pnpm, npm, yarn, bun), build commands, start scripts, and target ports.
3. **Check Runner Execution**: Executes enabled checks in parallel or isolated sequence.
4. **Check Isolation**: Checks such as dependency verification operate inside isolated sandbox directories to prevent modifying the host environment.
5. **Scoring Engine**: Evaluates check outcomes, normalizes missing/skipped steps cleanly, and calculates a **Quickstart Health Score (0–100)** and letter grade (A–F).
6. **Reporting & Feedback**: Formats terminal output, Markdown PR summaries, or JSON payload outputs.

---

## Core Check Designs

### 1. Dependency Install Check
Runs the detected package manager (`npm`, `pnpm`, `yarn`, `bun`) inside a clean sandbox directory. Excludes existing `node_modules`, `.git`, `dist`, and `.next` directories across all project subdirectories during sandbox creation to prevent false installation errors.

### 2. Environment Completeness Check
Uses `ts-morph` AST parsing to extract `process.env` and `import.meta.env` references from source code. Compares discovered variables against `.env.example`. AST analysis avoids regex false positives by evaluating property access, bracket notation, destructuring, and multiline JSX/TSX.

### 3. README Command Validity Check
Parses `README.md` with `remark` and `remark-gfm`. Extracts fenced shell code blocks and validates script invocations against `package.json` scripts, file existence, and lockfile package manager declarations.

### 4. Build Check
Executes detected build commands (e.g. `npm run build`, `next build`). Captures stdout/stderr on non-zero exit codes to present clear diagnostic suggestions.

### 5. Server Startup Check
Spawns server processes in a detached process group. Monitors stdout/stderr and polls local ports. On completion or timeout, sends `SIGTERM` to the process group, waiting up to 3000ms before escalating to `SIGKILL` if the process ignores termination.

### 6. Health Response Check
Issues HTTP requests to configured health paths (e.g. `/`, `/health`). Accepts HTTP 200, 201, 204, 301, and 302 responses.

---

## Scoring & Normalization

* **Default Weights**: Dependencies (20), Env (20), Build (20), Server (20), Readme (20).
* **Skipped Checks**: Non-applicable checks (such as a missing build script in a pure library) receive full points to prevent false penalties.
* **Health Grade Mapping**:
  * **A**: 90–100
  * **B**: 75–89
  * **C**: 60–74
  * **D**: 40–59
  * **F**: 0–39
