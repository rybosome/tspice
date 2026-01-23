import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe("@rybosome/tspice-backend-node kernels", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("can furnsh/unload path-backed kernels", () => {
    const backend = createNodeBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");

    const withTesting = backend as typeof backend & { __ktotalAll(): number };
    const before = withTesting.__ktotalAll();

    backend.furnsh(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before + 1);

    backend.unload(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before);
  });

  itNative("can furnsh/unload byte-backed kernels via a temp file", () => {
    const backend = createNodeBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");
    const bytes = fs.readFileSync(fixturePath);

    const kernelPath = "/kernels/minimal.tm";

    const withTesting = backend as typeof backend & { __ktotalAll(): number };
    const before = withTesting.__ktotalAll();

    backend.furnsh({ path: kernelPath, bytes });
    expect(withTesting.__ktotalAll()).toBe(before + 1);

    backend.unload(kernelPath);
    expect(withTesting.__ktotalAll()).toBe(before);
  });
});
