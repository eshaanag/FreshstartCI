const CORE_VERSION = "0.1.0";

export * from "./types/index.js";
export * from "./lib/detector.js";
export * from "./checks/dependencyCheck.js";

/**
 * Returns the current FreshstartCI core package version.
 *
 * @returns The semantic version string bundled with the core package.
 *
 * @example
 * ```ts
 * import { getCoreVersion } from "@freshstart-ci/core";
 *
 * getCoreVersion();
 * ```
 */
export function getCoreVersion(): string {
  return CORE_VERSION;
}
