const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch all packages
config.watchFolders = [monorepoRoot];

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

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept bare import of @locateflow/shared and point to mobile entry
  if (moduleName === "@locateflow/shared") {
    return {
      type: "sourceFile",
      filePath: sharedMobileEntry,
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/styles/global.css" });
