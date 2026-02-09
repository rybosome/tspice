import * as path from "node:path";
import crypto from "node:crypto";
import { readFile, realpath } from "node:fs/promises";

import { createBackend, type SpiceBackend } from "@rybosome/tspice";

import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForNativeNoKernels,
  sanitizeMetaKernelTextForWasm,
} from "../kernels/metaKernel.js";

import type { CaseRunner, KernelEntry, RunCaseInput, RunCaseResult, RunnerErrorReport, SpiceErrorState } from "./types.js";

type DispatchFn = (backend: SpiceBackend, args: unknown[]) => unknown;

const DISPATCH: Record<string, DispatchFn> = {
  // Phase A minimum surface.
  "time.str2et": (backend, args) => {
    if (typeof args[0] !== "string") {
      throw new TypeError(`time.str2et expects args[0] to be a string (got ${JSON.stringify(args[0])})`);
    }
    return backend.str2et(args[0]);
  },

  // Convenience alias.
  str2et: (backend, args) => {
    if (typeof args[0] !== "string") {
      throw new TypeError(`str2et expects args[0] to be a string (got ${JSON.stringify(args[0])})`);
    }
    return backend.str2et(args[0]);
  },
};

function safeErrorReport(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const report: RunnerErrorReport = { message: error.message };
    if (error.name) report.name = error.name;
    if (error.stack) report.stack = error.stack;
    return report;
  }

  return { message: String(error) };
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
  if (backend === "node") {
    return { backend: await createBackend({ backend: "node" }), kind: "tspice(node)" };
  }
  if (backend === "wasm") {
    return { backend: await createBackend({ backend: "wasm" }), kind: "tspice(wasm)" };
  }

  // auto: prefer node, but fall back to wasm when the native addon isn't staged.
  try {
    return { backend: await createBackend({ backend: "node" }), kind: "tspice(node)" };
  } catch (error) {
    if (isMissingNativeAddon(error)) {
      return { backend: await createBackend({ backend: "wasm" }), kind: "tspice(wasm)" };
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
  if (loaded.has(absPath)) return;
  loaded.add(absPath);

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
    backend.furnsh({ path: kernelVirtualIdFromOsPath(absPath), bytes: Buffer.from(sanitized, "utf8") });

    for (const k of kernelsToLoad) {
      await furnshOsKernelForWasm(backend, k, loaded, restrictToDir);
    }
    return;
  }

  const bytes = await readFile(absPath);
  backend.furnsh({ path: kernelVirtualIdFromOsPath(absPath), bytes });
}

async function furnshOsKernelForNative(
  backend: SpiceBackend,
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): Promise<void> {
  const absPath = path.resolve(osPath);
  if (loaded.has(absPath)) return;
  loaded.add(absPath);

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

export async function createTspiceRunner(options: CreateTspiceRunnerOptions = {}): Promise<CaseRunner> {
  const requested =
    options.backend ?? parseBackendEnv(process.env.TSPICE_BACKEND_VERIFY_BACKEND) ?? "auto";

  const { backend, kind } = await createBackendForRunner(requested);

  return {
    kind,

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
          throw new Error(`Unsupported call: ${JSON.stringify(input.call)}`);
        }

        const result = fn(backend, input.args);
        return { ok: true, result };
      } catch (error) {
        const report = safeErrorReport(error);

        // Try to capture SPICE internal error messages for debugging.
        report.spice = captureSpiceErrorState(backend);

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
