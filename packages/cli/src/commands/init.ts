import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG_YAML = `# FreshstartCI Configuration (.freshstart.yml)

# Minimum score required for CI to pass (0 - 100)
fail-below: 80

# Preferred package manager: auto | npm | yarn | pnpm | bun
package-manager: auto

# Enabled checks
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

# Custom scoring weights
scoring:
  weights:
    dependencies: 20
    env: 20
    build: 20
    server: 20
    readme: 20

# Ignored directory patterns
ignore:
  - dist
  - build
  - node_modules
`;

export async function executeInitCommand(targetPath = "."): Promise<void> {
  const repoPath = path.resolve(process.cwd(), targetPath);
  const configFile = path.join(repoPath, ".freshstart.yml");

  if (fs.existsSync(configFile)) {
    process.stdout.write(`.freshstart.yml already exists at ${configFile}\n`);
    return;
  }

  fs.writeFileSync(configFile, DEFAULT_CONFIG_YAML, "utf8");
  process.stdout.write(`Created .freshstart.yml at ${configFile}\n`);
}
