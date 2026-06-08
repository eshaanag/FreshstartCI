import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { detectProject } from "../src/lib/detector.js";

const createdRepos: string[] = [];

describe("detectProject", () => {
  afterEach(async () => {
    await Promise.all(
      createdRepos.splice(0).map((repoPath) => rm(repoPath, { recursive: true, force: true })),
    );
  });

  it("detects a Next.js project", async () => {
    const repoPath = await createRepo({
      packageJson: {
        scripts: {
          build: "next build",
          start: "next start",
        },
        dependencies: {
          next: "^14.0.0",
        },
      },
      files: {
        "pnpm-lock.yaml": "",
      },
    });

    const detection = await detectProject(repoPath);

    expect(detection.isNodeProject).toBe(true);
    expect(detection.packageManager).toBe("pnpm");
    expect(detection.detectedFramework).toMatchObject({
      name: "next",
      startCommand: "next start",
      buildCommand: "next build",
      port: 3000,
    });
  });

  it("detects a Vite project", async () => {
    const repoPath = await createRepo({
      packageJson: {
        devDependencies: {
          vite: "^5.0.0",
        },
      },
      files: {
        "package-lock.json": "{}",
      },
    });

    const detection = await detectProject(repoPath);

    expect(detection.packageManager).toBe("npm");
    expect(detection.detectedFramework).toMatchObject({
      name: "vite",
      startCommand: "vite preview",
      buildCommand: "vite build",
      port: 5173,
    });
  });

  it("detects an Express-style server and parses a hardcoded port", async () => {
    const repoPath = await createRepo({
      packageJson: {
        scripts: {
          start: "node server.js --port 4000",
        },
        dependencies: {
          express: "^4.18.0",
        },
      },
      files: {
        "server.js": "app.get('/healthz', handler)",
        "yarn.lock": "",
      },
    });

    const detection = await detectProject(repoPath);

    expect(detection.packageManager).toBe("yarn");
    expect(detection.detectedFramework).toMatchObject({
      name: "node-server",
      startCommand: "node server.js --port 4000",
      port: 4000,
      healthPath: "/healthz",
    });
  });

  it("warns on conflicting lockfiles and uses priority order", async () => {
    const repoPath = await createRepo({
      packageJson: {
        scripts: {
          start: "node index.js",
        },
      },
      files: {
        "pnpm-lock.yaml": "",
        "yarn.lock": "",
        "package-lock.json": "{}",
        "bun.lockb": "",
      },
    });

    const detection = await detectProject(repoPath);

    expect(detection.packageManager).toBe("pnpm");
    expect(
      detection.warnings.some((warning) => warning.message.includes("Multiple lockfiles")),
    ).toBe(true);
  });

  it("reports a non-Node project when package.json is missing", async () => {
    const repoPath = await createRepo({
      files: {
        "README.md": "# Not a Node repo",
      },
    });

    const detection = await detectProject(repoPath);

    expect(detection.isNodeProject).toBe(false);
    expect(detection.detectedFramework.name).toBe("unknown");
    expect(detection.warnings[0]?.message).toContain("No package.json found");
  });
});

interface RepoFixture {
  packageJson?: Record<string, unknown>;
  files?: Record<string, string>;
}

async function createRepo(fixture: RepoFixture): Promise<string> {
  const repoPath = await mkdtemp(path.join(tmpdir(), "freshstart-detector-"));
  createdRepos.push(repoPath);

  if (fixture.packageJson !== undefined) {
    await writeFile(
      path.join(repoPath, "package.json"),
      JSON.stringify(fixture.packageJson, null, 2),
    );
  }

  for (const [fileName, contents] of Object.entries(fixture.files ?? {})) {
    await writeFile(path.join(repoPath, fileName), contents);
  }

  return repoPath;
}
