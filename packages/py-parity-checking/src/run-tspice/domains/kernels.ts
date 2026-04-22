import fs from "node:fs";

import type {
  StepKernelsFurnsh,
  StepKernelsKdata,
  StepKernelsKtotal,
  StepKernelsKxtrct,
  StepOutput,
} from "../../case-types.js";
import {
  normalizeKernelPathForParity,
  resolvePathRef,
  toVirtualKernelPath,
} from "../../fixtures.js";
import type { RunTspiceContext } from "../context.js";

type KernelsStep = StepKernelsFurnsh | StepKernelsKtotal | StepKernelsKdata | StepKernelsKxtrct;

/** Execute one `kernels.*` workflow step in tspice. */
export function runKernelsStep(context: RunTspiceContext, step: KernelsStep): StepOutput {
  switch (step.op) {
    case "kernels.furnsh": {
      const resolvedPath = resolvePathRef(context.paths, step.file);
      const virtualPath = toVirtualKernelPath(step.file);
      const bytes = fs.readFileSync(resolvedPath);
      context.spice.raw.furnsh({
        path: virtualPath,
        bytes,
      });
      context.state.kernels.loadedVirtualKernelPaths.push(virtualPath);
      return { op: step.op, value: null };
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

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled kernels step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
