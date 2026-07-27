import { defineConfig } from "vitest/config";

// First test runner in the monorepo. Kept intentionally minimal: node env,
// only *.spec.ts under src. No globals — specs import { describe, it, expect }
// from "vitest" explicitly, so no tsconfig `types` change is needed.
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
  },
});
