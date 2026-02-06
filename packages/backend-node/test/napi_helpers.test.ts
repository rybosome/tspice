import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const ADDON_FILE = "tspice_backend_node.node";

function requireNativeAddon(): any {
  const require = createRequire(import.meta.url);
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(testDir, "..");

  const override = process.env.TSPICE_BACKEND_NODE_BINDING_PATH;
  const bindingPath = override
    ? path.resolve(packageRoot, override)
    : path.join(packageRoot, "native", "build", "Release", ADDON_FILE);

  if (!fs.existsSync(bindingPath)) {
    throw new Error(`Native addon not found at ${bindingPath}`);
  }

  return require(bindingPath);
}

describe("backend-node napi_helpers", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("__testFixedWidthToJsString: stops at NUL terminator", () => {
    const addon = requireNativeAddon();
    const buf = Buffer.from(["a".charCodeAt(0), 0, "b".charCodeAt(0)]);
    expect(addon.__testFixedWidthToJsString(buf, 3)).toBe("a");
  });

  itNative("__testFixedWidthToJsString: right-trims only", () => {
    const addon = requireNativeAddon();
    const buf = Buffer.from("  hi  ", "utf8");
    expect(addon.__testFixedWidthToJsString(buf, buf.length)).toBe("  hi");
  });
});
