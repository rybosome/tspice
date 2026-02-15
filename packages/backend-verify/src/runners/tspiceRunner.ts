import * as path from "node:path";
import crypto from "node:crypto";
import { readFile, realpath } from "node:fs/promises";

import { spiceClients, type SpiceBackend } from "@rybosome/tspice";

import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForNativeNoKernels,
  sanitizeMetaKernelTextForWasm,
} from "../kernels/metaKernel.js";

import { spiceShortSymbol } from "../errors/spiceShort.js";

import type { CaseRunner, KernelEntry, RunCaseInput, RunCaseResult, RunnerErrorReport, SpiceErrorState } from "./types.js";

type DispatchFn = (backend: SpiceBackend, args: unknown[]) => unknown;

type RunnerValidationCode = "invalid_request" | "invalid_args" | "unsupported_call";

function isRunnerValidationCode(value: unknown): value is RunnerValidationCode {
  return value === "invalid_request" || value === "invalid_args" || value === "unsupported_call";
}

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    return String(value);
  }

  try {
    const s = JSON.stringify(value);
    return s === undefined ? String(value) : s;
  } catch {
    return String(value);
  }
}

function invalidRequest(message: string): never {
  const err = new TypeError(message) as TypeError & { code?: RunnerValidationCode };
  err.code = "invalid_request";
  throw err;
}

function invalidArgs(message: string): never {
  const err = new TypeError(message) as TypeError & { code?: RunnerValidationCode };
  err.code = "invalid_args";
  throw err;
}

function unsupportedCall(message: string): never {
  const err = new Error(message) as Error & { code?: RunnerValidationCode };
  err.code = "unsupported_call";
  throw err;
}

/** Assert that a value is a finite integer (used for runner argument validation). */
function assertInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number") {
    invalidArgs(`${label} expects a number (got ${formatValue(value)})`);
  }
  if (!Number.isFinite(value)) {
    invalidArgs(`${label} expects a finite integer (got ${formatValue(value)})`);
  }
  if (!Number.isInteger(value)) {
    invalidArgs(`${label} expects an integer (got ${formatValue(value)})`);
  }
}


type Vec3 = [number, number, number];
type Mat3RowMajor = Parameters<SpiceBackend["mxm"]>[0];

function assertVec3(value: unknown, label: string): asserts value is Vec3 {
  if (!Array.isArray(value)) {
    invalidArgs(`${label} expects a length-3 array of numbers (got ${formatValue(value)})`);
  }
  if (value.length !== 3) {
    invalidArgs(`${label} expects a length-3 array of numbers (got length ${value.length})`);
  }
  for (let i = 0; i < 3; i++) {
    if (typeof value[i] !== "number") {
      invalidArgs(
        `${label} expects element ${i} to be a number (got ${formatValue(value[i])})`,
      );
    }
  }
}

function assertMat3RowMajor(value: unknown, label: string): asserts value is Mat3RowMajor {
  if (!Array.isArray(value)) {
    invalidArgs(`${label} expects a length-9 array of numbers (got ${formatValue(value)})`);
  }
  if (value.length !== 9) {
    invalidArgs(`${label} expects a length-9 array of numbers (got length ${value.length})`);
  }
  for (let i = 0; i < 9; i++) {
    if (typeof value[i] !== "number") {
      invalidArgs(
        `${label} expects element ${i} to be a number (got ${formatValue(value[i])})`,
      );
    }
  }
}

