# FreshstartCI

FreshstartCI tests whether a repository works for someone cloning it for the first time.

Existing CI usually starts after a project is already configured. FreshstartCI checks the setup path itself: dependency install, `.env.example`, README commands, build, server startup, and health response. The output is a Quickstart Health Score from 0 to 100 that can be shown in a README badge.

```text
╔══════════════════════════════════════════════════╗
║         QUICKSTART HEALTH SCORE: 94/100          ║
║                    Grade: A                      ║
╠══════════════════════════════════════════════════╣
║  PASS  Dependencies install cleanly      20/20   ║
║  PASS  .env.example is complete          20/20   ║
║  PASS  Build passes                      20/20   ║
║  PASS  Server starts and responds        20/20   ║
║  WARN  README commands are current       14/20   ║
╚══════════════════════════════════════════════════╝
```

## Current Status

FreshstartCI is under active implementation. The product docs and workspace scaffold are complete; check implementations come next.

| Area                                          | Status         |
| --------------------------------------------- | -------------- |
| Product and technical docs                    | ✅ Complete    |
| pnpm workspace tooling                        | ✅ Complete    |
| Core type system                              | ✅ Complete    |
| Project detector                              | ✅ Complete    |
| Dependency, env, README, build, server checks | 📋 Planned     |
| CLI commands                                  | 📋 Planned     |
| GitHub Action                                 | 📋 Planned     |
| Badge server                                  | 📋 Planned     |

## Planned Usage

```bash
npx freshstart-ci run
npx freshstart-ci run --only env,build,server
npx freshstart-ci run --fix
npx freshstart-ci score
```

## GitHub Actions

```yaml
- uses: freshstart-ci/action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    post-comment: true
    fail-below: 80
```

## Configuration

Copy `.freshstart.yml.example` to `.freshstart.yml` and adjust checks, weights, ignore paths, package manager, and health settings.

## Architecture

The repository is a pnpm workspace:

- `packages/core`: checks, scoring, runner, reporters, config, and shared types.
- `packages/cli`: `freshstart` command entrypoint.
- `packages/github-action`: Docker-based action wrapper.
- `packages/badge-server`: optional Hono badge and report service.

Core checks are designed to run offline. No API keys are required for local scoring, and source code does not leave the machine.

## Documentation

- [PRD](docs/PRD.md)
- [TRD](docs/TRD.md)
- [Design](docs/DESIGN.md)
- [Flow](docs/FLOW.md)
- [Schema](docs/SCHEMA.md)
