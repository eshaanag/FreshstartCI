# FreshstartCI Flow Specification

## CLI Run Flow

```text
freshstart run [path]
  -> parse CLI args
  -> validate args with Zod
  -> load .freshstart.yml or defaults
  -> detect package manager and framework
  -> build CheckContext
  -> run enabled checks
  -> calculate Quickstart Health Score
  -> render requested output
  -> apply fail-below exit code
```

## Config Flow

1. Look for `.freshstart.yml` in the target repository root.
2. If absent, use defaults.
3. Parse YAML with `js-yaml`.
4. Validate with Zod.
5. Merge partial config with defaults.
6. Return `FreshstartConfig` or a structured validation error.

Invalid config stops the run because the requested policy is unknown.

## Detection Flow

1. Read `package.json`.
2. Detect lockfiles using priority order.
3. Detect package manager, including conflict warnings.
4. Read dependencies, devDependencies, and scripts.
5. Detect framework.
6. Infer build and start commands.
7. Infer port from command, config, or framework default.
8. Infer health path from config or common paths.

Missing `package.json` produces a non-Node project detection result so checks can skip cleanly with useful messages.

## Check Internal Flows

### Dependency Check

```text
create temp directory
copy repo excluding node_modules, dist, .git, ignored paths
run install command with timeout
inspect exit status and stderr
verify node_modules exists
return score and warnings
cleanup temp directory
```

### Env Check

```text
read .env.example
parse declared keys
scan source files with ts-morph
collect env accesses
classify static, dynamic, and import.meta.env usage
diff used keys against declared keys
detect committed .env
return missing, unused, dynamic, and security details
```

### README Check

```text
read root README.md
parse markdown AST
extract shell-like code fences
split into candidate commands
load package.json scripts and dependencies
validate command references
report drift and suggestions
```

### Build Check

```text
resolve build command
if no build command: skip with full score
run command with timeout
capture stdout/stderr
parse common failure patterns
return pass, warn, timeout, or fail
```

### Server Check

```text
resolve start command
spawn process in its own process group
watch for early exit
poll localhost port for readiness
capture last output lines
return server handle for health check
```

### Health Check

```text
send GET to configured URL
classify status code
capture short response excerpt on failure
kill server process group
return health result
```

## Fix Flow

```text
freshstart fix [path]
  -> run all checks
  -> collect AutoFix objects
  -> show preview
  -> ask for confirmation
  -> apply fixes
  -> rerun affected checks
  -> render updated score
```

Fix behavior:

- Missing `.env.example`: create file with detected variables.
- Missing env keys: append empty values with a FreshstartCI comment.
- README package-manager drift: suggest replacement only.
- Renamed scripts: suggest replacement only.

FreshstartCI does not silently edit README commands because docs can contain intentional alternatives.

## GitHub Action Flow

```text
workflow triggers
  -> Docker action starts Node 20 runtime
  -> runs freshstart run --json --fail-below input
  -> writes GitHub Actions summary
  -> sets output score, grade, report-json
  -> if PR and post-comment=true:
       find existing comment with marker
       update it if found
       create it otherwise
  -> exit using configured threshold
```

The action must not create duplicate PR comments on repeated pushes.

## Badge Server Flow

```text
POST /api/score
  -> validate owner, repo, score, grade, timestamp, token
  -> authenticate repo token
  -> store latest score and append history
  -> return accepted status

GET /badge/:owner/:repo
  -> read latest score
  -> choose color
  -> return SVG

GET /report/:owner/:repo
  -> read latest score and history
  -> return HTML report
```

The badge server is optional. Core CLI and GitHub Action work without it.

## Error Flow

### Check Failure

A check failure means the repository failed an expected condition. The check returns `status: "fail"` and contributes reduced score.

### Check Warning

A warning means the repository is usable but degraded. The check returns `status: "warn"` and partial score.

### Check Crash

A crash means FreshstartCI hit an unexpected exception. The runner catches it, converts it to a failed `CheckResult`, records the message, and continues.

### Timeout

Timeouts are treated as failed checks with specific timeout details and captured output where available.

### Config Error

Invalid config stops execution before checks run because policy cannot be trusted.
