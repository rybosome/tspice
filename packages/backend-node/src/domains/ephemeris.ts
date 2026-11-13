import type {
  EphemerisApi,
  SpiceIntCell,
  SpiceStateVector,
  SpiceVector3,
  SpiceWindow,
  SpkPackedDescriptor,
  SpkezrResult,
  SpkposResult,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  copySpkPackedDescriptor,
  copySpkPackedDescriptorWords,
  invariant,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";
import type { SpiceHandleRegistry } from "../runtime/spice-handles.js";
import type { VirtualOutputStager } from "../runtime/virtual-output-staging.js";

function validateSpkWriterNumbers(
  body: number,
  center: number,
  degree: number,
  first: number,
  last: number,
  epoch1: number,
  step: number,
  states: readonly number[] | Float64Array,
): void {
  assertSpiceInt32(body, "spkw08(body)");
  assertSpiceInt32(center, "spkw08(center)");
  assertSpiceInt32(degree, "spkw08(degree)");
  if (![first, last, epoch1, step].every(Number.isFinite))
    throw new RangeError("spkw08 epochs and step must be finite");
  // Bound work/allocation before reading any caller state element, including
  // sparse/proxied arrays. Match the existing WASM codec's 256 MiB guard.
  if (states.length * 8 + 7 > 256 * 1024 * 1024)
    throw new RangeError("spkw08 state buffer exceeds 256 MiB");
  for (let i = 0; i < states.length; i++)
    if (!Number.isFinite(states[i]))
      throw new RangeError("spkw08 states must contain only finite numbers");
}

const I32_MAX = 2147483647;

function isVirtualOutput(value: unknown): value is VirtualOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "virtual-output" &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

function resolveSpkPath(
  outputs: VirtualOutputStager,
  file: string | VirtualOutput,
  context: string,
): string {
  if (typeof file === "string") {
    return file;
  }

  // Be defensive: callers can cast.
  invariant(
    isVirtualOutput(file),
    `${context}: expected VirtualOutput {kind:'virtual-output', path:string}`,
  );
  return outputs.resolvePathForSpice(file);
}

/** Create an {@link EphemerisApi} implementation backed by the native Node addon. */
export function createEphemerisApi(
  native: NativeAddon,
  handles: SpiceHandleRegistry,
  stager: KernelStager,
  outputs: VirtualOutputStager,
): EphemerisApi {
  const virtualOutputByHandle = new Map<SpiceHandle, VirtualOutput>();

  return {
    spkezr: (target, et, ref, abcorr, observer) => {
      const out = native.spkezr(target, et, ref, abcorr, observer);
      invariant(
        out && typeof out === "object",
        "Expected spkezr() to return an object",
      );
      invariant(
        Array.isArray(out.state) && out.state.length === 6,
        "Expected spkezr().state to be a length-6 array",
      );
      invariant(
        typeof out.lt === "number",
        "Expected spkezr().lt to be a number",
      );
      const state = out.state as SpiceStateVector;
      const result: SpkezrResult = { state, lt: out.lt };
      return result;
    },

    spkpos: (target, et, ref, abcorr, observer) => {
      const out = native.spkpos(target, et, ref, abcorr, observer);
      invariant(
        out && typeof out === "object",
        "Expected spkpos() to return an object",
      );
      invariant(
        Array.isArray(out.pos) && out.pos.length === 3,
        "Expected spkpos().pos to be a length-3 array",
      );
      invariant(
        typeof out.lt === "number",
        "Expected spkpos().lt to be a number",
      );
      const pos = out.pos as SpiceVector3;
      const result: SpkposResult = { pos, lt: out.lt };
      return result;
    },

    spkez: (target, et, ref, abcorr, observer) => {
      const out = native.spkez(target, et, ref, abcorr, observer);
      invariant(
        out && typeof out === "object",
        "Expected spkez() to return an object",
      );
      invariant(
        Array.isArray(out.state) && out.state.length === 6,
        "Expected spkez().state to be a length-6 array",
      );
      invariant(
        typeof out.lt === "number",
        "Expected spkez().lt to be a number",
      );
      const state = out.state as SpiceStateVector;
      const result: SpkezrResult = { state, lt: out.lt };
      return result;
    },

    spkezp: (target, et, ref, abcorr, observer) => {
      const out = native.spkezp(target, et, ref, abcorr, observer);
      invariant(
        out && typeof out === "object",
        "Expected spkezp() to return an object",
      );
      invariant(
        Array.isArray(out.pos) && out.pos.length === 3,
        "Expected spkezp().pos to be a length-3 array",
      );
      invariant(
        typeof out.lt === "number",
        "Expected spkezp().lt to be a number",
      );
      const pos = out.pos as SpiceVector3;
      const result: SpkposResult = { pos, lt: out.lt };
      return result;
    },

    spkgeo: (target, et, ref, observer) => {
      const out = native.spkgeo(target, et, ref, observer);
      invariant(
        out && typeof out === "object",
        "Expected spkgeo() to return an object",
      );
      invariant(
        Array.isArray(out.state) && out.state.length === 6,
        "Expected spkgeo().state to be a length-6 array",
      );
      invariant(
        typeof out.lt === "number",
        "Expected spkgeo().lt to be a number",
      );
      const state = out.state as SpiceStateVector;
      const result: SpkezrResult = { state, lt: out.lt };
      return result;
    },

    spkgps: (target, et, ref, observer) => {
      const out = native.spkgps(target, et, ref, observer);
      invariant(
        out && typeof out === "object",
        "Expected spkgps() to return an object",
      );
      invariant(
        Array.isArray(out.pos) && out.pos.length === 3,
        "Expected spkgps().pos to be a length-3 array",
      );
      invariant(
        typeof out.lt === "number",
        "Expected spkgps().lt to be a number",
      );
      const pos = out.pos as SpiceVector3;
      const result: SpkposResult = { pos, lt: out.lt };
      return result;
    },

    spkssb: (target, et, ref) => {
      const out = native.spkssb(target, et, ref);
      invariant(
        Array.isArray(out) && out.length === 6,
        "Expected spkssb() to return a length-6 array",
      );
      return out as SpiceStateVector;
    },

    spkcov: (spk: string, idcode: number, cover: SpiceWindow) => {
      const resolved = stager.resolvePathForSpice(spk);
      native.spkcov(resolved, idcode, cover);
    },

    spkobj: (spk: string, ids: SpiceIntCell) => {
      const resolved = stager.resolvePathForSpice(spk);
      native.spkobj(resolved, ids);
    },

    spksfs: (body: number, et: number) => {
      const out = native.spksfs(body, et);
      invariant(
        out && typeof out === "object",
        "Expected spksfs() to return an object",
      );
      invariant(
        typeof out.found === "boolean",
        "Expected spksfs().found to be a boolean",
      );
      if (!out.found) {
        return { found: false };
      }

      invariant(
        typeof out.handle === "number",
        "Expected spksfs().handle to be a number when found",
      );
      const descr = copySpkPackedDescriptor(out.descr);
      invariant(
        typeof out.ident === "string",
        "Expected spksfs().ident to be a string when found",
      );

      return {
        found: true,
        handle: out.handle,
        descr,
        ident: out.ident,
      };
    },

    spkpds: (
      body: number,
      center: number,
      frame: string,
      type: number,
      first: number,
      last: number,
    ) => {
      if (!Number.isFinite(first) || !Number.isFinite(last))
        throw new RangeError("spkpds epochs must be finite");
      const out = native.spkpds(body, center, frame, type, first, last);
      return copySpkPackedDescriptor(out);
    },

    spkuds: (descr: SpkPackedDescriptor) => {
      const out = native.spkuds(copySpkPackedDescriptorWords(descr));
      invariant(
        out && typeof out === "object",
        "Expected spkuds() to return an object",
      );

      const keys = [
        "body",
        "center",
        "frame",
        "type",
        "first",
        "last",
        "baddr",
        "eaddr",
      ] as const;
      for (const k of keys) {
        invariant(
          typeof out[k] === "number",
          `Expected spkuds().${k} to be a number`,
        );
      }

      return out;
    },

    // --- SPK writers -------------------------------------------------------

    spkopn: (file: string | VirtualOutput, ifname: string, ncomch: number) => {
      const path = resolveSpkPath(outputs, file, "spkopn(file)");
      assertSpiceInt32(ncomch, "spkopn(ncomch)");
      if (typeof ifname !== "string")
        throw new TypeError("spkopn ifname must be a string");
      const nativeHandle = native.spkopn(path, ifname, ncomch);

      const handle = handles.register("SPK", nativeHandle);
      if (typeof file !== "string") {
        // `resolveSpkPath` already validated, but be defensive: callers can cast.
        invariant(
          isVirtualOutput(file),
          "spkopn(file): expected VirtualOutput {kind:'virtual-output', path:string}",
        );
        const out: VirtualOutput = { kind: "virtual-output", path: file.path };
        outputs.markOpen(out);
        virtualOutputByHandle.set(handle, out);
      }

      return handle;
    },

    spkopa: (file: string | VirtualOutput) => {
      const path = resolveSpkPath(outputs, file, "spkopa(file)");
      const nativeHandle = native.spkopa(path);

      const handle = handles.register("SPK", nativeHandle);
      if (typeof file !== "string") {
        invariant(
          isVirtualOutput(file),
          "spkopa(file): expected VirtualOutput {kind:'virtual-output', path:string}",
        );
        const out: VirtualOutput = { kind: "virtual-output", path: file.path };
        outputs.markOpen(out);
        virtualOutputByHandle.set(handle, out);
      }

      return handle;
    },

    spkcls: (handle: SpiceHandle) => {
      const out = virtualOutputByHandle.get(handle);
      handles.close(
        handle,
        ["SPK"],
        (e) => native.spkcls(e.nativeHandle),
        "spkcls",
      );
      if (out) {
        outputs.markClosed(out);
        virtualOutputByHandle.delete(handle);
      }
    },

    spkw08: (
      handle: SpiceHandle,
      body: number,
      center: number,
      frame: string,
      first: number,
      last: number,
      segid: string,
      degree: number,
      states: readonly number[] | Float64Array,
      epoch1: number,
      step: number,
    ) => {
      invariant(
        Array.isArray(states) || states instanceof Float64Array,
        "spkw08(states): expected number[] or Float64Array",
      );
      invariant(
        states.length % 6 === 0,
        "spkw08(): expected states.length to be a multiple of 6",
      );
      invariant(
        states.length > 0,
        "spkw08(): expected at least one state record",
      );

      const n = states.length / 6;
      invariant(
        Number.isSafeInteger(n) && n > 0 && n <= I32_MAX,
        `spkw08(): expected states.length/6 to be a 32-bit signed integer (got n=${n})`,
      );

      if (typeof frame !== "string" || typeof segid !== "string")
        throw new TypeError("spkw08 frame and segid must be strings");
      validateSpkWriterNumbers(
        body,
        center,
        degree,
        first,
        last,
        epoch1,
        step,
        states,
      );
      const nativeHandle = handles.lookup(
        handle,
        ["SPK"],
        "spkw08",
      ).nativeHandle;
      native.spkw08(
        nativeHandle,
        body,
        center,
        frame,
        first,
        last,
        segid,
        degree,
        states,
        epoch1,
        step,
      );
    },
  };
}
