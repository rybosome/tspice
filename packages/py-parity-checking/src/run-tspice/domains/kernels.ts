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

function runKplfrmStep(
  context: RunTspiceContext,
  frmcls: number,
  capacity = KPLFRM_MAX_IDS,
): number[] {
  const idset = context.spice.kit.newIntCell(capacity);
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
export function runKernelsStep(
  context: RunTspiceContext,
  step: KernelsStep,
): StepOutput {
  switch (step.op) {
    case "kernels.furnsh": {
      const pathRef = toPathRef(step.file);
      const virtualPath = toVirtualKernelPath(pathRef);

      if (pathRef.kind === "scratch") {
        const resolvedScratchPath = resolvePathRef(context.paths, pathRef);

        // Scratch refs may point to files created directly inside the backend
        // (e.g. EK writers in WASM), in which case no host file exists.
        if (
          context.spice.raw.kind === "node" &&
          fs.existsSync(resolvedScratchPath)
        ) {
          // Preserve physical identity when a writer created this host file:
          // staging a copy can hide CSPICE read/write-open conflicts.
          context.spice.raw.furnsh(resolvedScratchPath);
        } else if (fs.existsSync(resolvedScratchPath)) {
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
      const out = context.spice.raw.kinfo(
        resolveKernelPathForTspice(step.path),
      );
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
          ids: runKplfrmStep(context, step.frmcls, step.capacity),
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