const DISPATCH: Record<string, DispatchFn> = {
  // time
  "time.str2et": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.str2et expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.str2et(args[0]);
  },

  // Convenience alias.
  str2et: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`str2et expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.str2et(args[0]);
  },

  "time.et2utc": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.et2utc expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.et2utc expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`time.et2utc expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[2], "time.et2utc args[2]");
    return backend.et2utc(args[0], args[1], args[2]);
  },

  // Convenience alias.
  et2utc: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`et2utc expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`et2utc expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`et2utc expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[2], "et2utc args[2]");
    return backend.et2utc(args[0], args[1], args[2]);
  },

  // ids-names
  "ids-names.bodn2c": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`ids-names.bodn2c expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.bodn2c(args[0]);
  },

  bodn2c: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`bodn2c expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.bodn2c(args[0]);
  },

  "ids-names.bodc2n": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`ids-names.bodc2n expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "ids-names.bodc2n args[0]");
    return backend.bodc2n(args[0]);
  },

  bodc2n: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`bodc2n expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "bodc2n args[0]");
    return backend.bodc2n(args[0]);
  },

  // frames
  /** Dispatch wrapper for `frames.namfrm`. */
  "frames.namfrm": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`frames.namfrm expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.namfrm(args[0]);
  },

  namfrm: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`namfrm expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.namfrm(args[0]);
  },

  "frames.frmnam": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frames.frmnam expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "frames.frmnam args[0]");
    return backend.frmnam(args[0]);
  },

  frmnam: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frmnam expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "frmnam args[0]");
    return backend.frmnam(args[0]);
  },

  "frames.pxform": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`frames.pxform expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`frames.pxform expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`frames.pxform expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.pxform(args[0], args[1], args[2]);
  },

  pxform: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`pxform expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`pxform expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`pxform expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.pxform(args[0], args[1], args[2]);
  },

  // time (misc)
  "time.spiceVersion": (backend) => {
    return backend.spiceVersion();
  },

  "time.tkvrsn": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.tkvrsn expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (args[0] !== "TOOLKIT") {
      invalidArgs(`time.tkvrsn expects args[0] to be "TOOLKIT" (got ${formatValue(args[0])})`);
    }
    return backend.tkvrsn("TOOLKIT");
  },

  "time.timout": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.timout expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.timout expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    return backend.timout(args[0], args[1]);
  },

  "time.deltet": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.deltet expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.deltet expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (args[1] !== "ET" && args[1] !== "UTC") {
      invalidArgs(`time.deltet expects args[1] to be "ET" or "UTC" (got ${formatValue(args[1])})`);
    }
    return backend.deltet(args[0], args[1]);
  },

  "time.unitim": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.unitim expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.unitim expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "string") {
      invalidArgs(`time.unitim expects args[2] to be a string (got ${formatValue(args[2])})`);
    }

    if (args[1] !== "TAI" && args[1] !== "UTC" && args[1] !== "TDB" && args[1] !== "TDT" && args[1] !== "ET") {
      invalidArgs(`time.unitim expects args[1] to be a valid time system (got ${formatValue(args[1])})`);
    }
    if (args[2] !== "TAI" && args[2] !== "UTC" && args[2] !== "TDB" && args[2] !== "TDT" && args[2] !== "ET") {
      invalidArgs(`time.unitim expects args[2] to be a valid time system (got ${formatValue(args[2])})`);
    }

    return backend.unitim(args[0], args[1], args[2]);
  },

  "time.tparse": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.tparse expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.tparse(args[0]);
  },

  "time.tpictr": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.tpictr expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.tpictr expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    return backend.tpictr(args[0], args[1]);
  },

  "time.timdef": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.timdef expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.timdef expects args[1] to be a string (got ${formatValue(args[1])})`);
    }

    if (args[0] === "GET") {
      return backend.timdef("GET", args[1]);
    }

    if (args[0] === "SET") {
      if (typeof args[2] !== "string") {
        invalidArgs(`time.timdef expects args[2] to be a string for SET (got ${formatValue(args[2])})`);
      }
      backend.timdef("SET", args[1], args[2]);
      // `timdef(SET)` returns void; represent it as JSON-friendly null.
      return null;
    }

    invalidArgs(`time.timdef expects args[0] to be "GET" or "SET" (got ${formatValue(args[0])})`);
  },

  // coords-vectors
  "coords-vectors.axisar": (backend, args) => {
    assertVec3(args[0], "coords-vectors.axisar args[0]");
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.axisar expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    return backend.axisar(args[0], args[1]);
  },

  "coords-vectors.georec": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    if (typeof args[3] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[3] to be a number (got ${formatValue(args[3])})`);
    }
    if (typeof args[4] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[4] to be a number (got ${formatValue(args[4])})`);
    }
    return backend.georec(args[0], args[1], args[2], args[3], args[4]);
  },

  "coords-vectors.latrec": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.latrec expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.latrec expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.latrec expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.latrec(args[0], args[1], args[2]);
  },

  "coords-vectors.mtxv": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.mtxv args[0]");
    assertVec3(args[1], "coords-vectors.mtxv args[1]");
    return backend.mtxv(args[0], args[1]);
  },

  "coords-vectors.mxm": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.mxm args[0]");
    assertMat3RowMajor(args[1], "coords-vectors.mxm args[1]");
    return backend.mxm(args[0], args[1]);
  },

  "coords-vectors.mxv": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.mxv args[0]");
    assertVec3(args[1], "coords-vectors.mxv args[1]");
    return backend.mxv(args[0], args[1]);
  },

  "coords-vectors.recgeo": (backend, args) => {
    assertVec3(args[0], "coords-vectors.recgeo args[0]");
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.recgeo expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.recgeo expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.recgeo(args[0], args[1], args[2]);
  },

  "coords-vectors.reclat": (backend, args) => {
    assertVec3(args[0], "coords-vectors.reclat args[0]");
    return backend.reclat(args[0]);
  },

  "coords-vectors.recsph": (backend, args) => {
    assertVec3(args[0], "coords-vectors.recsph args[0]");
    return backend.recsph(args[0]);
  },

  "coords-vectors.rotate": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.rotate expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.rotate expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    assertInteger(args[1], "coords-vectors.rotate args[1]");
    return backend.rotate(args[0], args[1]);
  },

  "coords-vectors.rotmat": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.rotmat args[0]");
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.rotmat expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.rotmat expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[2], "coords-vectors.rotmat args[2]");
    return backend.rotmat(args[0], args[1], args[2]);
  },

  "coords-vectors.sphrec": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.sphrec expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.sphrec expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.sphrec expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.sphrec(args[0], args[1], args[2]);
  },

  "coords-vectors.vadd": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vadd args[0]");
    assertVec3(args[1], "coords-vectors.vadd args[1]");
    return backend.vadd(args[0], args[1]);
  },

  "coords-vectors.vcrss": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vcrss args[0]");
    assertVec3(args[1], "coords-vectors.vcrss args[1]");
    return backend.vcrss(args[0], args[1]);
  },

  "coords-vectors.vdot": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vdot args[0]");
    assertVec3(args[1], "coords-vectors.vdot args[1]");
    return backend.vdot(args[0], args[1]);
  },

  "coords-vectors.vhat": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vhat args[0]");
    return backend.vhat(args[0]);
  },

  "coords-vectors.vminus": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vminus args[0]");
    return backend.vminus(args[0]);
  },

  "coords-vectors.vnorm": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vnorm args[0]");
    return backend.vnorm(args[0]);
  },

  "coords-vectors.vscl": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.vscl expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertVec3(args[1], "coords-vectors.vscl args[1]");
    return backend.vscl(args[0], args[1]);
  },

  "coords-vectors.vsub": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vsub args[0]");
    assertVec3(args[1], "coords-vectors.vsub args[1]");
    return backend.vsub(args[0], args[1]);
  },

};

