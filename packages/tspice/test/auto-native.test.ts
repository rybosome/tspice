import fs from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

const NATIVE_PLATFORM_PACKAGES = {
  darwin: {
    arm64: "@rybosome/tspice-native-darwin-arm64",
    x64: "@rybosome/tspice-native-darwin-x64",
  },
  linux: {
    x64: "@rybosome/tspice-native-linux-x64-gnu",
  },
} as const;

function getNativePlatformPackage(): string | undefined {
  const platform = process.platform as keyof typeof NATIVE_PLATFORM_PACKAGES;
  const arch = process.arch as string;
  return NATIVE_PLATFORM_PACKAGES[platform]?.[
    arch as keyof (typeof NATIVE_PLATFORM_PACKAGES)[typeof platform]
  ];
}

const nativeAvailable = (() => {
  const pkgName = getNativePlatformPackage();
  if (!pkgName) {
    return false;
  }

  const require = createRequire(import.meta.url);

  let mod: unknown;
  try {
    mod = require(pkgName) as unknown;
  } catch (err) {
    // Skip only when the platform package is genuinely missing.
    if ((err as NodeJS.ErrnoException | undefined)?.code === "MODULE_NOT_FOUND") {
      return false;
    }
    throw err;
  }

  const bindingPath =
    typeof mod === "string"
      ? mod
      : typeof mod === "object" && mod !== null && "bindingPath" in mod
        ? (mod as { bindingPath?: unknown }).bindingPath
        : undefined;

  if (typeof bindingPath !== "string" || !fs.existsSync(bindingPath)) {
    return false;
  }

  // Confirm it can actually be loaded.
  require(bindingPath);
  return true;
})();

describe("createBackend({ backend: \"node\" })", () => {
  const itNative = it.runIf(nativeAvailable);

  itNative("prefers native backend when the platform package is present", async () => {
    const backend = await createBackend({ backend: "node" });
    expect(backend.tkvrsn("TOOLKIT")).not.toBe("");
  });
});
