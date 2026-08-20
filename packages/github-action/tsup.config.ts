import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["entrypoint.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  noExternal: [/(.*)/], // Bundle all dependencies
});
