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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./test-setup.ts"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.join(reactNodeModules, "react"),
      "react/jsx-runtime": path.join(reactNodeModules, "react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.join(reactNodeModules, "react/jsx-dev-runtime.js"),
      "react-dom": path.join(reactNodeModules, "react-dom"),
      "react-dom/server": path.join(reactNodeModules, "react-dom/server.node.js"),
    },
  },
});
