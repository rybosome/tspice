import fs from "node:fs";

import type {
  StepKernelsFurnsh,
  StepKernelsKclear,
  StepKernelsKdata,
  StepKernelsKinfo,
  StepKernelsKplfrm,
  StepKernelsKtotal,
  StepKernelsKxtrct,
  StepKernelsUnload,
  StepOutput,
} from "../../case-types.js";
import {
  normalizeKernelPathForParity,
  resolvePathRef,
  toPathRef,
  toVirtualKernelPath,
} from "../../fixtures.js";
import type { RunTspiceContext } from "../context.js";

type KernelsStep =
  | StepKernelsFurnsh
  | StepKernelsKclear
  | StepKernelsKinfo
  | StepKernelsKplfrm
  | StepKernelsKtotal
  | StepKernelsKdata
  | StepKernelsKxtrct
  | StepKernelsUnload;

const KPLFRM_MAX_IDS = 1_024;

function resolveKernelPathForTspice(pathValue: string): string {
  if (pathValue.trim().length === 0) {
    return pathValue;
  }

  return toVirtualKernelPath(pathValue);
}

function runWasmKplfrmFallback(context: RunTspiceContext, frmcls: number): number[] {
  if (frmcls < 1 || frmcls > 6) {
    throw new Error(`Frame class specifier FRMCLS was ${frmcls}; this value is not supported.`);
  }

  const classVariables = context.spice.raw.gnpool("FRAME_*_CLASS", 0, 10_000);
  if (!classVariables.found) {
    return [];
  }

  const ids = new Set<number>();

  for (const classVariableName of classVariables.values) {
    const classValue = context.spice.raw.gipool(classVariableName, 0, 1);
    if (!classValue.found || classValue.values.length === 0) {
      continue;
    }

    const frameClass = classValue.values[0];
    if (frameClass == null || frameClass !== frmcls) {
      continue;
    }

    const numericMatch = /^FRAME_(-?\d+)_CLASS$/.exec(classVariableName);
    if (numericMatch != null) {
      const frameIdText = numericMatch[1];
      if (frameIdText != null) {
        ids.add(Number.parseInt(frameIdText, 10));
      }
      continue;
    }

    const namedMatch = /^FRAME_(.+)_CLASS$/.exec(classVariableName);
    if (namedMatch == null) {
      continue;
    }

    const frameIdVariable = `FRAME_${namedMatch[1]}`;
    const frameId = context.spice.raw.gipool(frameIdVariable, 0, 1);
    if (!frameId.found || frameId.values.length === 0) {
      continue;
    }

    const resolvedFrameId = frameId.values[0];
    if (resolvedFrameId == null) {
      continue;
    }

    ids.add(resolvedFrameId);
  }

  return [...ids].sort((a, b) => a - b);
}

function runKplfrmStep(context: RunTspiceContext, frmcls: number): number[] {
  if (context.spice.raw.kind === "wasm") {
    return runWasmKplfrmFallback(context, frmcls);
  }

  const idset = context.spice.kit.newIntCell(KPLFRM_MAX_IDS);
  try {
    context.spice.raw.kplfrm(frmcls, idset);

    const cardinality = context.spice.raw.card(idset);
    const ids: number[] = [];
    for (let index = 0; index < cardinality; index++) {
      ids.push(context.spice.kit.cellGeti(idset, index));
    }

    return ids.sort((a, b) => a - b);
  } finally {
    context.spice.kit.freeCell(idset);
  }
}

/** Execute one `kernels.*` workflow step in tspice. */
export function runKernelsStep(context: RunTspiceContext, step: KernelsStep): StepOutput {
  switch (step.op) {
    case "kernels.furnsh": {
      const pathRef = toPathRef(step.file);
      const virtualPath = toVirtualKernelPath(pathRef);

      if (pathRef.kind === "scratch") {
        const resolvedScratchPath = resolvePathRef(context.paths, pathRef);

        // Scratch refs may point to files created directly inside the backend
        // (e.g. EK writers in WASM), in which case no host file exists.
        if (fs.existsSync(resolvedScratchPath)) {
          const bytes = fs.readFileSync(resolvedScratchPath);
          context.spice.raw.furnsh({
            path: virtualPath,
            bytes,
          });
        } else {
          context.spice.raw.furnsh(virtualPath);
        }
      } else {
        const resolvedPath = resolvePathRef(context.paths, pathRef);
        const bytes = fs.readFileSync(resolvedPath);
        context.spice.raw.furnsh({
          path: virtualPath,
          bytes,
        });
      }

      context.state.kernels.loadedVirtualKernelPaths.push(virtualPath);
      return { op: step.op, value: null };
    }

    case "kernels.kclear":
      context.spice.raw.kclear();
      return { op: step.op, value: null };

    case "kernels.kinfo": {
      const out = context.spice.raw.kinfo(resolveKernelPathForTspice(step.path));
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return {
        op: step.op,
        value: {
          found: true,
          filtyp: out.filtyp,
          source: normalizeKernelPathForParity(out.source),
        },
      };
    }

    case "kernels.kplfrm": {
      return {
        op: step.op,
        value: {
          ids: runKplfrmStep(context, step.frmcls),
        },
      };
    }

    case "kernels.ktotal":
      return { op: step.op, value: context.spice.raw.ktotal(step.kind) };

    case "kernels.kdata": {
      const out = context.spice.raw.kdata(step.which, step.kind);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return {
        op: step.op,
        value: {
          found: true,
          file: normalizeKernelPathForParity(out.file),
          filtyp: out.filtyp,
          source: normalizeKernelPathForParity(out.source),
        },
      };
    }

    case "kernels.kxtrct": {
      const out = context.spice.raw.kxtrct(step.keywd, step.terms, step.string);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return {
        op: step.op,
        value: {
          found: true,
          wordsq: out.wordsq,
          substr: out.substr,
        },
      };
    }

    case "kernels.unload":
      context.spice.raw.unload(resolveKernelPathForTspice(step.path));
      return { op: step.op, value: null };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled kernels step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
