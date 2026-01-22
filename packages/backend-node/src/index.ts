import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  KernelSource,
  SpiceBackend,
  SpkezrResult,
  SpiceMatrix3x3,
  SpiceStateVector,
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
  invariant(typeof native.str2et === "function", "Expected native addon to export str2et(time)");
  invariant(typeof native.et2utc === "function", "Expected native addon to export et2utc(et, format, prec)");
  invariant(typeof native.pxform === "function", "Expected native addon to export pxform(from, to, et)");
  invariant(
    typeof native.spkezr === "function",
    "Expected native addon to export spkezr(target, et, ref, abcorr, observer)",
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
    pxform: (from, to, et) => {
      const m = native.pxform(from, to, et);
      invariant(Array.isArray(m) && m.length === 9, "Expected pxform() to return a length-9 array");
      return m as SpiceMatrix3x3;
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
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackend & { __ktotalAll(): number }).__ktotalAll = () => native.__ktotalAll();

  return backend;
}