function safeErrorReport(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const report: RunnerErrorReport = { message: error.message };
    if (error.name) report.name = error.name;
    if (error.stack) report.stack = error.stack;

    const anyErr = error as unknown as { code?: unknown };
    if (isRunnerValidationCode(anyErr.code)) report.code = anyErr.code;

    return report;
  }

  return { message: String(error) };
}

function inferSpiceFromError(error: unknown): SpiceErrorState | null {
  if (!(error instanceof Error)) return null;

  // Some backends (notably WASM) attach best-effort SPICE fields directly to
  // the Error instance, rather than exposing them via `failed()/getmsg()`.
  const anyErr = error as unknown as {
    spiceShort?: unknown;
    spiceLong?: unknown;
    spiceTrace?: unknown;
  };

  // Prefer explicitly attached fields, but fall back to best-effort inference
  // from the thrown message.
  const m = /SPICE\s*\(\s*([A-Z0-9_]+)\s*\)/i.exec(error.message);

  const shortRaw = typeof anyErr.spiceShort === "string" ? anyErr.spiceShort : m?.[1];
  const short = typeof shortRaw === "string" ? (spiceShortSymbol(shortRaw) ?? undefined) : undefined;

  const long = typeof anyErr.spiceLong === "string" ? anyErr.spiceLong : undefined;
  const trace = typeof anyErr.spiceTrace === "string" ? anyErr.spiceTrace : undefined;

  if (short === undefined && long === undefined && trace === undefined) return null;

  return {
    failed: true,
    ...(short !== undefined ? { short } : {}),
    ...(long !== undefined ? { long } : {}),
    ...(trace !== undefined ? { trace } : {}),
  };
}

function tryConfigureErrorPolicy(backend: SpiceBackend): void {
  // Not part of the backend contract, but may exist on some implementations.
  const b = backend as unknown as {
    erract?: (op: string, action: string) => void;
    errprt?: (op: string, list: string) => void;
  };

  try {
    b.erract?.("SET", "RETURN");
  } catch {
    // ignore
  }

  try {
    b.errprt?.("SET", "NONE");
  } catch {
    // ignore
  }
}

