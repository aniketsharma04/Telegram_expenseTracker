import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Root tests also cover mobile/lib, whose tsconfig extends Expo's. CI installs
// only the root packages, so give esbuild its settings here instead of letting
// it look up each file's tsconfig.
export default defineConfig({
  // Route tests import through the app's "@/..." alias (tsconfig paths).
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: {
    tsconfigRaw: JSON.stringify({ compilerOptions: { target: "es2022" } }),
    // Page tests render server components; Next uses the automatic runtime.
    jsx: "automatic",
  },
});
