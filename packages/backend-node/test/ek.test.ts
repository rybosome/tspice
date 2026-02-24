import fs from "node:fs";
import os from "node:os";
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
    backend.raw.kclear();

    backend.raw.furnsh({ path: kernelPath, bytes });

    const ntab = backend.raw.ekntab();
    expect(ntab).toBeGreaterThan(0);

    const tables = Array.from({ length: ntab }, (_, i) => backend.raw.ektnam(i));
    expect(tables).toEqual(EXPECTED_TABLES);

    expect(() => backend.raw.ektnam(-1)).toThrow(/>=\s*0|non-negative/i);

    const handle = backend.raw.ekopr(kernelPath);
    expect(backend.raw.eknseg(handle)).toBe(EXPECTED_NSEG);
    backend.raw.ekcls(handle);

    expect(() => backend.raw.ekcls(handle)).toThrow(/invalid|closed/i);
  });

  it.runIf(nodeAddonAvailable())("supports ekfind + ekg* and fast-write roundtrip", async () => {
    const backend = await createNodeBackend();
    backend.raw.kclear();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ek-"));
    const peopleEkPath = path.join(tmpDir, "people.bes");

    const handle = backend.raw.ekopn(peopleEkPath, "people", 0);

    const cnames = ["ID", "COST", "NAME"] as const;
    const decls = [
      "DATATYPE = INTEGER, INDEXED = TRUE",
      "DATATYPE = DOUBLE PRECISION",
      "DATATYPE = CHARACTER*(*)",
    ] as const;

    const nrows = 3;
    const { segno, rcptrs } = backend.raw.ekifld(handle, "PEOPLE", nrows, cnames, decls);
    expect(rcptrs.length).toBe(nrows);

    const entszs = [1, 1, 1];
    const nlflgs = [false, false, false];

    backend.raw.ekacli(handle, segno, "ID", [1, 2, 3], entszs, nlflgs, rcptrs);
    backend.raw.ekacld(handle, segno, "COST", [10.5, 20.25, 30], entszs, nlflgs, rcptrs);
    backend.raw.ekaclc(handle, segno, "NAME", ["Alice", "Bob", "Carol"], entszs, nlflgs, rcptrs);
    backend.raw.ekffld(handle, segno, rcptrs);
    backend.raw.ekcls(handle);

    backend.raw.furnsh(peopleEkPath);

    const query = "SELECT ID, COST, NAME FROM PEOPLE ORDER BY ID";
    const findRes = backend.raw.ekfind(query);
    expect(findRes.ok).toBe(true);
    if (!findRes.ok) {
      throw new Error(`Unexpected ekfind() parse error: ${findRes.errmsg}`);
    }
    expect(findRes.nmrows).toBe(3);

    const ids: number[] = [];
    const costs: number[] = [];
    const names: string[] = [];

    for (let row = 0; row < findRes.nmrows; row++) {
      const id = backend.raw.ekgi(0, row, 0);
      expect(id.found).toBe(true);
      if (!id.found || id.isNull) throw new Error("Expected non-null ID");
      ids.push(id.value);

      const cost = backend.raw.ekgd(1, row, 0);
      expect(cost.found).toBe(true);
      if (!cost.found || cost.isNull) throw new Error("Expected non-null COST");
      costs.push(cost.value);

      const name = backend.raw.ekgc(2, row, 0);
      expect(name.found).toBe(true);
      if (!name.found || name.isNull) throw new Error("Expected non-null NAME");
      names.push(name.value);
    }

    expect(ids).toEqual([1, 2, 3]);
    expect(costs[0]).toBeCloseTo(10.5);
    expect(costs[1]).toBeCloseTo(20.25);
    expect(costs[2]).toBeCloseTo(30);
    expect(names).toEqual(["Alice", "Bob", "Carol"]);

    const vecEkPath = path.join(tmpDir, "vector.bes");
    const vecHandle = backend.raw.ekopn(vecEkPath, "vector", 0);
    const { segno: vecSegno, rcptrs: vecRcptrs } = backend.raw.ekifld(
      vecHandle,
      "VEC",
      1,
      ["V"],
      ["DATATYPE = INTEGER, SIZE = 2"],
    );
    backend.raw.ekacli(vecHandle, vecSegno, "V", [10, 11], [2], [false], vecRcptrs);
    backend.raw.ekffld(vecHandle, vecSegno, vecRcptrs);
    backend.raw.ekcls(vecHandle);

    backend.raw.furnsh(vecEkPath);
    const vecFind = backend.raw.ekfind("SELECT V FROM VEC");
    expect(vecFind.ok).toBe(true);
    if (!vecFind.ok) {
      throw new Error(`Unexpected ekfind() parse error: ${vecFind.errmsg}`);
    }
    expect(vecFind.nmrows).toBe(1);
    expect(backend.raw.ekgi(0, 0, 0)).toEqual({ found: true, isNull: false, value: 10 });
    expect(backend.raw.ekgi(0, 0, 1)).toEqual({ found: true, isNull: false, value: 11 });
    expect(backend.raw.ekgi(0, 0, 2)).toEqual({ found: false });

    const badQuery = backend.raw.ekfind("SELECT ID COST NAME FROM PEOPLE");
    expect(badQuery.ok).toBe(false);
    if (!badQuery.ok) {
      expect(badQuery.errmsg.length).toBeGreaterThan(0);
    }
  });

  it.runIf(nodeAddonAvailable())("ekaclc() hard-caps packed string allocations", async () => {
    const backend = await createNodeBackend();
    backend.raw.kclear();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ek-"));
    const ekPath = path.join(tmpDir, "caps.bes");

    const handle = backend.raw.ekopn(ekPath, "caps", 0);

    const { segno, rcptrs } = backend.raw.ekifld(
      handle,
      "CAPS",
      1,
      ["NAME"],
      ["DATATYPE = CHARACTER*(*)"],
    );

    // Per-string byte length cap (aligns with backend-wasm `kMaxEkVallenBytes`).
    const tooLong = "a".repeat(1_000_000);
    expect(() => backend.raw.ekaclc(handle, segno, "NAME", [tooLong], [1], [false], rcptrs)).toThrow(
      /value byte length exceeds cap/i,
    );

    // Total packed buffer cap (aligns with backend-wasm `WASM_MAX_ALLOC_BYTES`).
    const big = "a".repeat(900_000);
    const cvals = [big, ...Array.from({ length: 299 }, () => "")];
    expect(() => backend.raw.ekaclc(handle, segno, "NAME", cvals, [300], [false], rcptrs)).toThrow(
      /cvals buffer too large/i,
    );

    // Ensure we can still flush/close the fast-write segment after those input
    // validation failures.
    backend.raw.ekaclc(handle, segno, "NAME", ["ok"], [1], [false], rcptrs);
    backend.raw.ekffld(handle, segno, rcptrs);
    backend.raw.ekcls(handle);
  });
});
