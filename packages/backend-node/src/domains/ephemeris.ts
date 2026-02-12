import type {
  EphemerisApi,
  SpiceStateVector,
  SpiceVector3,
  SpkezrResult,
  SpkposResult,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { SpiceHandleRegistry } from "../runtime/spice-handles.js";
import type { VirtualOutputStager } from "../runtime/virtual-output-staging.js";

function isVirtualOutput(value: unknown): value is VirtualOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "virtual-output" &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

function resolveSpkPath(outputs: VirtualOutputStager, file: string | VirtualOutput, context: string): string {
  if (typeof file === "string") {
    return file;
  }

  // Be defensive: callers can cast.
  invariant(isVirtualOutput(file), `${context}: expected VirtualOutput {kind:'virtual-output', path:string}`);
  return outputs.resolvePathForSpice(file);
}

export function createEphemerisApi(
  native: NativeAddon,
  handles: SpiceHandleRegistry,
  outputs: VirtualOutputStager,
): EphemerisApi {
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

    spkopn: (file: string | VirtualOutput, ifname: string, ncomch: number) => {
      const path = resolveSpkPath(outputs, file, "spkopn(file)");
      const nativeHandle = native.spkopn(path, ifname, ncomch);
      return handles.register("SPK", nativeHandle);
    },

    spkopa: (file: string | VirtualOutput) => {
      const path = resolveSpkPath(outputs, file, "spkopa(file)");
      const nativeHandle = native.spkopa(path);
      return handles.register("SPK", nativeHandle);
    },

    spkcls: (handle: SpiceHandle) =>
      handles.close(handle, ["SPK"], (e) => native.spkcls(e.nativeHandle), "spkcls"),

    spkw08: (
      handle: SpiceHandle,
      body: number,
      center: number,
      frame: string,
      first: number,
      last: number,
      segid: string,
      degree: number,
      states: readonly number[],
      epoch1: number,
      step: number,
    ) => {
      invariant(Array.isArray(states), "spkw08(states): expected an array");
      invariant(states.length % 6 === 0, "spkw08(): expected states.length to be a multiple of 6");
      invariant(states.length > 0, "spkw08(): expected at least one state record");

      const nativeHandle = handles.lookup(handle, ["SPK"], "spkw08").nativeHandle;
      native.spkw08(nativeHandle, body, center, frame, first, last, segid, degree, states, epoch1, step);
    },
  };
}
