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
      // Keep Next internals and test renderers on the web app's React copy.
      // The monorepo also carries Expo's React version for mobile.
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react-dom/server": path.resolve(__dirname, "./node_modules/react-dom/server.node.js"),
    },
  },
});
