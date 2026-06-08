# FreshstartCI Design Specification

## Design Philosophy

FreshstartCI runs in developers' terminals and CI logs. The interface should be compact, readable, and specific. It should not hide errors behind decorative output or flood logs with raw command output unless verbose mode is enabled.

The product surface has four forms:

- terminal output for local use
- markdown for PR comments and GitHub summaries
- JSON for automation
- SVG badge for public trust

The Quickstart Health Score is the first visual object in every final report.

## Color System

Terminal colors use `chalk` semantic roles:

| Color | Meaning |
| --- | --- |
| green | passed checks, healthy score |
| yellow | warning, partial pass, degraded score |
| red | failed checks, broken onboarding |
| cyan | info, running checks, neutral metadata |
| white | standard text |
| gray | secondary details |

No arbitrary palette is used. Color never carries meaning alone; each status also has text and symbols.

## Score Card

Terminal score card:

```text
╔══════════════════════════════════════════════════╗
║         QUICKSTART HEALTH SCORE: 87/100          ║
║                    Grade: B                      ║
╠══════════════════════════════════════════════════╣
║  PASS  Dependencies install cleanly      20/20   ║
║  PASS  .env.example is complete          20/20   ║
║  PASS  Build passes                      20/20   ║
║  WARN  README commands are current       13/20   ║
║  FAIL  Server starts and responds        14/20   ║
╠══════════════════════════════════════════════════╣
║  2 issues found. Run with --fix to resolve.      ║
╚══════════════════════════════════════════════════╝
```

Unicode symbols may be used in interactive terminals, but CI-safe text fallbacks must exist.

## Progress Indicators

Default mode shows one spinner per running check using `ora`. A completed check replaces the spinner with status, score, and duration.

No check should leave the user waiting silently. Long-running checks include timeout values in verbose mode.

## Verbosity Levels

### `--quiet`

Prints only:

```text
87 B
```

Useful for scripts.

### Default

Prints progress and final score card. Details are summarized to the most actionable issue per failing check.

### `--verbose`

Prints full details:

- file paths
- line numbers where available
- command executed
- timeout
- stderr excerpts
- suggestions

Verbose output is diagnostic, not decorative.

## PR Comment Format

Markdown report structure:

1. Hidden marker for update-in-place behavior.
2. H2 title with score and grade.
3. Score table.
4. Issues list grouped by check.
5. Badge embed snippet.
6. Timestamp and FreshstartCI version.

Example:

```markdown
<!-- freshstart-ci-report -->
## Quickstart Health Score: 87/100 (B)

| Check | Status | Score | Summary |
| --- | --- | ---: | --- |
| Dependencies | PASS | 20/20 | Install completed cleanly |
| README | WARN | 13/20 | 1 command drifted |

### Issues
- `README.md`: `npm run dev` does not exist. Use `npm start`.
```

## Badge Design

Badge endpoint returns shields-compatible SVG:

- label: `quickstart`
- message: `94/100 A`
- color: green for 90+, yellow for 70-89, red below 70

The badge must be cacheable but refreshable after new score submissions.

## Accessibility and Log Hygiene

- Status text accompanies all color.
- Output width should fit common 80-column terminals where possible.
- Command output is truncated by default with clear indication when truncated.
- JSON output contains no color codes.

## Copy Rules

Messages should state what broke and what to do next:

- Good: `README.md uses npm run dev, but package.json has no dev script. Use npm start.`
- Bad: `README invalid.`

FreshstartCI should be direct and technically precise.
