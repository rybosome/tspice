import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";

import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

// Fixture source:
// https://naif.jpl.nasa.gov/pub/naif/pds/data/co-s_j_e_v-spice-6-v1.0/cosp_1000/data/ek/C29_36noise_a.bes
const fixturePath = path.join(testDir, "fixtures", "ek-fixture.bes");

const bytes = fs.readFileSync(fixturePath);
const kernelPath = "/kernels/ek-fixture.bes";

const EXPECTED_TABLES = ["CASSINI_NOISE_EVENTS"];
const EXPECTED_NSEG = 1;

describe("@rybosome/tspice-backend-node ek", () => {
  it.runIf(nodeAddonAvailable())("can query table metadata and open/close EK handles", async () => {
    const backend = await createNodeBackend();
    backend.kclear();

    backend.furnsh({ path: kernelPath, bytes });

    const ntab = backend.ekntab();
    expect(ntab).toBeGreaterThan(0);

    const tables = Array.from({ length: ntab }, (_, i) => backend.ektnam(i));
    expect(tables).toEqual(EXPECTED_TABLES);

    const handle = backend.ekopr(fixturePath);
    expect(backend.eknseg(handle)).toBe(EXPECTED_NSEG);
    backend.ekcls(handle);

    expect(() => backend.ekcls(handle)).toThrow(/invalid|closed/i);
  });
});
