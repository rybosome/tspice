import type {
  EphemerisApi,
  SpiceIntCell,
  SpiceStateVector,
  SpiceVector3,
  SpiceWindow,
  SpkPackedDescriptor,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  validateCorrectionString,
  copyCorrectionInput,
  decodeCorrectionResult,
  copySpkPackedDescriptor,
  copySpkPackedDescriptorWords,
  invariant,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";
import type { SpiceHandleRegistry } from "../runtime/spice-handles.js";
import type { VirtualOutputStager } from "../runtime/virtual-output-staging.js";

function requireSpkNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${label} must be finite`);
  return value;
}
function requireSpkString(value: unknown, label: string): void {
  if (typeof value !== "string")
    throw new TypeError(`${label} must be a string`);
}
function readSpkState(value: unknown): SpiceStateVector {
  if (!Array.isArray(value) || value.length !== 6)
    throw new TypeError("Expected six SPK state components");
  return [
    requireSpkNumber(value[0], "state[0]"),
    requireSpkNumber(value[1], "state[1]"),
    requireSpkNumber(value[2], "state[2]"),
    requireSpkNumber(value[3], "state[3]"),
    requireSpkNumber(value[4], "state[4]"),
    requireSpkNumber(value[5], "state[5]"),
  ];
}
function readSpkPosition(value: unknown): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError("Expected three SPK position components");
  return [
    requireSpkNumber(value[0], "pos[0]"),
    requireSpkNumber(value[1], "pos[1]"),
    requireSpkNumber(value[2], "pos[2]"),
  ];
}

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
    spkacs: (target, et, ref, abcorr, observer) => {
      assertSpiceInt32(target, "spkacs(target)");
      requireSpkNumber(et, "spkacs(et)");
      validateCorrectionString(ref, "spkacs(ref)");
      validateCorrectionString(abcorr, "spkacs(abcorr)");
      assertSpiceInt32(observer, "spkacs(observer)");
      return decodeCorrectionResult(
        native.spkacs(target, et, ref, abcorr, observer),
        8,
      );
    },
    spkapo: (target, et, ref, observerState, abcorr) => {
      assertSpiceInt32(target, "spkapo(target)");
      requireSpkNumber(et, "spkapo(et)");
      validateCorrectionString(ref, "spkapo(ref)");
      const observerStateCopy = copyCorrectionInput(
        observerState,
        6,
        "spkapo(observerState)",
      );
      validateCorrectionString(abcorr, "spkapo(abcorr)");
      return decodeCorrectionResult(
        native.spkapo(target, et, ref, observerStateCopy, abcorr),
        4,
      );
    },
    spkapp: (target, et, ref, observerState, abcorr) => {
      assertSpiceInt32(target, "spkapp(target)");
      requireSpkNumber(et, "spkapp(et)");
      validateCorrectionString(ref, "spkapp(ref)");
      const observerStateCopy = copyCorrectionInput(
        observerState,
        6,
        "spkapp(observerState)",
      );
      validateCorrectionString(abcorr, "spkapp(abcorr)");
      return decodeCorrectionResult(
        native.spkapp(target, et, ref, observerStateCopy, abcorr),
        7,
      );
    },
    spkaps: (target, et, ref, abcorr, observerState, observerAcceleration) => {
      assertSpiceInt32(target, "spkaps(target)");
      requireSpkNumber(et, "spkaps(et)");
      validateCorrectionString(ref, "spkaps(ref)");
      validateCorrectionString(abcorr, "spkaps(abcorr)");
      const observerStateCopy = copyCorrectionInput(
        observerState,
        6,
        "spkaps(observerState)",
      );
      const observerAccelerationCopy = copyCorrectionInput(
        observerAcceleration,
        3,
        "spkaps(observerAcceleration)",
      );
      return decodeCorrectionResult(
        native.spkaps(
          target,
          et,
          ref,
          abcorr,
          observerStateCopy,
          observerAccelerationCopy,
        ),
        8,
      );
    },
    spkltc: (target, et, ref, abcorr, observerState) => {
      assertSpiceInt32(target, "spkltc(target)");
      requireSpkNumber(et, "spkltc(et)");
      validateCorrectionString(ref, "spkltc(ref)");
      validateCorrectionString(abcorr, "spkltc(abcorr)");
      const observerStateCopy = copyCorrectionInput(
        observerState,
        6,
        "spkltc(observerState)",
      );
      return decodeCorrectionResult(
        native.spkltc(target, et, ref, abcorr, observerStateCopy),
        8,
      );
    },
    stelab: (position, observerVelocity) => {
      const positionCopy = copyCorrectionInput(position, 3, "stelab(position)");
      const observerVelocityCopy = copyCorrectionInput(
        observerVelocity,
        3,
        "stelab(observerVelocity)",
      );
      return decodeCorrectionResult(
        native.stelab(positionCopy, observerVelocityCopy),
        3,
      );
    },
    stlabx: (position, observerVelocity) => {
      const positionCopy = copyCorrectionInput(position, 3, "stlabx(position)");
      const observerVelocityCopy = copyCorrectionInput(
        observerVelocity,
        3,
        "stlabx(observerVelocity)",
      );
      return decodeCorrectionResult(
        native.stlabx(positionCopy, observerVelocityCopy),
        3,
      );
    },
    ltime: (etobs, observer, dir, target) => {
      requireSpkNumber(etobs, "ltime(etobs)");
      assertSpiceInt32(observer, "ltime(observer)");
      validateCorrectionString(dir, "ltime(dir)");
      assertSpiceInt32(target, "ltime(target)");
      return decodeCorrectionResult(
        native.ltime(etobs, observer, dir, target),
        2,
      );
    },
    spkezr: (target, et, ref, abcorr, observer) => {
      requireSpkNumber(et, "spkezr(et)");
      requireSpkString(ref, "spkezr(ref)");
      requireSpkString(abcorr, "spkezr(abcorr)");
      requireSpkString(target, "spkezr(target)");
      requireSpkString(observer, "spkezr(observer)");
      const out = native.spkezr(target, et, ref, abcorr, observer);
      return {
        state: readSpkState(out.state),
        lt: requireSpkNumber(out.lt, "spkezr(lt)"),
      };
    },

    spkpos: (target, et, ref, abcorr, observer) => {
      requireSpkNumber(et, "spkpos(et)");
      requireSpkString(ref, "spkpos(ref)");
      requireSpkString(abcorr, "spkpos(abcorr)");
      requireSpkString(target, "spkpos(target)");
      requireSpkString(observer, "spkpos(observer)");
      const out = native.spkpos(target, et, ref, abcorr, observer);
      return {
        pos: readSpkPosition(out.pos),
        lt: requireSpkNumber(out.lt, "spkpos(lt)"),
      };
    },

    spkez: (target, et, ref, abcorr, observer) => {
      requireSpkNumber(et, "spkez(et)");
      requireSpkString(ref, "spkez(ref)");
      requireSpkString(abcorr, "spkez(abcorr)");
      assertSpiceInt32(target, "spkez(target)");
      assertSpiceInt32(observer, "spkez(observer)");
      const out = native.spkez(target, et, ref, abcorr, observer);
      return {
        state: readSpkState(out.state),
        lt: requireSpkNumber(out.lt, "spkez(lt)"),
      };
    },

    spkezp: (target, et, ref, abcorr, observer) => {
      requireSpkNumber(et, "spkezp(et)");
      requireSpkString(ref, "spkezp(ref)");
      requireSpkString(abcorr, "spkezp(abcorr)");
      assertSpiceInt32(target, "spkezp(target)");
      assertSpiceInt32(observer, "spkezp(observer)");
      const out = native.spkezp(target, et, ref, abcorr, observer);
      return {
        pos: readSpkPosition(out.pos),
        lt: requireSpkNumber(out.lt, "spkezp(lt)"),
      };
    },

    spkgeo: (target, et, ref, observer) => {
      requireSpkNumber(et, "spkgeo(et)");
      requireSpkString(ref, "spkgeo(ref)");
      assertSpiceInt32(target, "spkgeo(target)");
      assertSpiceInt32(observer, "spkgeo(observer)");
      const out = native.spkgeo(target, et, ref, observer);
      return {
        state: readSpkState(out.state),
        lt: requireSpkNumber(out.lt, "spkgeo(lt)"),
      };
    },

    spkgps: (target, et, ref, observer) => {
      requireSpkNumber(et, "spkgps(et)");
      requireSpkString(ref, "spkgps(ref)");
      assertSpiceInt32(target, "spkgps(target)");
      assertSpiceInt32(observer, "spkgps(observer)");
      const out = native.spkgps(target, et, ref, observer);
      return {
        pos: readSpkPosition(out.pos),
        lt: requireSpkNumber(out.lt, "spkgps(lt)"),
      };
    },

    spkssb: (target, et, ref) => {
      requireSpkNumber(et, "spkssb(et)");
      requireSpkString(ref, "spkssb(ref)");
      assertSpiceInt32(target, "spkssb(target)");
      const out = native.spkssb(target, et, ref);
      return readSpkState(out);
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
      assertSpiceInt32(body, "spksfs(body)");
      requireSpkNumber(et, "spksfs(et)");
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
