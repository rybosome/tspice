import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");

const SRC_ADDON_PATH = path.join(
  repoRoot,
  "packages",
  "backend-node",
  "native",
  "build",
  "Release",
  "tspice_backend_node.node",
);

const TARGETS = {
  darwin: {
    arm64: "tspice-native-darwin-arm64",
    x64: "tspice-native-darwin-x64",
  },
  linux: {
    x64: "tspice-native-linux-x64-gnu",
  },
};

const platform = process.platform as keyof typeof TARGETS;
const arch = process.arch as string;

const targetPkg = TARGETS[platform]?.[arch as keyof (typeof TARGETS)[typeof platform]];

if (!targetPkg) {
  // No supported platform package for this runtime.
  process.exit(0);
}

if (!fs.existsSync(SRC_ADDON_PATH)) {
  throw new Error(
    `Missing native addon at ${SRC_ADDON_PATH}. Run: pnpm -C packages/backend-node build:native`,
  );
}

const destPath = path.join(repoRoot, "packages", targetPkg, "tspice_backend_node.node");
fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.copyFileSync(SRC_ADDON_PATH, destPath);
