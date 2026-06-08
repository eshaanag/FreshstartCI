import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "bin/freshstart.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
});
