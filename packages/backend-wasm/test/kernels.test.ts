import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe("@rybosome/tspice-backend-wasm kernels", () => {
  it("can furnsh/unload byte-backed kernels via the emscripten FS", async () => {
    const backend = await createWasmBackend();

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
