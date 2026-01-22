import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  Found,
  KernelData,
  KernelKind,
  KernelSource,
  SpiceBackend,
  SpkposResult,
  SpkezrResult,
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
  invariant(typeof native.namfrm === "function", "Expected native addon to export namfrm(frameName)");
  invariant(typeof native.frmnam === "function", "Expected native addon to export frmnam(frameId)");
  invariant(typeof native.pxform === "function", "Expected native addon to export pxform(from, to, et)");
  invariant(typeof native.sxform === "function", "Expected native addon to export sxform(from, to, et)");
  invariant(
    typeof native.spkezr === "function",
    "Expected native addon to export spkezr(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.spkpos === "function",
    "Expected native addon to export spkpos(target, et, ref, abcorr, observer)",
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
    namfrm: (frameName) => {
      const out = native.namfrm(frameName);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.frameId === "number", "Expected namfrm().frameId to be a number");
      return { found: true, frameId: out.frameId };
    },
    frmnam: (frameId) => {
      const out = native.frmnam(frameId);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.frameName === "string", "Expected frmnam().frameName to be a string");
      return { found: true, frameName: out.frameName };
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
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackend & { __ktotalAll(): number }).__ktotalAll = () => native.__ktotalAll();

  return backend;
}
