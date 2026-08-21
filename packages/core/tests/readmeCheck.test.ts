import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { extractReadmeCommands, runReadmeCheck } from "../src/checks/readmeCheck.js";
import { DEFAULT_CONFIG, type CheckContext } from "../src/types/index.js";

const createdRepos: string[] = [];

describe("extractReadmeCommands", () => {
  it("extracts shell commands from fenced code blocks", () => {
    const commands = extractReadmeCommands("```bash\n$ npm install\nnpm run dev\n```");

    expect(commands.map((command) => command.command)).toEqual(["npm install", "npm run dev"]);
  });
});

describe("runReadmeCheck", () => {
  afterEach(async () => {
    await Promise.all(
      createdRepos.splice(0).map((repoPath) => rm(repoPath, { recursive: true, force: true })),
    );
  });

  it("passes when README commands match package scripts and files", async () => {
    const repoPath = await createRepo({
      "package.json": JSON.stringify({
        scripts: { dev: "vite --host" },
        devDependencies: { vite: "^5.0.0" },
      }),
      "README.md": "```bash\nnpm install\nnpm run dev\nnpx vite\n```",
    });

    const result = await runReadmeCheck(context(repoPath, "npm"));

    expect(result.status).toBe("pass");
    expect(result.score).toBe(20);
  });

  it("warns when a README npm script has drifted", async () => {
    const repoPath = await createRepo({
      "package.json": JSON.stringify({ scripts: { start: "node server.js" } }),
      "README.md": "```bash\nnpm run dev\n```",
    });

    const result = await runReadmeCheck(context(repoPath, "npm"));

    expect(result.status).toBe("warn");
    expect(result.score).toBe(14);
    expect(result.details[0]?.suggestion).toBe("npm run start");
  });

  it("fails when README.md is missing", async () => {
    const repoPath = await createRepo({
      "package.json": JSON.stringify({ scripts: {} }),
    });

    const result = await runReadmeCheck(context(repoPath, "npm"));

    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
  });

  it("warns when README has no shell command blocks", async () => {
    const repoPath = await createRepo({
      "package.json": JSON.stringify({ scripts: {} }),
      "README.md": "# Project\n\nNo commands here.",
    });

    const result = await runReadmeCheck(context(repoPath, "npm"));

    expect(result.status).toBe("warn");
    expect(result.score).toBe(14);
  });

  it("detects wrong package manager, missing env example, and moved node file", async () => {
    const repoPath = await createRepo({
      "package.json": JSON.stringify({ scripts: { start: "node src/server.js" } }),
      "README.md": "```bash\nnpm install\ncp .env.example .env\nnode server.js\n```",
      "pnpm-lock.yaml": "",
    });

    const result = await runReadmeCheck(context(repoPath, "pnpm"));

    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
    expect(result.details).toHaveLength(3);
  });

  it("never suggests 'undefined install' when packageManager is undefined", async () => {
    const repoPath = await createRepo({
      "package.json": JSON.stringify({ scripts: {} }),
      "README.md": "```bash\nnpm install\n```",
    });

    const result = await runReadmeCheck(
      context(repoPath, undefined as unknown as CheckContext["packageManager"]),
    );

    expect(result.status).toBe("pass");
    for (const detail of result.details) {
      expect(detail.suggestion).not.toContain("undefined install");
    }
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const repoPath = await mkdtemp(path.join(tmpdir(), "freshstart-readme-"));
  createdRepos.push(repoPath);

  for (const [fileName, contents] of Object.entries(files)) {
    const filePath = path.join(repoPath, fileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return repoPath;
}

function context(repoPath: string, packageManager: CheckContext["packageManager"]): CheckContext {
  return {
    repoPath,
    config: DEFAULT_CONFIG,
    packageManager,
    detectedFramework: {
      name: "unknown",
      startCommand: "",
      buildCommand: "",
      port: 3000,
      healthPath: "/",
    },
    env: {},
  };
}
