const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: keep Expo defaults and add the workspace root.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders || []), monorepoRoot]),
);

// Resolve packages from monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ensure symlinked packages resolve correctly
config.resolver.disableHierarchicalLookup = false;

// Remap @locateflow/shared to mobile-safe entry (excludes Node crypto)
const sharedPkgRoot = path.resolve(monorepoRoot, "packages", "shared");
const sharedMobileEntry = path.resolve(sharedPkgRoot, "src", "index.mobile.ts");
const workspaceNodeModules = path.resolve(monorepoRoot, "node_modules");

const singleReactModules = new Map([
  ["react", path.resolve(workspaceNodeModules, "react", "index.js")],
  ["react/jsx-runtime", path.resolve(workspaceNodeModules, "react", "jsx-runtime.js")],
  ["react/jsx-dev-runtime", path.resolve(workspaceNodeModules, "react", "jsx-dev-runtime.js")],
  ["react-dom", path.resolve(workspaceNodeModules, "react-dom", "index.js")],
  ["react-dom/client", path.resolve(workspaceNodeModules, "react-dom", "client.js")],
]);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept bare import of @locateflow/shared and point to mobile entry
  if (moduleName === "@locateflow/shared") {
    return {
      type: "sourceFile",
      filePath: sharedMobileEntry,
    };
  }
  const singleReactPath = singleReactModules.get(moduleName);
  if (singleReactPath) {
    return {
      type: "sourceFile",
      filePath: singleReactPath,
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/styles/global.css" });
