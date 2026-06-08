import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIG,
  FreshstartConfigFileSchema,
  FreshstartConfigSchema,
} from "../src/types/index.js";

describe("FreshstartConfigSchema", () => {
  it("returns complete defaults for an empty config", () => {
    expect(FreshstartConfigSchema.parse({})).toEqual(DEFAULT_CONFIG);
  });

  it("normalizes dashed YAML keys into the runtime config shape", () => {
    const config = FreshstartConfigFileSchema.parse({
      checks: {
        env: false,
      },
      "fail-below": 90,
      "package-manager": "pnpm",
    });

    expect(config.checks.env).toBe(false);
    expect(config.checks.build).toBe(true);
    expect(config.failBelow).toBe(90);
    expect(config.packageManager).toBe("pnpm");
  });

  it("returns specific config validation messages", () => {
    const result = FreshstartConfigFileSchema.safeParse({
      checks: {
        env: "yes",
      },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("checks.env must be a boolean");
    }
  });
});
