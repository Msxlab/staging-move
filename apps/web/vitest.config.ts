import { defineConfig } from "vitest/config";
import path from "path";
import { existsSync } from "fs";

const appNodeModules = path.resolve(__dirname, "./node_modules");
const rootNodeModules = path.resolve(__dirname, "../../node_modules");
const reactNodeModules = existsSync(path.join(appNodeModules, "react"))
  ? appNodeModules
  : rootNodeModules;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "../../packages/shared/src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    setupFiles: ["./test-setup.ts"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws if it sees the client bundler. In Vitest
      // we are always Node so the safety check is meaningless — alias
      // it to a no-op so server-only modules are testable.
      "server-only": path.resolve(__dirname, "./test-server-only-shim.ts"),
      // Keep Next internals and test renderers on one React copy. pnpm's
      // hoisted linker places it at the repo root; app-local installs still
      // work through the fallback above.
      "react": path.join(reactNodeModules, "react"),
      "react/jsx-runtime": path.join(reactNodeModules, "react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.join(reactNodeModules, "react/jsx-dev-runtime.js"),
      "react-dom": path.join(reactNodeModules, "react-dom"),
      "react-dom/server": path.join(reactNodeModules, "react-dom/server.node.js"),
    },
  },
});
