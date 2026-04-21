import fs from "node:fs";

import type { SpiceWindow } from "@rybosome/tspice-backend-contract";
import type { Spice } from "@rybosome/tspice";

import type {
  CaseExecutionFailure,
  CaseExecutionResult,
  CaseExecutionSuccess,
  Matrix3x3,
  ParityCase,
  StepOutput,
} from "./case-types.js";
import {
  normalizeKernelPathForParity,
  resolveFixturePath,
  toVirtualKernelPath,
} from "./fixtures.js";

function flattenMatrix(m: Matrix3x3): [number, number, number, number, number, number, number, number, number] {
  return [
    m[0][0],
    m[0][1],
    m[0][2],
    m[1][0],
    m[1][1],
    m[1][2],
    m[2][0],
    m[2][1],
    m[2][2],
  ];
}

function requiredNumber(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Matrix output missing value at index ${index}`);
  }
  return value;
}

function unflattenMatrix(values: readonly number[]): Matrix3x3 {
  if (values.length !== 9) {
    throw new Error(`Expected 9 matrix values, got ${values.length}`);
  }

  const a = requiredNumber(values, 0);
  const b = requiredNumber(values, 1);
  const c = requiredNumber(values, 2);
  const d = requiredNumber(values, 3);
  const e = requiredNumber(values, 4);
  const f = requiredNumber(values, 5);
  const g = requiredNumber(values, 6);
  const h = requiredNumber(values, 7);
  const i = requiredNumber(values, 8);

  return [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ];
}

function normalizeError(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    return { type: error.name, message: error.message };
  }
  return { type: typeof error, message: String(error) };
}

function getOrCreateWindow(
  spice: Spice,
  windows: Map<string, SpiceWindow>,
  windowId: string,
  maxIntervals: number,
): SpiceWindow {
  const existing = windows.get(windowId);
  if (existing != null) {
    return existing;
  }
  const created = spice.kit.newWindow(maxIntervals);
  windows.set(windowId, created);
  return created;
}

function requireWindow(windows: Map<string, SpiceWindow>, windowId: string): SpiceWindow {
  const window = windows.get(windowId);
  if (window == null) {
    throw new Error(`Window does not exist: ${windowId}`);
  }
  return window;
}

/** Execute one parity case against tspice (WASM backend) with per-case kernel isolation. */
export function runCaseInTspice(
  spice: Spice,
  parityCase: ParityCase,
  fixturesRoot: string,
): CaseExecutionResult {
  const windows = new Map<string, SpiceWindow>();

  try {
    spice.raw.kclear();

    const outputs: StepOutput[] = [];

    for (const step of parityCase.workflow) {
      switch (step.op) {
        case "time.str2et": {
          outputs.push({ op: step.op, value: spice.raw.str2et(step.time) });
          break;
        }

        case "time.et2utc": {
          outputs.push({
            op: step.op,
            value: spice.raw.et2utc(step.et, step.format, step.prec),
          });
          break;
        }

        case "time.timdef": {
          if (step.action === "GET") {
            outputs.push({ op: step.op, value: spice.raw.timdef("GET", step.item) });
          } else {
            spice.raw.timdef("SET", step.item, step.value);
            outputs.push({ op: step.op, value: null });
          }
          break;
        }

        case "ids-names.bodn2c": {
          const out = spice.raw.bodn2c(step.name);
          if (out.found) {
            outputs.push({ op: step.op, value: { found: true, code: out.code } });
          } else {
            outputs.push({ op: step.op, value: { found: false } });
          }
          break;
        }

        case "coords-vectors.mxm": {
          const out = spice.raw.mxm(
            flattenMatrix(step.m1) as unknown as Parameters<typeof spice.raw.mxm>[0],
            flattenMatrix(step.m2) as unknown as Parameters<typeof spice.raw.mxm>[1],
          );
          outputs.push({ op: step.op, value: unflattenMatrix(out) });
          break;
        }

        case "coords-vectors.recgeo": {
          const out = spice.raw.recgeo(step.rectan, step.re, step.f);
          outputs.push({ op: step.op, value: out });
          break;
        }

        case "cells-windows.wninsd": {
          const window = getOrCreateWindow(spice, windows, step.windowId, step.maxIntervals ?? 8);
          spice.raw.wninsd(step.left, step.right, window);
          outputs.push({ op: step.op, value: null });
          break;
        }

        case "cells-windows.wnfetd": {
          const window = requireWindow(windows, step.windowId);
          const [left, right] = spice.raw.wnfetd(window, step.index);
          outputs.push({ op: step.op, value: { left, right } });
          break;
        }

        case "kernel-pool.gcpool": {
          const out = spice.raw.gcpool(step.name, step.start, step.room);
          if (out.found) {
            outputs.push({ op: step.op, value: { found: true, values: out.values } });
          } else {
            outputs.push({ op: step.op, value: { found: false } });
          }
          break;
        }

        case "kernels.furnsh": {
          const fixturePath = resolveFixturePath(fixturesRoot, step.file);
          const bytes = fs.readFileSync(fixturePath);
          spice.raw.furnsh({
            path: toVirtualKernelPath(step.file),
            bytes,
          });
          outputs.push({ op: step.op, value: null });
          break;
        }

        case "kernels.ktotal": {
          outputs.push({ op: step.op, value: spice.raw.ktotal(step.kind) });
          break;
        }

        case "kernels.kdata": {
          const out = spice.raw.kdata(step.which, step.kind);
          if (!out.found) {
            outputs.push({ op: step.op, value: { found: false } });
            break;
          }

          outputs.push({
            op: step.op,
            value: {
              found: true,
              file: normalizeKernelPathForParity(out.file),
              filtyp: out.filtyp,
              source: normalizeKernelPathForParity(out.source),
            },
          });
          break;
        }

        case "kernels.kxtrct": {
          const out = spice.raw.kxtrct(step.keywd, step.terms, step.string);
          if (!out.found) {
            outputs.push({ op: step.op, value: { found: false } });
            break;
          }
          outputs.push({
            op: step.op,
            value: {
              found: true,
              wordsq: out.wordsq,
              substr: out.substr,
            },
          });
          break;
        }

        case "ek.ekfind": {
          outputs.push({ op: step.op, value: spice.raw.ekfind(step.query) });
          break;
        }

        case "ek.ekgc": {
          outputs.push({ op: step.op, value: spice.raw.ekgc(step.selidx, step.row, step.elment) });
          break;
        }

        default: {
          const exhaustive: never = step;
          throw new Error(`Unhandled step: ${JSON.stringify(exhaustive)}`);
        }
      }
    }

    const result: CaseExecutionSuccess = {
      caseId: parityCase.caseId,
      ok: true,
      outputs,
      error: null,
    };
    return result;
  } catch (error) {
    const normalized = normalizeError(error);
    const failed: CaseExecutionFailure = {
      caseId: parityCase.caseId,
      ok: false,
      outputs: [],
      error: normalized,
    };
    return failed;
  } finally {
    for (const window of windows.values()) {
      try {
        spice.kit.freeWindow(window);
      } catch {
        // best-effort cleanup only
      }
    }

    try {
      spice.raw.kclear();
    } catch {
      // best-effort cleanup only
    }
  }
}
