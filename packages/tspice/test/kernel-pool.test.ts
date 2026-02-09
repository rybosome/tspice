import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

const TEST_VAR = "TSPICE_TEST_VAR";
const TEST_AGENT = "TSPICE_TEST_AGENT";

describe("Kernel pool", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: read + write + watch", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(lskPath);

    // Argument validation (contract parity across backends)
    expect(() => backend.gdpool("DELTET/DELTA_T_A", -1, 8)).toThrow(/start/i);
    expect(() => backend.gdpool("DELTET/DELTA_T_A", 0, 0)).toThrow(/room/i);

    const dt = backend.dtpool("DELTET/DELTA_T_A");
    expect(dt.found).toBe(true);
    if (dt.found) {
      expect(dt.type).toBe("N");
      expect(dt.n).toBe(1);
    }

    const deltatA = backend.gdpool("DELTET/DELTA_T_A", 0, 8);
    expect(deltatA.found).toBe(true);
    if (deltatA.found) {
      expect(deltatA.values[0]).toBeCloseTo(32.184);
    }

    const names = backend.gnpool("DELTET/*", 0, 64);
    expect(names.found).toBe(true);
    if (names.found) {
      expect(names.values).toContain("DELTET/DELTA_T_A");
    }

    backend.pdpool(TEST_VAR, [1, 2, 3]);

    const wrote = backend.gdpool(TEST_VAR, 0, 16);
    expect(wrote.found).toBe(true);
    if (wrote.found) {
      expect(wrote.values).toEqual([1, 2, 3]);
    }

    expect(backend.expool(TEST_VAR)).toBe(true);
    expect(backend.expool("NOT_A_VAR")).toBe(false);

    backend.swpool(TEST_AGENT, [TEST_VAR]);
    expect(backend.cvpool(TEST_AGENT)).toBe(true);
    expect(backend.cvpool(TEST_AGENT)).toBe(false);

    backend.pdpool(TEST_VAR, [4]);
    expect(backend.cvpool(TEST_AGENT)).toBe(true);
    expect(backend.cvpool(TEST_AGENT)).toBe(false);
  });

  it("wasm backend: read + write + watch", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });

    // Argument validation (contract parity across backends)
    expect(() => backend.gdpool("DELTET/DELTA_T_A", -1, 8)).toThrow(/start/i);
    expect(() => backend.gdpool("DELTET/DELTA_T_A", 0, 0)).toThrow(/room/i);

    const dt = backend.dtpool("DELTET/DELTA_T_A");
    expect(dt.found).toBe(true);
    if (dt.found) {
      expect(dt.type).toBe("N");
      expect(dt.n).toBe(1);
    }

    const deltatA = backend.gdpool("DELTET/DELTA_T_A", 0, 8);
    expect(deltatA.found).toBe(true);
    if (deltatA.found) {
      expect(deltatA.values[0]).toBeCloseTo(32.184);
    }

    const names = backend.gnpool("DELTET/*", 0, 64);
    expect(names.found).toBe(true);
    if (names.found) {
      expect(names.values).toContain("DELTET/DELTA_T_A");
    }

    backend.pdpool(TEST_VAR, [1, 2, 3]);

    const wrote = backend.gdpool(TEST_VAR, 0, 16);
    expect(wrote.found).toBe(true);
    if (wrote.found) {
      expect(wrote.values).toEqual([1, 2, 3]);
    }

    expect(backend.expool(TEST_VAR)).toBe(true);
    expect(backend.expool("NOT_A_VAR")).toBe(false);

    backend.swpool(TEST_AGENT, [TEST_VAR]);
    expect(backend.cvpool(TEST_AGENT)).toBe(true);
    expect(backend.cvpool(TEST_AGENT)).toBe(false);

    backend.pdpool(TEST_VAR, [4]);
    expect(backend.cvpool(TEST_AGENT)).toBe(true);
    expect(backend.cvpool(TEST_AGENT)).toBe(false);
  });
});
