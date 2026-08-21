import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["entrypoint.ts"],
  format: ["cjs"],
  target: "node20",
  clean: true,
  noExternal: [/(.*)/], // Bundle all dependencies
});
