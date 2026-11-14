import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { KernelStager } from "../runtime/kernel-staging.js";
import {
  assertSpiceInt32,
  normalizeVirtualKernelPath,
  poolLineTable,
  poolSourceBytes,
  poolTypeChar,
  spiceStringByteLength,
} from "@rybosome/tspice-core";
import type { KernelPoolApi } from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32NonNegative, invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function assertPoolRange(fn: string, start: number, room: number): void {
  assertSpiceInt32NonNegative(start, `${fn}(start)`);
  assertSpiceInt32NonNegative(room, `${fn}(room)`);
  if (room === 0) throw new RangeError(`${fn}(room): expected an integer > 0`);
}

function bodyValues(result: { dim: number; values: number[] }, maxn: number) {
  const { dim, values } = result;
  if (
    !Number.isInteger(dim) ||
    dim < 0 ||
    dim > maxn ||
    dim > 400000 ||
    !Array.isArray(values) ||
    values.length !== dim
  )
    throw new Error("Invalid body constant result dimension");
  const copy: number[] = [];
  for (let i = 0; i < dim; i++) {
    const value = values[i];
    if (typeof value !== "number")
      throw new Error("Invalid body constant result value");
    copy.push(value);
  }
  return { dim, values: copy };
}

/** Create a {@link KernelPoolApi} implementation backed by the native Node addon. */
export function createKernelPoolApi(
  native: NativeAddon,
  stager: Pick<KernelStager, "resolvePathForSpice">,
): KernelPoolApi {
  return {
    badkpv: (caller, name, comp, size, divby, type) => {
      spiceStringByteLength(caller, "badkpv caller");
      spiceStringByteLength(name, "badkpv name");
      spiceStringByteLength(comp, "badkpv comp");
      assertSpiceInt32(size, "badkpv size");
      assertSpiceInt32(divby, "badkpv divby");
      poolTypeChar(type);
      const result = native.badkpv(caller, name, comp, size, divby, type);
      invariant(typeof result === "boolean", "Invalid badkpv result");
      return result;
    },
    bodvcd: (body, item, maxn) => {
      assertSpiceInt32(body, "bodvcd body");
      spiceStringByteLength(item, "bodvcd item");
      assertSpiceInt32(maxn, "bodvcd maxn");
      return bodyValues(native.bodvcd(body, item, maxn), maxn);
    },
    bodvrd: (body, item, maxn) => {
      spiceStringByteLength(body, "bodvrd body");
      spiceStringByteLength(item, "bodvrd item");
      assertSpiceInt32(maxn, "bodvrd maxn");
      return bodyValues(native.bodvrd(body, item, maxn), maxn);
    },
    clpool: () => native.clpool(),
    dvpool: (name) => {
      spiceStringByteLength(name, "dvpool name");
      native.dvpool(name);
    },
    ldpool: (kernel) => {
      if (typeof kernel === "string") {
        spiceStringByteLength(kernel, "ldpool path");
        native.ldpool(kernel ? stager.resolvePathForSpice(kernel) : kernel);
        return;
      }
      const source = poolSourceBytes(kernel);
      normalizeVirtualKernelPath(source.path);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ldpool-"));
      try {
        const file = path.join(dir, "pool.tpc");
        fs.writeFileSync(file, source.bytes);
        native.ldpool(file);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    lmpool: (input) => {
      const { lines } = poolLineTable(input, 2147483647);
      native.lmpool(lines);
    },
    stpool: (item, nth, contin, lenout) => {
      spiceStringByteLength(item, "stpool item");
      spiceStringByteLength(contin, "stpool contin");
      assertSpiceInt32(nth, "stpool nth");
      assertSpiceInt32(lenout, "stpool lenout");
      const out = native.stpool(item, nth, contin, lenout);
      if (!out.found) return { found: false };
      invariant(
        typeof out.nthstr === "string" &&
          Number.isInteger(out.size) &&
          out.size >= 0 &&
          out.size <= 1200000,
        "Invalid stpool result",
      );
      return { found: true, nthstr: out.nthstr, size: out.size };
    },
    szpool: (name) => {
      spiceStringByteLength(name, "szpool name");
      const out = native.szpool(name);
      if (!out.found) return { found: false };
      invariant(Number.isInteger(out.n) && out.n >= 0, "Invalid szpool result");
      return { found: true, n: out.n };
    },

    gdpool: (name, start, room) => {
      assertPoolRange("gdpool", start, room);
      const out = native.gdpool(name, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        Array.isArray(out.values),
        "Expected gdpool().values to be an array",
      );
      return { found: true, values: out.values };
    },

    gipool: (name, start, room) => {
      assertPoolRange("gipool", start, room);
      const out = native.gipool(name, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        Array.isArray(out.values),
        "Expected gipool().values to be an array",
      );
      return { found: true, values: out.values };
    },

    gcpool: (name, start, room) => {
      assertPoolRange("gcpool", start, room);
      const out = native.gcpool(name, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        Array.isArray(out.values),
        "Expected gcpool().values to be an array",
      );
      return { found: true, values: out.values };
    },

    gnpool: (template, start, room) => {
      assertPoolRange("gnpool", start, room);
      const out = native.gnpool(template, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        Array.isArray(out.values),
        "Expected gnpool().values to be an array",
      );
      return { found: true, values: out.values };
    },

    dtpool: (name) => {
      const out = native.dtpool(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.n === "number",
        "Expected dtpool().n to be a number",
      );
      invariant(
        typeof out.type === "string",
        "Expected dtpool().type to be a string",
      );
      const t = out.type.trim();
      if (t !== "C" && t !== "N") {
        throw new Error(`dtpool(): unexpected type '${t}' for ${name}`);
      }
      return { found: true, n: out.n, type: t };
    },

    pdpool: (name, values) => {
      native.pdpool(name, values);
    },

    pipool: (name, values) => {
      native.pipool(name, values);
    },

    pcpool: (name, values) => {
      native.pcpool(name, values);
    },

    swpool: (agent, names) => {
      native.swpool(agent, names);
    },

    cvpool: (agent) => {
      const out = native.cvpool(agent);
      invariant(
        typeof out === "boolean",
        "Expected cvpool() to return a boolean",
      );
      return out;
    },

    expool: (name) => {
      const out = native.expool(name);
      invariant(
        typeof out === "boolean",
        "Expected expool() to return a boolean",
      );
      return out;
    },
  } satisfies KernelPoolApi;
}
