import type {
  SpiceHandle,
  VirtualOutput,
  SpiceHandleRegistry,
  FramesApi,
  SpiceMatrix6x6,
} from "@rybosome/tspice-backend-contract";
import {
  copyPckCoefficients,
  requirePckString,
  assertSpiceInt32,
  brandMat6RowMajor,
  brandMat3RowMajor,
  brandVec3,
  invariant,
} from "@rybosome/tspice-core";

import type { VirtualOutputStager } from "../runtime/virtual-output-staging.js";
import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";

function copyStateMatrix(value: unknown): SpiceMatrix6x6 {
  const matrix = brandMat6RowMajor(value, { label: "sxform()" });
  return [
    matrix[0],
    matrix[1],
    matrix[2],
    matrix[3],
    matrix[4],
    matrix[5],
    matrix[6],
    matrix[7],
    matrix[8],
    matrix[9],
    matrix[10],
    matrix[11],
    matrix[12],
    matrix[13],
    matrix[14],
    matrix[15],
    matrix[16],
    matrix[17],
    matrix[18],
    matrix[19],
    matrix[20],
    matrix[21],
    matrix[22],
    matrix[23],
    matrix[24],
    matrix[25],
    matrix[26],
    matrix[27],
    matrix[28],
    matrix[29],
    matrix[30],
    matrix[31],
    matrix[32],
    matrix[33],
    matrix[34],
    matrix[35],
  ];
}

const UINT32_MAX = 0xffff_ffff;

// Opaque cell/window handles are represented as branded numbers in the backend
// contract, but we still validate them at runtime to keep error behavior
// consistent across backends (mirrors the WASM handle assertions).
function assertOpaqueHandle(
  handle: unknown,
  context: string,
): asserts handle is number {
  if (
    typeof handle !== "number" ||
    !Number.isFinite(handle) ||
    !Number.isInteger(handle)
  ) {
    throw new TypeError(
      `${context}: expected handle to be an integer number (got ${handle})`,
    );
  }
  if (handle <= 0) {
    throw new RangeError(
      `${context}: expected handle to be > 0 (got ${handle})`,
    );
  }
  if (!Number.isSafeInteger(handle) || handle > UINT32_MAX) {
    throw new RangeError(
      `${context}: expected handle to be a non-zero uint32 (got ${handle})`,
    );
  }
}

function validateCkPointing(
  inst: number,
  sclkdp: number,
  tol: number,
  ref: string,
): void {
  assertSpiceInt32(inst, "CK instrument");
  if (!Number.isFinite(sclkdp) || !Number.isFinite(tol))
    throw new RangeError("CK clock and tolerance must be finite");
  if (typeof ref !== "string")
    throw new TypeError("CK reference must be a string");
}

function pckOutput(file: VirtualOutput): VirtualOutput {
  if (!file || file.kind !== "virtual-output")
    throw new TypeError("Expected a PCK path or VirtualOutput");
  return { kind: "virtual-output", path: requirePckString(file.path) };
}

