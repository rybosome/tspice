import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("Phase 1: kernel management", () => {
  const require = createRequire(import.meta.url);
  const nodeBackendAvailable = (() => {
    try {
      require.resolve("@rybosome/tspice-backend-node");
      return true;
    } catch {
      return false;
    }
  })();

  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: furnsh/kclear/ktotal/kdata/unload", async () => {
    const backend = await createBackend({ backend: "node" });
    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);

    backend.furnsh(lskPath);
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    const first = backend.kdata(0, "ALL");
    expect(first.found).toBe(true);
    if (first.found) {
      expect(typeof first.file).toBe("string");
      expect(typeof first.filtyp).toBe("string");
      expect(typeof first.source).toBe("string");
      expect(typeof first.handle).toBe("number");
    }

    backend.unload(lskPath);
    // Some kernels may remain loaded implicitly; allow either unload -> 0 or kclear -> 0.
    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);
  });

  it("wasm backend: writeFile/loadKernel + kernel APIs", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);

    // Exercise loadKernel(bareName, data) which prefixes /kernels and creates dirs.
    backend.loadKernel("naif0012.tls", lskBytes);
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    const first = backend.kdata(0, "ALL");
    expect(first.found).toBe(true);
    if (first.found) {
      expect(typeof first.file).toBe("string");
      expect(typeof first.filtyp).toBe("string");
      expect(typeof first.source).toBe("string");
      expect(typeof first.handle).toBe("number");
    }

    backend.unload("/kernels/naif0012.tls");
    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);

    // Exercise FS write + explicit furnsh now that /kernels exists.
    backend.writeFile("/kernels/naif0012.tls", lskBytes);
    backend.furnsh("/kernels/naif0012.tls");
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);
  });
});
