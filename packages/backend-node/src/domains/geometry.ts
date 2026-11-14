import { spiceStringByteLength } from "@rybosome/tspice-core";
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
    phaseq: (et, target, illmn, observer, abcorr) => {
      geometryNumber(et, "phaseq(et)");
      spiceStringByteLength(target, "phaseq(target)");
      spiceStringByteLength(illmn, "phaseq(illmn)");
      spiceStringByteLength(observer, "phaseq(observer)");
      spiceStringByteLength(abcorr, "phaseq(abcorr)");
      const result = native.phaseq(et, target, illmn, observer, abcorr);
      invariant(typeof result === "number", "Expected a numeric phaseq result");
      return result;
    },
    lspcn: (body, et, abcorr) => {
      geometryNumber(et, "lspcn(et)");
      spiceStringByteLength(body, "lspcn(body)");
      spiceStringByteLength(abcorr, "lspcn(abcorr)");
      const result = native.lspcn(body, et, abcorr);
      invariant(typeof result === "number", "Expected a numeric lspcn result");
      return result;
    },
    trgsep: (
      et,
      targ1,
      shape1,
      frame1,
      targ2,
      shape2,
      frame2,
      observer,
      abcorr,
    ) => {
      geometryNumber(et, "trgsep(et)");
      spiceStringByteLength(targ1, "trgsep(targ1)");
      spiceStringByteLength(shape1, "trgsep(shape1)");
      spiceStringByteLength(frame1, "trgsep(frame1)");
      spiceStringByteLength(targ2, "trgsep(targ2)");
      spiceStringByteLength(shape2, "trgsep(shape2)");
      spiceStringByteLength(frame2, "trgsep(frame2)");
      spiceStringByteLength(observer, "trgsep(observer)");
      spiceStringByteLength(abcorr, "trgsep(abcorr)");
      const result = native.trgsep(
        et,
        targ1,
        shape1,
        frame1,
        targ2,
        shape2,
        frame2,
        observer,
        abcorr,
      );
      invariant(typeof result === "number", "Expected a numeric trgsep result");
      return result;
    },
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
