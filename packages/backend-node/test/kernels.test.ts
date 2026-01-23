import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

const defaultBindingPath = path.resolve(
  testDir,
  "../native/build/Release/tspice_backend_node.node",
);

const bindingPath =
  process.env.TSPICE_BACKEND_NODE_BINDING_PATH ?? defaultBindingPath;

const runNativeTests = process.env.TSPICE_RUN_NODE_BACKEND_TESTS === "1";
const bindingExists = fs.existsSync(bindingPath);

if (!runNativeTests) {
  console.warn(
    "Skipping @rybosome/tspice-backend-node native tests (set TSPICE_RUN_NODE_BACKEND_TESTS=1 to enable).",
  );
} else if (!bindingExists) {
  console.warn(
    `Skipping @rybosome/tspice-backend-node native tests (native addon not found at ${bindingPath}).`,
  );
}

const shouldRun = runNativeTests && bindingExists;
const maybeDescribe = shouldRun ? describe : describe.skip;

maybeDescribe("@rybosome/tspice-backend-node kernels", () => {
  let createNodeBackend: typeof import("@rybosome/tspice-backend-node").createNodeBackend;

  beforeAll(async () => {
    ({ createNodeBackend } = await import("@rybosome/tspice-backend-node"));
  });

  it("can furnsh/unload path-backed kernels", () => {
    const backend = createNodeBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");

    const withTesting = backend as typeof backend & { __ktotalAll(): number };
    const before = withTesting.__ktotalAll();

    backend.furnsh(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before + 1);

    backend.unload(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before);
  });

  it("can furnsh/unload byte-backed kernels via a temp file", () => {
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
