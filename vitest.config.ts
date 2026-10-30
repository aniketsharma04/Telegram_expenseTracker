import { defineConfig } from "vitest/config";

// Root tests also cover mobile/lib, whose tsconfig extends Expo's. CI installs
// only the root packages, so give esbuild its settings here instead of letting
// it look up each file's tsconfig.
export default defineConfig({
  esbuild: {
    tsconfigRaw: JSON.stringify({ compilerOptions: { target: "es2022" } }),
  },
});
