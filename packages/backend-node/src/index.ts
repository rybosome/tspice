import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  Found,
  IluminResult,
  KernelData,
  KernelKind,
  KernelSource,
  SpiceBackend,
  SpkposResult,
  SpkezrResult,
  SubPointResult,
  SpiceMatrix3x3,
  SpiceMatrix6x6,
  SpiceStateVector,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "./native.js";

export function spiceVersion(): string {
  const version = getNativeAddon().spiceVersion();
  invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
  return version;
}

export function createNodeBackend(): SpiceBackend {
  const native = getNativeAddon();

  invariant(typeof native.furnsh === "function", "Expected native addon to export furnsh(path)");
  invariant(typeof native.unload === "function", "Expected native addon to export unload(path)");
  invariant(typeof native.kclear === "function", "Expected native addon to export kclear()");
  invariant(typeof native.ktotal === "function", "Expected native addon to export ktotal(kind?)");
  invariant(typeof native.kdata === "function", "Expected native addon to export kdata(which, kind?)");
  invariant(typeof native.str2et === "function", "Expected native addon to export str2et(time)");
  invariant(typeof native.et2utc === "function", "Expected native addon to export et2utc(et, format, prec)");
  invariant(typeof native.timout === "function", "Expected native addon to export timout(et, picture)");
  invariant(typeof native.bodn2c === "function", "Expected native addon to export bodn2c(name)");
  invariant(typeof native.bodc2n === "function", "Expected native addon to export bodc2n(code)");
  invariant(typeof native.namfrm === "function", "Expected native addon to export namfrm(name)");
  invariant(typeof native.frmnam === "function", "Expected native addon to export frmnam(code)");
  invariant(typeof native.cidfrm === "function", "Expected native addon to export cidfrm(center)");
  invariant(typeof native.cnmfrm === "function", "Expected native addon to export cnmfrm(centerName)");
  invariant(typeof native.scs2e === "function", "Expected native addon to export scs2e(sc, sclkch)");
  invariant(typeof native.sce2s === "function", "Expected native addon to export sce2s(sc, et)");
  invariant(typeof native.ckgp === "function", "Expected native addon to export ckgp(inst, sclkdp, tol, ref)");
  invariant(typeof native.ckgpav === "function", "Expected native addon to export ckgpav(inst, sclkdp, tol, ref)");
  invariant(typeof native.pxform === "function", "Expected native addon to export pxform(from, to, et)");
  invariant(typeof native.sxform === "function", "Expected native addon to export sxform(from, to, et)");
  invariant(typeof native.reclat === "function", "Expected native addon to export reclat(rect)");
  invariant(typeof native.latrec === "function", "Expected native addon to export latrec(radius, lon, lat)");
  invariant(typeof native.recsph === "function", "Expected native addon to export recsph(rect)");
  invariant(typeof native.sphrec === "function", "Expected native addon to export sphrec(radius, colat, lon)");
  invariant(typeof native.vnorm === "function", "Expected native addon to export vnorm(v)");
  invariant(typeof native.vhat === "function", "Expected native addon to export vhat(v)");
  invariant(typeof native.vdot === "function", "Expected native addon to export vdot(a, b)");
  invariant(typeof native.vcrss === "function", "Expected native addon to export vcrss(a, b)");
  invariant(typeof native.mxv === "function", "Expected native addon to export mxv(m, v)");
  invariant(typeof native.mtxv === "function", "Expected native addon to export mtxv(m, v)");
  invariant(
    typeof native.spkezr === "function",
    "Expected native addon to export spkezr(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.spkpos === "function",
    "Expected native addon to export spkpos(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.subpnt === "function",
    "Expected native addon to export subpnt(method, target, et, fixref, abcorr, observer)",
  );
  invariant(
    typeof native.subslr === "function",
    "Expected native addon to export subslr(method, target, et, fixref, abcorr, observer)",
  );
  invariant(
    typeof native.sincpt === "function",
    "Expected native addon to export sincpt(method, target, et, fixref, abcorr, observer, dref, dvec)",
  );
  invariant(
    typeof native.ilumin === "function",
    "Expected native addon to export ilumin(method, target, et, fixref, abcorr, observer, spoint)",
  );
  invariant(
    typeof native.occult === "function",
    "Expected native addon to export occult(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et)",
  );

  const tempByVirtualPath = new Map<string, string>();
  let tempKernelRootDir: string | undefined;

  function ensureTempKernelRootDir(): string {
    if (tempKernelRootDir) {
      return tempKernelRootDir;
    }
    tempKernelRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-kernels-"));
    return tempKernelRootDir;
  }

  function safeUnlink(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // Best-effort cleanup.
      if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const backend: SpiceBackend = {
    kind: "node",
    spiceVersion,
    furnsh: (_kernel: KernelSource) => {
      const kernel = _kernel;
      if (typeof kernel === "string") {
        native.furnsh(kernel);
        return;
      }

      // For byte-backed kernels, we write to a temp file and load via CSPICE.
      // We then remember the resolved temp path so `unload(kernel.path)` unloads
      // the correct file.
      const existingTemp = tempByVirtualPath.get(kernel.path);
      if (existingTemp) {
        native.unload(existingTemp);
        tempByVirtualPath.delete(kernel.path);
        safeUnlink(existingTemp);
      }

      const rootDir = ensureTempKernelRootDir();
      const fileName = path.basename(kernel.path) || "kernel";
      const tempPath = path.join(rootDir, `${randomUUID()}-${fileName}`);
      fs.writeFileSync(tempPath, kernel.bytes);

      try {
        native.furnsh(tempPath);
      } catch (error) {
        safeUnlink(tempPath);
        throw error;
      }

      tempByVirtualPath.set(kernel.path, tempPath);
    },
    unload: (_path: string) => {
      const resolved = tempByVirtualPath.get(_path);
      if (resolved) {
        native.unload(resolved);
        tempByVirtualPath.delete(_path);
        safeUnlink(resolved);
        return;
      }

      native.unload(_path);
    },

    kclear: () => {
      native.kclear();

      // Clear any byte-backed kernels we staged to temp files.
      for (const tempPath of tempByVirtualPath.values()) {
        safeUnlink(tempPath);
      }
      tempByVirtualPath.clear();
    },

    ktotal: (kind: KernelKind = "ALL") => {
      const total = native.ktotal(kind);
      invariant(typeof total === "number", "Expected native backend ktotal() to return a number");
      return total;
    },

    kdata: (which: number, kind: KernelKind = "ALL") => {
      const result = native.kdata(which, kind);
      if (!result.found) {
        return { found: false };
      }

      invariant(typeof result.file === "string", "Expected kdata().file to be a string");
      invariant(typeof result.filtyp === "string", "Expected kdata().filtyp to be a string");
      invariant(typeof result.source === "string", "Expected kdata().source to be a string");
      invariant(typeof result.handle === "number", "Expected kdata().handle to be a number");

      return {
        found: true,
        file: result.file,
        filtyp: result.filtyp,
        source: result.source,
        handle: result.handle,
      } satisfies Found<KernelData>;
    },
    tkvrsn: (item) => {
      invariant(item === "TOOLKIT", `Unsupported tkvrsn item: ${item}`);
      return spiceVersion();
    },

    str2et: (time) => {
      return native.str2et(time);
    },
    et2utc: (et, format, prec) => {
      return native.et2utc(et, format, prec);
    },
    timout: (et, picture) => {
      return native.timout(et, picture);
    },

    bodn2c: (name) => {
      const out = native.bodn2c(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.code === "number", "Expected bodn2c().code to be a number");
      return { found: true, code: out.code };
    },
    bodc2n: (code) => {
      const out = native.bodc2n(code);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.name === "string", "Expected bodc2n().name to be a string");
      return { found: true, name: out.name };
    },
    namfrm: (name) => {
      const out = native.namfrm(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.code === "number", "Expected namfrm().code to be a number");
      return { found: true, code: out.code };
    },
    frmnam: (code) => {
      const out = native.frmnam(code);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.name === "string", "Expected frmnam().name to be a string");
      return { found: true, name: out.name };
    },

    cidfrm: (center) => {
      const out = native.cidfrm(center);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.frcode === "number", "Expected cidfrm().frcode to be a number");
      invariant(typeof out.frname === "string", "Expected cidfrm().frname to be a string");
      return { found: true, frcode: out.frcode, frname: out.frname };
    },

    cnmfrm: (centerName) => {
      const out = native.cnmfrm(centerName);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.frcode === "number", "Expected cnmfrm().frcode to be a number");
      invariant(typeof out.frname === "string", "Expected cnmfrm().frname to be a string");
      return { found: true, frcode: out.frcode, frname: out.frname };
    },

    scs2e: (sc, sclkch) => {
      const et = native.scs2e(sc, sclkch);
      invariant(typeof et === "number", "Expected scs2e() to return a number");
      return et;
    },

    sce2s: (sc, et) => {
      const out = native.sce2s(sc, et);
      invariant(typeof out === "string", "Expected sce2s() to return a string");
      return out;
    },

    ckgp: (inst, sclkdp, tol, ref) => {
      const out = native.ckgp(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      invariant(Array.isArray(out.cmat) && out.cmat.length === 9, "Expected ckgp().cmat to be a length-9 array");
      invariant(typeof out.clkout === "number", "Expected ckgp().clkout to be a number");
      return { found: true, cmat: out.cmat as SpiceMatrix3x3, clkout: out.clkout };
    },

    ckgpav: (inst, sclkdp, tol, ref) => {
      const out = native.ckgpav(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        Array.isArray(out.cmat) && out.cmat.length === 9,
        "Expected ckgpav().cmat to be a length-9 array",
      );
      invariant(Array.isArray(out.av) && out.av.length === 3, "Expected ckgpav().av to be a length-3 array");
      invariant(typeof out.clkout === "number", "Expected ckgpav().clkout to be a number");
      return {
        found: true,
        cmat: out.cmat as SpiceMatrix3x3,
        av: out.av as SpiceVector3,
        clkout: out.clkout,
      };
    },

    pxform: (from, to, et) => {
      const m = native.pxform(from, to, et);
      invariant(Array.isArray(m) && m.length === 9, "Expected pxform() to return a length-9 array");
      return m as SpiceMatrix3x3;
    },
    sxform: (from, to, et) => {
      const m = native.sxform(from, to, et);
      invariant(Array.isArray(m) && m.length === 36, "Expected sxform() to return a length-36 array");
      return m as SpiceMatrix6x6;
    },
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

    reclat: (rect) => {
      const out = native.reclat(rect);
      invariant(out && typeof out === "object", "Expected reclat() to return an object");
      invariant(typeof out.radius === "number", "Expected reclat().radius to be a number");
      invariant(typeof out.lon === "number", "Expected reclat().lon to be a number");
      invariant(typeof out.lat === "number", "Expected reclat().lat to be a number");
      return { radius: out.radius, lon: out.lon, lat: out.lat };
    },

    latrec: (radius, lon, lat) => {
      const out = native.latrec(radius, lon, lat);
      invariant(Array.isArray(out) && out.length === 3, "Expected latrec() to return a length-3 array");
      return out as SpiceVector3;
    },

    recsph: (rect) => {
      const out = native.recsph(rect);
      invariant(out && typeof out === "object", "Expected recsph() to return an object");
      invariant(typeof out.radius === "number", "Expected recsph().radius to be a number");
      invariant(typeof out.colat === "number", "Expected recsph().colat to be a number");
      invariant(typeof out.lon === "number", "Expected recsph().lon to be a number");
      return { radius: out.radius, colat: out.colat, lon: out.lon };
    },

    sphrec: (radius, colat, lon) => {
      const out = native.sphrec(radius, colat, lon);
      invariant(Array.isArray(out) && out.length === 3, "Expected sphrec() to return a length-3 array");
      return out as SpiceVector3;
    },

    vnorm: (v) => {
      const out = native.vnorm(v);
      invariant(typeof out === "number", "Expected vnorm() to return a number");
      return out;
    },

    vhat: (v) => {
      const out = native.vhat(v);
      invariant(Array.isArray(out) && out.length === 3, "Expected vhat() to return a length-3 array");
      return out as SpiceVector3;
    },

    vdot: (a, b) => {
      const out = native.vdot(a, b);
      invariant(typeof out === "number", "Expected vdot() to return a number");
      return out;
    },

    vcrss: (a, b) => {
      const out = native.vcrss(a, b);
      invariant(Array.isArray(out) && out.length === 3, "Expected vcrss() to return a length-3 array");
      return out as SpiceVector3;
    },

    mxv: (m, v) => {
      const out = native.mxv(m, v);
      invariant(Array.isArray(out) && out.length === 3, "Expected mxv() to return a length-3 array");
      return out as SpiceVector3;
    },

    mtxv: (m, v) => {
      const out = native.mtxv(m, v);
      invariant(Array.isArray(out) && out.length === 3, "Expected mtxv() to return a length-3 array");
      return out as SpiceVector3;
    },

    subpnt: (method, target, et, fixref, abcorr, observer) => {
      const out = native.subpnt(method, target, et, fixref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected subpnt() to return an object");
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected subpnt().spoint to be a length-3 array",
      );
      invariant(typeof out.trgepc === "number", "Expected subpnt().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected subpnt().srfvec to be a length-3 array",
      );
      return {
        spoint: out.spoint as SpiceVector3,
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
      } satisfies SubPointResult;
    },

    subslr: (method, target, et, fixref, abcorr, observer) => {
      const out = native.subslr(method, target, et, fixref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected subslr() to return an object");
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected subslr().spoint to be a length-3 array",
      );
      invariant(typeof out.trgepc === "number", "Expected subslr().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected subslr().srfvec to be a length-3 array",
      );
      return {
        spoint: out.spoint as SpiceVector3,
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
      } satisfies SubPointResult;
    },

    sincpt: (method, target, et, fixref, abcorr, observer, dref, dvec) => {
      const out = native.sincpt(method, target, et, fixref, abcorr, observer, dref, dvec);
      if (!out.found) {
        return { found: false };
      }

      invariant(out && typeof out === "object", "Expected sincpt() to return an object");
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected sincpt().spoint to be a length-3 array",
      );
      invariant(typeof out.trgepc === "number", "Expected sincpt().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected sincpt().srfvec to be a length-3 array",
      );
      return {
        found: true,
        spoint: out.spoint as SpiceVector3,
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
      } satisfies Found<SubPointResult>;
    },

    ilumin: (method, target, et, fixref, abcorr, observer, spoint) => {
      const out = native.ilumin(method, target, et, fixref, abcorr, observer, spoint);
      invariant(out && typeof out === "object", "Expected ilumin() to return an object");
      invariant(typeof out.trgepc === "number", "Expected ilumin().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected ilumin().srfvec to be a length-3 array",
      );
      invariant(
        typeof out.observerIlluminatorAngle === "number",
        "Expected ilumin().observerIlluminatorAngle to be a number",
      );
      invariant(typeof out.incdnc === "number", "Expected ilumin().incdnc to be a number");
      invariant(typeof out.emissn === "number", "Expected ilumin().emissn to be a number");
      return {
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
        observerIlluminatorAngle: out.observerIlluminatorAngle,
        incdnc: out.incdnc,
        emissn: out.emissn,
      } satisfies IluminResult;
    },

    occult: (targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et) => {
      const out = native.occult(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et);
      invariant(typeof out === "number", "Expected occult() to return a number");
      return out;
    },
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackend & { __ktotalAll(): number }).__ktotalAll = () => native.__ktotalAll();

  return backend;
}
