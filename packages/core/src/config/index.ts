import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { DEFAULT_CONFIG, FreshstartConfig, FreshstartConfigFileSchema } from "../types/index.js";

export function loadConfig(repoPath: string): FreshstartConfig {
  const possiblePaths = [
    path.join(repoPath, ".freshstart.yml"),
    path.join(repoPath, ".freshstart.yaml"),
  ];

  let configFilePath: string | undefined;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      configFilePath = p;
      break;
    }
  }

  if (!configFilePath) {
    return DEFAULT_CONFIG;
  }

  try {
    const rawContent = fs.readFileSync(configFilePath, "utf8");
    const parsedYaml = yaml.load(rawContent);

    if (typeof parsedYaml !== "object" || parsedYaml === null) {
      return DEFAULT_CONFIG;
    }

    return FreshstartConfigFileSchema.parse(parsedYaml);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse config at ${configFilePath}: ${error.message}`);
    }
    throw error;
  }
}
