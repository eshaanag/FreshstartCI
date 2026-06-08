import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runEnvCheck } from "../src/checks/envCheck.js";
import { scanEnvUsage } from "../src/lib/astScanner.js";
import { DEFAULT_CONFIG, type CheckContext } from "../src/types/index.js";

const createdRepos: string[] = [];

describe("scanEnvUsage", () => {
  afterEach(cleanupRepos);

  it("detects dot access, bracket access, import.meta.env, and destructuring", async () => {
    const repoPath = await createRepo({
      "src/index.ts": `
        const a = process.env.DATABASE_URL;
        const b = process.env["STRIPE_KEY"];
        const c = import.meta.env.VITE_API_URL;
        const { REDIS_URL } = process.env;
      `,
    });

    const scan = await scanEnvUsage(repoPath);

    expect(scan.usages.map((usage) => usage.name).sort()).toEqual([
      "DATABASE_URL",
      "REDIS_URL",
      "STRIPE_KEY",
      "VITE_API_URL",
    ]);
  });

  it("reports dynamic env access for manual review", async () => {
    const repoPath = await createRepo({
      "src/index.ts": "const value = process.env[key];",
    });

    const scan = await scanEnvUsage(repoPath);

    expect(scan.dynamicAccesses).toHaveLength(1);
    expect(scan.dynamicAccesses[0]?.expression).toBe("process.env[key]");
  });
});

describe("runEnvCheck", () => {
  afterEach(cleanupRepos);

  it("passes when every used variable is declared", async () => {
    const repoPath = await createRepo({
      ".env.example": "DATABASE_URL=\nSTRIPE_KEY=\n",
      "src/index.ts": "process.env.DATABASE_URL; process.env['STRIPE_KEY'];",
    });

    const result = await runEnvCheck(context(repoPath));

    expect(result.status).toBe("pass");
    expect(result.score).toBe(20);
  });

  it("warns and appends missing vars when one or two variables are missing", async () => {
    const repoPath = await createRepo({
      ".env.example": "DATABASE_URL=\n",
      "src/index.ts": "process.env.DATABASE_URL; process.env.STRIPE_KEY;",
    });

    const result = await runEnvCheck(context(repoPath));
    await result.fix?.apply();
    const envExample = await readFile(path.join(repoPath, ".env.example"), "utf8");

    expect(result.status).toBe("warn");
    expect(result.score).toBe(10);
    expect(envExample).toContain("STRIPE_KEY=");
  });

  it("fails and creates .env.example when the file is missing", async () => {
    const repoPath = await createRepo({
      "src/index.ts": "process.env.DATABASE_URL;",
    });

    const result = await runEnvCheck(context(repoPath));
    await result.fix?.apply();
    const envExample = await readFile(path.join(repoPath, ".env.example"), "utf8");

    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
    expect(envExample).toContain("DATABASE_URL=");
  });

  it("warns on unused example vars and committed .env files", async () => {
    const repoPath = await createRepo({
      ".env": "SECRET=value\n",
      ".env.example": "DATABASE_URL=\nSTALE_VAR=\n",
      "src/index.ts": "process.env.DATABASE_URL;",
    });

    const result = await runEnvCheck(context(repoPath));

    expect(result.status).toBe("warn");
    expect(result.details.some((detail) => detail.message.includes("STALE_VAR"))).toBe(true);
    expect(result.details.some((detail) => detail.file === ".env")).toBe(true);
  });
});

async function cleanupRepos(): Promise<void> {
  await Promise.all(
    createdRepos.splice(0).map((repoPath) => rm(repoPath, { recursive: true, force: true })),
  );
}

async function createRepo(files: Record<string, string>): Promise<string> {
  const repoPath = await mkdtemp(path.join(tmpdir(), "freshstart-env-"));
  createdRepos.push(repoPath);

  for (const [fileName, contents] of Object.entries(files)) {
    const filePath = path.join(repoPath, fileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return repoPath;
}

function context(repoPath: string): CheckContext {
  return {
    repoPath,
    config: DEFAULT_CONFIG,
    packageManager: "npm",
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
