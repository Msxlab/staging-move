import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "../../packages/shared/src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    setupFiles: ["./test-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws if it sees the client bundler. In Vitest
      // we are always Node so the safety check is meaningless — alias
      // it to a no-op so server-only modules are testable.
      "server-only": path.resolve(__dirname, "./test-server-only-shim.ts"),
    },
  },
});
