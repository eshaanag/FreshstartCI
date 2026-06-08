import { getCoreVersion } from "@freshstart-ci/core";

/**
 * Returns the action bootstrap message used while the GitHub Action package is scaffolded.
 *
 * @returns A deterministic action startup message.
 *
 * @example
 * ```ts
 * getActionBootstrapMessage();
 * ```
 */
export function getActionBootstrapMessage(): string {
  return `FreshstartCI action ${getCoreVersion()}`;
}
