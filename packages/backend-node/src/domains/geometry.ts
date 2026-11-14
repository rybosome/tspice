import type {
  Found,
  GeometryApi,
  IllumfResult,
  IllumgResult,
  IluminResult,
  Pl2nvcResult,
  SpicePlane,
  SpiceVector3,
  SubPointResult,
} from "@rybosome/tspice-backend-contract";
import {
  copyPlaneComponents,
  copyPlaneVector,
  planeComponent,
  planeIntersectionCount,
} from "@rybosome/tspice-core";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function assertFiniteNumberArrayFixed(
  value: unknown,
  expectedLength: number,
  label: string,
): asserts value is number[] {
  invariant(
    Array.isArray(value) && value.length === expectedLength,
    `Expected ${label} to be a length-${expectedLength} array`,
  );
  for (let i = 0; i < expectedLength; i++) {
    const v = value[i];
    invariant(
      typeof v === "number" && Number.isFinite(v),
      `Expected ${label}[${i}] to be a finite number`,
    );
  }
}

function geometryNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${label} must be finite`);
  return value;
}
function readGeometryVector(value: unknown, label: string): SpiceVector3 {
  assertFiniteNumberArrayFixed(value, 3, label);
  return [
    geometryNumber(value[0], label),
    geometryNumber(value[1], label),
    geometryNumber(value[2], label),
  ];
}
function readGeometryPlane(value: unknown, label: string): SpicePlane {
  assertFiniteNumberArrayFixed(value, 4, label);
  return [
    geometryNumber(value[0], label),
    geometryNumber(value[1], label),
    geometryNumber(value[2], label),
    geometryNumber(value[3], label),
  ];
}
function geometryInputs(
  et: unknown,
  strings: readonly unknown[],
  label: string,
): void {
  if (typeof et !== "number" || !Number.isFinite(et))
    throw new RangeError(`${label}: ET must be finite`);
  for (const value of strings)
    if (typeof value !== "string")
      throw new TypeError(`${label}: inputs must be strings`);
}

/** Create a {@link GeometryApi} implementation backed by the native Node addon. */
export function createGeometryApi(native: NativeAddon): GeometryApi {
  return {
    subpnt: (method, target, et, fixref, abcorr, observer) => {
      geometryInputs(et, [method, target, fixref, abcorr, observer], "subpnt");
      const out = native.subpnt(method, target, et, fixref, abcorr, observer);
      invariant(
        out && typeof out === "object",
        "Expected subpnt() to return an object",
      );
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected subpnt().spoint to be a length-3 array",
      );
      invariant(
        typeof out.trgepc === "number",
        "Expected subpnt().trgepc to be a number",
      );
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected subpnt().srfvec to be a length-3 array",
      );
      return {
        spoint: readGeometryVector(out.spoint, "spoint"),
        trgepc: geometryNumber(out.trgepc, "trgepc"),
        srfvec: readGeometryVector(out.srfvec, "srfvec"),
      } satisfies SubPointResult;
    },

    subslr: (method, target, et, fixref, abcorr, observer) => {
      geometryInputs(et, [method, target, fixref, abcorr, observer], "subslr");
      const out = native.subslr(method, target, et, fixref, abcorr, observer);
      invariant(
        out && typeof out === "object",
        "Expected subslr() to return an object",
      );
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected subslr().spoint to be a length-3 array",
      );
      invariant(
        typeof out.trgepc === "number",
        "Expected subslr().trgepc to be a number",
      );
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected subslr().srfvec to be a length-3 array",
      );
      return {
        spoint: readGeometryVector(out.spoint, "spoint"),
        trgepc: geometryNumber(out.trgepc, "trgepc"),
        srfvec: readGeometryVector(out.srfvec, "srfvec"),
      } satisfies SubPointResult;
    },

    sincpt: (method, target, et, fixref, abcorr, observer, dref, dvec) => {
      geometryInputs(
        et,
        [method, target, fixref, abcorr, observer, dref],
        "sincpt",
      );
      assertFiniteNumberArrayFixed(dvec, 3, "sincpt(dvec)");
      const out = native.sincpt(
        method,
        target,
        et,
        fixref,
        abcorr,
        observer,
        dref,
        dvec,
      );
      if (!out.found) {
        return { found: false };
      }

      invariant(
        out && typeof out === "object",
        "Expected sincpt() to return an object",
      );
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected sincpt().spoint to be a length-3 array",
      );
      invariant(
        typeof out.trgepc === "number",
        "Expected sincpt().trgepc to be a number",
      );
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected sincpt().srfvec to be a length-3 array",
      );
      return {
        found: true,
        spoint: readGeometryVector(out.spoint, "spoint"),
        trgepc: geometryNumber(out.trgepc, "trgepc"),
        srfvec: readGeometryVector(out.srfvec, "srfvec"),
      } satisfies Found<SubPointResult>;
    },

    ilumin: (method, target, et, fixref, abcorr, observer, spoint) => {
      geometryInputs(et, [method, target, fixref, abcorr, observer], "ilumin");
      assertFiniteNumberArrayFixed(spoint, 3, "ilumin(spoint)");
      const out = native.ilumin(
        method,
        target,
        et,
        fixref,
        abcorr,
        observer,
        spoint,
      );
      invariant(
        out && typeof out === "object",
        "Expected ilumin() to return an object",
      );
      invariant(
        typeof out.trgepc === "number",
        "Expected ilumin().trgepc to be a number",
      );
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected ilumin().srfvec to be a length-3 array",
      );
      invariant(
        typeof out.phase === "number",
        "Expected ilumin().phase to be a number",
      );
      invariant(
        typeof out.incdnc === "number",
        "Expected ilumin().incdnc to be a number",
      );
      invariant(
        typeof out.emissn === "number",
        "Expected ilumin().emissn to be a number",
      );
      return {
        trgepc: geometryNumber(out.trgepc, "trgepc"),
        srfvec: readGeometryVector(out.srfvec, "srfvec"),
        phase: geometryNumber(out.phase, "phase"),
        incdnc: geometryNumber(out.incdnc, "incdnc"),
        emissn: geometryNumber(out.emissn, "emissn"),
      } satisfies IluminResult;
    },

    illumg: (method, target, ilusrc, et, fixref, abcorr, observer, spoint) => {
      geometryInputs(
        et,
        [method, target, ilusrc, fixref, abcorr, observer],
        "illumg",
      );
      assertFiniteNumberArrayFixed(spoint, 3, "illumg(spoint)");
      const out = native.illumg(
        method,
        target,
        ilusrc,
        et,
        fixref,
        abcorr,
        observer,
        spoint,
      );
      invariant(
        out && typeof out === "object",
        "Expected illumg() to return an object",
      );
      invariant(
        typeof out.trgepc === "number",
        "Expected illumg().trgepc to be a number",
      );
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected illumg().srfvec to be a length-3 array",
      );
      invariant(
        typeof out.phase === "number",
        "Expected illumg().phase to be a number",
      );
      invariant(
        typeof out.incdnc === "number",
        "Expected illumg().incdnc to be a number",
      );
      invariant(
        typeof out.emissn === "number",
        "Expected illumg().emissn to be a number",
      );

      return {
        trgepc: geometryNumber(out.trgepc, "trgepc"),
        srfvec: readGeometryVector(out.srfvec, "srfvec"),
        phase: geometryNumber(out.phase, "phase"),
        incdnc: geometryNumber(out.incdnc, "incdnc"),
        emissn: geometryNumber(out.emissn, "emissn"),
      } satisfies IllumgResult;
    },

    illumf: (method, target, ilusrc, et, fixref, abcorr, observer, spoint) => {
      geometryInputs(
        et,
        [method, target, ilusrc, fixref, abcorr, observer],
        "illumf",
      );
      assertFiniteNumberArrayFixed(spoint, 3, "illumf(spoint)");
      const out = native.illumf(
        method,
        target,
        ilusrc,
        et,
        fixref,
        abcorr,
        observer,
        spoint,
      );
      invariant(
        out && typeof out === "object",
        "Expected illumf() to return an object",
      );
      invariant(
        typeof out.trgepc === "number",
        "Expected illumf().trgepc to be a number",
      );
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected illumf().srfvec to be a length-3 array",
      );
      invariant(
        typeof out.phase === "number",
        "Expected illumf().phase to be a number",
      );
      invariant(
        typeof out.incdnc === "number",
        "Expected illumf().incdnc to be a number",
      );
      invariant(
        typeof out.emissn === "number",
        "Expected illumf().emissn to be a number",
      );
      invariant(
        typeof out.visibl === "boolean",
        "Expected illumf().visibl to be a boolean",
      );
      invariant(
        typeof out.lit === "boolean",
        "Expected illumf().lit to be a boolean",
      );

      return {
        trgepc: geometryNumber(out.trgepc, "trgepc"),
        srfvec: readGeometryVector(out.srfvec, "srfvec"),
        phase: geometryNumber(out.phase, "phase"),
        incdnc: geometryNumber(out.incdnc, "incdnc"),
        emissn: geometryNumber(out.emissn, "emissn"),
        visibl: out.visibl,
        lit: out.lit,
      } satisfies IllumfResult;
    },

    occult: (
      targ1,
      shape1,
      frame1,
      targ2,
      shape2,
      frame2,
      abcorr,
      observer,
      et,
    ) => {
      geometryInputs(
        et,
        [targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer],
        "occult",
      );
      const out = native.occult(
        targ1,
        shape1,
        frame1,
        targ2,
        shape2,
        frame2,
        abcorr,
        observer,
        et,
      );
      invariant(
        typeof out === "number",
        "Expected occult() to return a number",
      );
      return out;
    },

    nvp2pl: (normal, point) => {
      const out = native.nvp2pl(
        copyPlaneVector(normal, "nvp2pl(normal)", true),
        copyPlaneVector(point, "nvp2pl(point)", true),
      );
      return copyPlaneComponents(out, "nvp2pl result", false);
    },
    pl2nvp: (plane) => {
      const out = native.pl2nvp(
        copyPlaneComponents(plane, "pl2nvp(plane)", true),
      );
      return {
        normal: copyPlaneVector(out.normal, "pl2nvp result", false),
        point: copyPlaneVector(out.point, "pl2nvp result", false),
      };
    },
    pl2psv: (plane) => {
      const out = native.pl2psv(
        copyPlaneComponents(plane, "pl2psv(plane)", true),
      );
      return {
        point: copyPlaneVector(out.point, "pl2psv result", false),
        span1: copyPlaneVector(out.span1, "pl2psv result", false),
        span2: copyPlaneVector(out.span2, "pl2psv result", false),
      };
    },
    psv2pl: (point, span1, span2) => {
      const out = native.psv2pl(
        copyPlaneVector(point, "psv2pl(point)", true),
        copyPlaneVector(span1, "psv2pl(span1)", true),
        copyPlaneVector(span2, "psv2pl(span2)", true),
      );
      return copyPlaneComponents(out, "psv2pl result", false);
    },
    inrypl: (vertex, dir, plane) => {
      const out = native.inrypl(
        copyPlaneVector(vertex, "inrypl(vertex)", true),
        copyPlaneVector(dir, "inrypl(dir)", true),
        copyPlaneComponents(plane, "inrypl(plane)", true),
      );
      return {
        nxpts: planeIntersectionCount(out.nxpts),
        xpt: copyPlaneVector(out.xpt, "inrypl result", false),
      };
    },
    vprjp: (vin, plane) => {
      const out = native.vprjp(
        copyPlaneVector(vin, "vprjp(vin)", true),
        copyPlaneComponents(plane, "vprjp(plane)", true),
      );
      return copyPlaneVector(out, "vprjp result", false);
    },
    vprjpi: (vin, projpl, invpl) => {
      const out = native.vprjpi(
        copyPlaneVector(vin, "vprjpi(vin)", true),
        copyPlaneComponents(projpl, "vprjpi(projpl)", true),
        copyPlaneComponents(invpl, "vprjpi(invpl)", true),
      );
      if (out.found === false) return { found: false };
      if (out.found !== true)
        throw new TypeError("Invalid VPRJPI found result");
      return {
        vout: copyPlaneVector(out.vout, "vprjpi result", false),
        found: true,
      };
    },
    nplnpt: (linpt, lindir, point) => {
      const out = native.nplnpt(
        copyPlaneVector(linpt, "nplnpt(linpt)", true),
        copyPlaneVector(lindir, "nplnpt(lindir)", true),
        copyPlaneVector(point, "nplnpt(point)", true),
      );
      return {
        pnear: copyPlaneVector(out.pnear, "nplnpt result", false),
        dist: planeComponent(out.dist, "nplnpt(dist)", false),
      };
    },
    nvc2pl: (normal, konst) => {
      assertFiniteNumberArrayFixed(normal, 3, "nvc2pl(): normal");
      invariant(
        typeof konst === "number" && Number.isFinite(konst),
        "Expected nvc2pl(): konst to be a finite number",
      );

      const out = native.nvc2pl(normal, konst);
      assertFiniteNumberArrayFixed(out, 4, "nvc2pl(): result");
      return readGeometryPlane(out, "nvc2pl(result)");
    },

    pl2nvc: (plane) => {
      assertFiniteNumberArrayFixed(plane, 4, "pl2nvc(): plane");

      const out = native.pl2nvc(plane);
      invariant(
        out && typeof out === "object",
        "Expected pl2nvc() to return an object",
      );
      assertFiniteNumberArrayFixed(out.normal, 3, "pl2nvc(): normal");
      invariant(
        typeof out.konst === "number" && Number.isFinite(out.konst),
        "Expected pl2nvc().konst to be a finite number",
      );
      return {
        normal: readGeometryVector(out.normal, "normal"),
        konst: out.konst,
      } satisfies Pl2nvcResult;
    },
  };
}
