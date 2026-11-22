import type {
  FramesApi,
  SpiceMatrix6x6,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  brandMat3RowMajorResult,
  frameOperand,
  frameVectorResult,
  frameStateResult,
  frameMatrixResult,
  brandMat6RowMajor,
  brandMat3RowMajor,
  brandVec3,
  invariant,
} from "@rybosome/tspice-core";

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

/** Create a {@link FramesApi} implementation backed by the native Node addon. */
export function createFramesApi(
  native: NativeAddon,
  stager: Pick<KernelStager, "resolvePathForSpice">,
): FramesApi {
  const resolvePath = (path: string) => stager.resolvePathForSpice(path);

  return {
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

    frame: (x) => {
      const xCopy = frameOperand(x, 3, "frame(x)");
      const result = native.frame(xCopy);
      return {
        x: frameVectorResult(result.x, "frame(x)"),
        y: frameVectorResult(result.y, "frame(y)"),
        z: frameVectorResult(result.z, "frame(z)"),
      };
    },
    twovec: (axdef, indexa, plndef, indexp) => {
      const axdefCopy = frameOperand(axdef, 3, "twovec(axdef)");
      assertSpiceInt32(indexa, "twovec(indexa)");
      const plndefCopy = frameOperand(plndef, 3, "twovec(plndef)");
      assertSpiceInt32(indexp, "twovec(indexp)");
      const result = native.twovec(axdefCopy, indexa, plndefCopy, indexp);
      return brandMat3RowMajorResult(result, { label: "twovec(rotation)" });
    },
    twovxf: (axdef, indexa, plndef, indexp) => {
      const axdefCopy = frameOperand(axdef, 6, "twovxf(axdef)");
      assertSpiceInt32(indexa, "twovxf(indexa)");
      const plndefCopy = frameOperand(plndef, 6, "twovxf(plndef)");
      assertSpiceInt32(indexp, "twovxf(indexp)");
      const result = native.twovxf(axdefCopy, indexa, plndefCopy, indexp);
      return frameMatrixResult(result, "twovxf(xform)");
    },
    eul2xf: (eulang, axisa, axisb, axisc) => {
      const eulangCopy = frameOperand(eulang, 6, "eul2xf(eulang)");
      assertSpiceInt32(axisa, "eul2xf(axisa)");
      assertSpiceInt32(axisb, "eul2xf(axisb)");
      assertSpiceInt32(axisc, "eul2xf(axisc)");
      const result = native.eul2xf(eulangCopy, axisa, axisb, axisc);
      return frameMatrixResult(result, "eul2xf(xform)");
    },
    xf2eul: (xform, axisa, axisb, axisc) => {
      const xformCopy = frameOperand(xform, 36, "xf2eul(xform)");
      assertSpiceInt32(axisa, "xf2eul(axisa)");
      assertSpiceInt32(axisb, "xf2eul(axisb)");
      assertSpiceInt32(axisc, "xf2eul(axisc)");
      const result = native.xf2eul(xformCopy, axisa, axisb, axisc);
      const unique = result.unique;
      if (typeof unique !== "boolean")
        throw new TypeError("Invalid XF2EUL uniqueness flag");
      return {
        eulang: frameStateResult(result.eulang, "xf2eul(eulang)"),
        unique,
      };
    },
    xf2rav: (xform) => {
      const xformCopy = frameOperand(xform, 36, "xf2rav(xform)");
      const result = native.xf2rav(xformCopy);
      return {
        rot: brandMat3RowMajorResult(result.rot, { label: "xf2rav(rot)" }),
        av: frameVectorResult(result.av, "xf2rav(av)"),
      };
    },
    rav2xf: (rot, av) => {
      const rotCopy = frameOperand(rot, 9, "rav2xf(rot)");
      const avCopy = frameOperand(av, 3, "rav2xf(av)");
      const result = native.rav2xf(rotCopy, avCopy);
      return frameMatrixResult(result, "rav2xf(xform)");
    },
    invstm: (mat) => {
      const matCopy = frameOperand(mat, 36, "invstm(mat)");
      const result = native.invstm(matCopy);
      return frameMatrixResult(result, "invstm(invmat)");
    },
    xpose6: (m1) => {
      const m1Copy = frameOperand(m1, 36, "xpose6(m1)");
      const result = native.xpose6(m1Copy);
      return frameMatrixResult(result, "xpose6(mout)");
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