/** Create a {@link FramesApi} implementation backed by the native Node addon. */
export function createFramesApi(
  native: NativeAddon,
  stager: Pick<KernelStager, "resolvePathForSpice">,
  handles: SpiceHandleRegistry,
  outputs: VirtualOutputStager,
  destinations: { ids: ReadonlySet<number>; windows: ReadonlySet<number> },
): FramesApi {
  const resolvePath = (path: string) => stager.resolvePathForSpice(path);
  const resolveRead = (file: string | VirtualOutput) =>
    typeof file === "string"
      ? resolvePath(requirePckString(file))
      : outputs.resolvePathForSpice(pckOutput(file));
  const writerOutputs = new Map<SpiceHandle, VirtualOutput>();

  const loaded = new Map<number, SpiceHandle>();
  return {
    pckopn: (file, ifname, ncomch) => {
      assertSpiceInt32(ncomch, "pckopn ncomch");
      requirePckString(ifname);
      const target =
        typeof file === "string" ? requirePckString(file) : pckOutput(file);
      const path = outputs.resolvePathForSpice(target);
      const value = native.pckopn(path, ifname, ncomch);
      try {
        const handle = handles.register("PCK-WRITER", value);
        if (typeof target !== "string") {
          outputs.markOpen(target);
          writerOutputs.set(handle, target);
        }
        return handle;
      } catch (error) {
        native.dafcls(value);
        throw error;
      }
    },
    pckcls: (handle) => {
      handles.close(
        handle,
        ["PCK-WRITER"],
        (entry) => native.pckcls(entry.nativeHandle),
        "pckcls",
      );
      const target = writerOutputs.get(handle);
      if (target) {
        outputs.markClosed(target);
        writerOutputs.delete(handle);
      }
    },
    pcklof: (file) => {
      const path = resolveRead(file);
      const value = native.pcklof(path);
      const existing = loaded.get(value);
      if (existing !== undefined) return existing;
      try {
        const handle = handles.register("PCK-LOADED", value);
        loaded.set(value, handle);
        return handle;
      } catch (error) {
        native.pckuof(value);
        throw error;
      }
    },
    pckuof: (handle) => {
      handles.close(
        handle,
        ["PCK-LOADED"],
        (entry) => {
          native.pckuof(entry.nativeHandle);
          loaded.delete(entry.nativeHandle);
        },
        "pckuof",
      );
    },
    pckcov: (file, classId, cover) => {
      const path = resolveRead(file);
      assertSpiceInt32(classId, "pckcov classId");
      if (!destinations.windows.has(cover))
        throw new RangeError("Expected an owned live PCK query destination");
      assertOpaqueHandle(cover, "pckcov");
      native.pckcov(path, classId, cover);
    },
    pckfrm: (file, ids) => {
      const path = resolveRead(file);
      if (!destinations.ids.has(ids))
        throw new RangeError("Expected an owned live PCK query destination");
      assertOpaqueHandle(ids, "pckfrm");
      native.pckfrm(path, ids);
    },
    pckw02: (
      handle,
      classId,
      frame,
      first,
      last,
      segid,
      intlen,
      n,
      degree,
      coefficients,
      btime,
    ) => {
      const values = copyPckCoefficients(n, degree, coefficients);
      assertSpiceInt32(classId, "pckw02 classId");
      requirePckString(frame);
      requirePckString(segid);
      if (![first, last, intlen, btime].every(Number.isFinite))
        throw new RangeError("PCK epochs and interval must be finite");
      const writer = handles.lookup(
        handle,
        ["PCK-WRITER"],
        "pckw02",
      ).nativeHandle;
      native.pckw02(
        writer,
        classId,
        frame,
        first,
        last,
        segid,
        intlen,
        n,
        degree,
        values,
        btime,
      );
    },
    namfrm: (name) => {
      const out = native.namfrm(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.code === "number",
        "Expected namfrm().code to be a number",
      );
      return { found: true, code: out.code };
    },

    frmnam: (code) => {
      assertSpiceInt32(code, "frmnam(code)");
      const out = native.frmnam(code);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.name === "string",
        "Expected frmnam().name to be a string",
      );
      return { found: true, name: out.name };
    },

    cidfrm: (center) => {
      assertSpiceInt32(center, "cidfrm(center)");
      const out = native.cidfrm(center);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.frcode === "number",
        "Expected cidfrm().frcode to be a number",
      );
      invariant(
        typeof out.frname === "string",
        "Expected cidfrm().frname to be a string",
      );
      return { found: true, frcode: out.frcode, frname: out.frname };
    },

    cnmfrm: (centerName) => {
      const out = native.cnmfrm(centerName);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.frcode === "number",
        "Expected cnmfrm().frcode to be a number",
      );
      invariant(
        typeof out.frname === "string",
        "Expected cnmfrm().frname to be a string",
      );
      return { found: true, frcode: out.frcode, frname: out.frname };
    },

    frinfo: (frameId) => {
      assertSpiceInt32(frameId, "frinfo(frameId)");
      const out = native.frinfo(frameId);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.center === "number",
        "Expected frinfo().center to be a number",
      );
      invariant(
        typeof out.frameClass === "number",
        "Expected frinfo().frameClass to be a number",
      );
      invariant(
        typeof out.classId === "number",
        "Expected frinfo().classId to be a number",
      );
      return {
        found: true,
        center: out.center,
        frameClass: out.frameClass,
        classId: out.classId,
      };
    },

    ccifrm: (frameClass, classId) => {
      assertSpiceInt32(frameClass, "ccifrm(frameClass)");
      assertSpiceInt32(classId, "ccifrm(classId)");
      const out = native.ccifrm(frameClass, classId);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.frcode === "number",
        "Expected ccifrm().frcode to be a number",
      );
      invariant(
        typeof out.frname === "string",
        "Expected ccifrm().frname to be a string",
      );
      invariant(
        typeof out.center === "number",
        "Expected ccifrm().center to be a number",
      );
      return {
        found: true,
        frcode: out.frcode,
        frname: out.frname,
        center: out.center,
      };
    },

    ckgp: (inst, sclkdp, tol, ref) => {
      validateCkPointing(inst, sclkdp, tol, ref);
      const out = native.ckgp(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      const cmat = brandMat3RowMajor(out.cmat, { label: "ckgp().cmat" });
      invariant(
        typeof out.clkout === "number",
        "Expected ckgp().clkout to be a number",
      );
      return { found: true, cmat, clkout: out.clkout };
    },

    ckgpav: (inst, sclkdp, tol, ref) => {
      validateCkPointing(inst, sclkdp, tol, ref);
      const out = native.ckgpav(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      const cmat = brandMat3RowMajor(out.cmat, { label: "ckgpav().cmat" });
      const av = brandVec3(out.av, { label: "ckgpav().av" });
      invariant(
        Array.isArray(out.av) && out.av.length === 3,
        "Expected ckgpav().av to be a length-3 array",
      );
      invariant(
        typeof out.clkout === "number",
        "Expected ckgpav().clkout to be a number",
      );
      return {
        found: true,
        cmat,
        av: [av[0], av[1], av[2]],
        clkout: out.clkout,
      };
    },

    cklpf: (ck) => {
      const handle = native.cklpf(resolvePath(ck));
      invariant(
        typeof handle === "number" && Number.isInteger(handle),
        "Expected cklpf() to return an integer handle",
      );
      return handle;
    },

    ckupf: (handle) => {
      native.ckupf(handle);
    },

    ckobj: (ck, ids) => {
      assertOpaqueHandle(ids, "ckobj(ids)");
      native.ckobj(resolvePath(ck), ids);
    },

    ckcov: (ck, idcode, needav, level, tol, timsys, cover) => {
      assertSpiceInt32(idcode, "ckcov(idcode)");
      if (!Number.isFinite(tol))
        throw new RangeError("ckcov tolerance must be finite");
      if (typeof needav !== "boolean")
        throw new TypeError("ckcov needav must be boolean");
      assertOpaqueHandle(cover, "ckcov(cover)");
      native.ckcov(resolvePath(ck), idcode, needav, level, tol, timsys, cover);
    },

    pxform: (from, to, et) => {
      if (!Number.isFinite(et))
        throw new TypeError("pxform(et) must be finite");
      const m = native.pxform(from, to, et);
      return brandMat3RowMajor(m, { label: "pxform()" });
    },

    sxform: (from, to, et): SpiceMatrix6x6 => {
      if (!Number.isFinite(et))
        throw new TypeError("sxform(et) must be finite");
      const m = native.sxform(from, to, et);
      invariant(
        Array.isArray(m) && m.length === 36,
        "Expected sxform() to return a length-36 array",
      );
      return copyStateMatrix(m);
    },
  };
}
