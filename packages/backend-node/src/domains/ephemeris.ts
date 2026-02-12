import type {
  EphemerisApi,
  SpiceIntCell,
  SpiceStateVector,
  SpiceVector3,
  SpiceWindow,
  SpkPackedDescriptor,
  SpkUnpackedDescriptor,
  SpkezrResult,
  SpkposResult,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function assertSpkPackedDescriptor(out: unknown, label: string): asserts out is SpkPackedDescriptor {
  invariant(Array.isArray(out) && out.length === 5, `Expected ${label} to be a length-5 array`);
  for (let i = 0; i < 5; i++) {
    const v = out[i];
    invariant(typeof v === "number" && Number.isFinite(v), `Expected ${label}[${i}] to be a finite number`);
  }
}

export function createEphemerisApi(native: NativeAddon): EphemerisApi {
  return {
    spkezr: (target, et, ref, abcorr, observer) => {
      const out = native.spkezr(target, et, ref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected spkezr() to return an object");
      invariant(Array.isArray(out.state) && out.state.length === 6, "Expected spkezr().state to be a length-6 array");
      invariant(typeof out.lt === "number", "Expected spkezr().lt to be a number");
      const state = out.state as SpiceStateVector;
      const result: SpkezrResult = { state, lt: out.lt };
      return result;
    },

    spkpos: (target, et, ref, abcorr, observer) => {
      const out = native.spkpos(target, et, ref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected spkpos() to return an object");
      invariant(Array.isArray(out.pos) && out.pos.length === 3, "Expected spkpos().pos to be a length-3 array");
      invariant(typeof out.lt === "number", "Expected spkpos().lt to be a number");
      const pos = out.pos as SpiceVector3;
      const result: SpkposResult = { pos, lt: out.lt };
      return result;
    },

    spkez: (target, et, ref, abcorr, observer) => {
      const out = native.spkez(target, et, ref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected spkez() to return an object");
      invariant(Array.isArray(out.state) && out.state.length === 6, "Expected spkez().state to be a length-6 array");
      invariant(typeof out.lt === "number", "Expected spkez().lt to be a number");
      const state = out.state as SpiceStateVector;
      const result: SpkezrResult = { state, lt: out.lt };
      return result;
    },

    spkezp: (target, et, ref, abcorr, observer) => {
      const out = native.spkezp(target, et, ref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected spkezp() to return an object");
      invariant(Array.isArray(out.pos) && out.pos.length === 3, "Expected spkezp().pos to be a length-3 array");
      invariant(typeof out.lt === "number", "Expected spkezp().lt to be a number");
      const pos = out.pos as SpiceVector3;
      const result: SpkposResult = { pos, lt: out.lt };
      return result;
    },

    spkgeo: (target, et, ref, observer) => {
      const out = native.spkgeo(target, et, ref, observer);
      invariant(out && typeof out === "object", "Expected spkgeo() to return an object");
      invariant(Array.isArray(out.state) && out.state.length === 6, "Expected spkgeo().state to be a length-6 array");
      invariant(typeof out.lt === "number", "Expected spkgeo().lt to be a number");
      const state = out.state as SpiceStateVector;
      const result: SpkezrResult = { state, lt: out.lt };
      return result;
    },

    spkgps: (target, et, ref, observer) => {
      const out = native.spkgps(target, et, ref, observer);
      invariant(out && typeof out === "object", "Expected spkgps() to return an object");
      invariant(Array.isArray(out.pos) && out.pos.length === 3, "Expected spkgps().pos to be a length-3 array");
      invariant(typeof out.lt === "number", "Expected spkgps().lt to be a number");
      const pos = out.pos as SpiceVector3;
      const result: SpkposResult = { pos, lt: out.lt };
      return result;
    },

    spkssb: (target, et, ref) => {
      const out = native.spkssb(target, et, ref);
      invariant(Array.isArray(out) && out.length === 6, "Expected spkssb() to return a length-6 array");
      return out as SpiceStateVector;
    },

    spkcov: (spk: string, idcode: number, cover: SpiceWindow) => {
      native.spkcov(spk, idcode, cover);
    },

    spkobj: (spk: string, ids: SpiceIntCell) => {
      native.spkobj(spk, ids);
    },

    spksfs: (body: number, et: number) => {
      const out = native.spksfs(body, et);
      invariant(out && typeof out === "object", "Expected spksfs() to return an object");
      invariant(typeof out.found === "boolean", "Expected spksfs().found to be a boolean");
      if (!out.found) {
        return { found: false };
      }

      invariant(typeof out.handle === "number", "Expected spksfs().handle to be a number when found");
      const descr = out.descr;
      assertSpkPackedDescriptor(descr, "spksfs().descr");
      invariant(typeof out.ident === "string", "Expected spksfs().ident to be a string when found");

      return {
        found: true,
        handle: out.handle,
        descr,
        ident: out.ident,
      };
    },

    spkpds: (body: number, center: number, frame: string, type: number, first: number, last: number) => {
      const out = native.spkpds(body, center, frame, type, first, last);
      assertSpkPackedDescriptor(out, "spkpds() output");
      return out;
    },

    spkuds: (descr: SpkPackedDescriptor) => {
      const out = native.spkuds(descr);
      invariant(out && typeof out === "object", "Expected spkuds() to return an object");
      const obj = out as Record<string, unknown>;

      const keys = ["body", "center", "frame", "type", "first", "last", "baddr", "eaddr"] as const;
      for (const k of keys) {
        invariant(typeof obj[k] === "number", `Expected spkuds().${k} to be a number`);
      }

      return out as SpkUnpackedDescriptor;
    },
  };
}
