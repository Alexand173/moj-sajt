import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Replacing the defaults drops node_modules from the ignore list, so `eslint .`
    // walked the dependency tree and died with a heap out-of-memory error.
    "node_modules/**",
    // A vendored copy of the old server: thousands of files, none of them part of
    // this app's source. Linting the repo root chokes on it.
    "za_server/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".kombai/**",
    ".tmp/**",
  ]),
]);

export default eslintConfig;
