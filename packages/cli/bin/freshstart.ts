#!/usr/bin/env node
import { runCli } from "../src/index.js";

void runCli(process.argv).catch((error: unknown): void => {
  const message = error instanceof Error ? error.message : "Unknown CLI failure";

  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
