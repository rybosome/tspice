import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ADDON_FILE = "tspice_backend_node_test.node";

type TestAddon = {
  __testFixedWidthToJsString(buf: Buffer, width: number): string;
};

function getTestAddonPath(): string {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(testDir, "..");
  return path.join(packageRoot, "native", "build", "Release", ADDON_FILE);
}

function nodeTestAddonAvailable(): boolean {
  return fs.existsSync(getTestAddonPath());
}

function requireNativeAddon(): TestAddon {
  const require = createRequire(import.meta.url);
  const bindingPath = getTestAddonPath();

  if (!fs.existsSync(bindingPath)) {
    throw new Error(`Native addon not found at ${bindingPath}`);
  }

  return require(bindingPath) as TestAddon;
}

describe("backend-node napi_helpers", () => {
  const itNative = it.runIf(nodeTestAddonAvailable());

  const itCI = it.runIf(process.env.CI === "true");
  itCI("CI sanity: native test addon should be present", () => {
    expect(nodeTestAddonAvailable()).toBe(true);
  });

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
