import { detectPackageManager as detectPackageManagerImpl } from "../lib/detector.js";
import type { DetectionWarning, PackageManager, PackageManagerPreference } from "../types/index.js";

export interface PackageManagerDetectionResult {
  packageManager: PackageManager;
  warnings: DetectionWarning[];
}

/**
 * Detects the package manager for a repository, falling back to "npm".
 *
 * @param repoPath - Repository root path.
 * @param packageManagerPreference - Configured package manager preference.
 */
export async function detectPackageManager(
  repoPath: string,
  packageManagerPreference: PackageManagerPreference = "auto",
): Promise<PackageManagerDetectionResult> {
  const result = await detectPackageManagerImpl(repoPath, packageManagerPreference);
  return {
    ...result,
    packageManager: result.packageManager || "npm",
  };
}