function isolateCase(backend: SpiceBackend): void {
  // Clear any kernel pool / loaded kernels and reset the SPICE error state.
  backend.kclear();
  backend.reset();
  tryConfigureErrorPolicy(backend);
}

function captureSpiceErrorState(backend: SpiceBackend): SpiceErrorState {
  let failed = false;
  try {
    failed = backend.failed();
  } catch {
    failed = false;
  }

  if (!failed) return { failed: false };

  const spice: SpiceErrorState = { failed: true };

  try {
    spice.short = backend.getmsg("SHORT");
  } catch {
    // ignore
  }

  try {
    spice.long = backend.getmsg("LONG");
  } catch {
    // ignore
  }

  try {
    spice.explain = backend.getmsg("EXPLAIN");
  } catch {
    // ignore
  }

  return spice;
}

export type TspiceRunnerBackend = "auto" | "node" | "wasm";

export type CreateTspiceRunnerOptions = {
  backend?: TspiceRunnerBackend;
};

function parseBackendEnv(value: unknown): TspiceRunnerBackend | undefined {
  if (value === "node" || value === "wasm" || value === "auto") return value;
  return undefined;
}

function isMissingNativeAddon(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (/tspice_backend_node\.node/.test(msg)) return true;
  if (/Cannot find module/.test(msg) && /tspice-native-/.test(msg)) return true;
  if (
    /tspice-backend-node/.test(msg) &&
    (/Cannot find module/.test(msg) || /ERR_MODULE_NOT_FOUND/.test(msg) || /Failed to resolve entry/.test(msg))
  ) {
    return true;
  }
  return false;
}

async function createBackendForRunner(
  backend: TspiceRunnerBackend,
): Promise<{ backend: SpiceBackend; kind: string }> {
  const createNodeBackend = async (): Promise<SpiceBackend> => {
    const { spice } = await spiceClients.toSync({ backend: "node" });
    return spice.raw;
  };

  const createWasmBackend = async (): Promise<SpiceBackend> => {
    const { spice } = await spiceClients.toSync({ backend: "wasm" });
    return spice.raw;
  };

  if (backend === "node") {
    return { backend: await createNodeBackend(), kind: "tspice(node)" };
  }
  if (backend === "wasm") {
    return { backend: await createWasmBackend(), kind: "tspice(wasm)" };
  }

  // auto: prefer node, but fall back to wasm when the native addon isn't staged.
  try {
    return { backend: await createNodeBackend(), kind: "tspice(node)" };
  } catch (error) {
    if (isMissingNativeAddon(error)) {
      return { backend: await createWasmBackend(), kind: "tspice(wasm)" };
    }
    throw error;
  }
}

async function kernelVirtualIdFromOsPath(osPath: string): Promise<string> {
  // WASM kernel paths must be *virtual* ids (not OS paths). We also need to
  // avoid collisions when two kernels share a basename.
  const resolved = path.resolve(osPath);
  const canonical = await realpath(resolved).catch(() => resolved);
  const base = path.basename(canonical);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return `ospath/${hash}/${base}`;
}

function normalizeKernelEntry(entry: KernelEntry): { path: string; restrictToDir?: string } {
  return typeof entry === "string" ? { path: entry } : entry;
}

async function furnshOsKernelForWasm(
  backend: SpiceBackend,
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): Promise<void> {
  const absPath = path.resolve(osPath);
  const loadedKey = `bytes:${absPath}`;
  if (loaded.has(loadedKey)) return;
  loaded.add(loadedKey);

  if (path.extname(absPath).toLowerCase() === ".tm") {
    // The WASM backend can't directly load nested kernels referenced by a meta-kernel
    // from the host filesystem, so we expand `KERNELS_TO_LOAD` ourselves.
    const metaKernelText = await readFile(absPath, "utf8");

    const kernelsToLoad = resolveMetaKernelKernelsToLoad(
      metaKernelText,
      absPath,
      restrictToDir ? { restrictToDir } : {},
    );

    // Load a sanitized copy of the meta-kernel itself so any pool assignments apply,
    // but without allowing it to try to load OS-path kernels in WASM.
    const sanitized = sanitizeMetaKernelTextForWasm(metaKernelText);
    const vid = await kernelVirtualIdFromOsPath(absPath);
    backend.furnsh({ path: vid, bytes: Buffer.from(sanitized, "utf8") });

    for (const k of kernelsToLoad) {
      await furnshOsKernelForWasm(backend, k, loaded, restrictToDir);
    }
    return;
  }

  const bytes = await readFile(absPath);
  const vid = await kernelVirtualIdFromOsPath(absPath);
  backend.furnsh({ path: vid, bytes });
}

async function furnshOsKernelForNative(
  backend: SpiceBackend,
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): Promise<void> {
  const absPath = path.resolve(osPath);

  // Native can load via OS-path or via bytes (sanitized meta-kernel). Keep those
  // distinct so we don't incorrectly dedupe across modes.
  const mode = restrictToDir && path.extname(absPath).toLowerCase() === ".tm" ? "bytes" : "ospath";
  const loadedKey = `${mode}:${absPath}`;
  if (loaded.has(loadedKey)) return;
  loaded.add(loadedKey);

  if (restrictToDir && path.extname(absPath).toLowerCase() === ".tm") {
    // Mirror the WASM behavior:
    // 1) Expand/validate `KERNELS_TO_LOAD` ourselves (so restrictions apply).
    // 2) Furnish a sanitized copy of the meta-kernel (so pool assignments apply)
    //    but without letting CSPICE load nested kernels implicitly.
    const metaKernelText = await readFile(absPath, "utf8");

    const kernelsToLoad = resolveMetaKernelKernelsToLoad(metaKernelText, absPath, { restrictToDir });

    const sanitized = sanitizeMetaKernelTextForNativeNoKernels(metaKernelText);
    backend.furnsh({ path: absPath, bytes: Buffer.from(sanitized, "utf8") });

    for (const k of kernelsToLoad) {
      await furnshOsKernelForNative(backend, k, loaded, restrictToDir);
    }
    return;
  }

  backend.furnsh(absPath);
}

/** Create a CaseRunner that executes calls using an in-process tspice backend (node/wasm/auto). */
export async function createTspiceRunner(options: CreateTspiceRunnerOptions = {}): Promise<CaseRunner> {
  const requested =
    options.backend ?? parseBackendEnv(process.env.TSPICE_BACKEND_VERIFY_BACKEND) ?? "auto";

  const { backend, kind } = await createBackendForRunner(requested);

  return {
    kind,

    async dispose(): Promise<void> {
      // Best-effort cleanup so the runner can be reused across tests or
      // torn down without leaking state/resources.
      try {
        backend.kclear();
      } catch {
        // ignore
      }
      try {
        backend.reset();
      } catch {
        // ignore
      }

      // Not part of the backend contract, but may exist on some implementations.
      const b = backend as unknown as {
        dispose?: () => void | Promise<void>;
        close?: () => void | Promise<void>;
      };

      try {
        await b.dispose?.();
      } catch {
        // ignore
      }
      try {
        await b.close?.();
      } catch {
        // ignore
      }
    },

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      isolateCase(backend);

      try {
        const loadedKernels = new Set<string>();
        for (const kernelEntry of input.setup?.kernels ?? []) {
          const kernel = normalizeKernelEntry(kernelEntry);
          if (backend.kind === "wasm") {
            await furnshOsKernelForWasm(backend, kernel.path, loadedKernels, kernel.restrictToDir);
          } else {
            await furnshOsKernelForNative(backend, kernel.path, loadedKernels, kernel.restrictToDir);
          }
        }

        const fn = DISPATCH[input.call];
        if (!fn) {
          unsupportedCall(`Unsupported call: ${formatValue(input.call)}`);
        }

        const result = fn(backend, input.args);
        return { ok: true, result };
      } catch (error) {
        const report = safeErrorReport(error);

        const captured = captureSpiceErrorState(backend);
        const inferredState = inferSpiceFromError(error);

        // Prefer the backend-reported SPICE state, but fall back to inference
        // when the backend doesn't surface anything useful.
        if (captured.failed) {
          report.spice = inferredState ? { ...inferredState, ...captured } : captured;
        } else {
          report.spice = inferredState ?? captured;
        }

        // Ensure subsequent cases start clean.
        try {
          backend.reset();
        } catch {
          // ignore
        }

        return { ok: false, error: report };
      } finally {
        // Per-case isolation: don't allow kernels or error state to leak.
        try {
          backend.kclear();
        } catch {
          // ignore
        }
        try {
          backend.reset();
        } catch {
          // ignore
        }
      }
    },
  };
}
