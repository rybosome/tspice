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

function metadataPath(context: RunTspiceContext, value: string): string {
  if (value === "") return "";
  const normalized = value.replace(/\\/g, "/");
  const fixtureRoot = context.paths.fixturesRoot.replace(/\\/g, "/") + "/";
  const scratchRoot = context.paths.scratchRoot.replace(/\\/g, "/") + "/";
  if (normalized.startsWith(fixtureRoot))
    return normalized.slice(fixtureRoot.length);
  if (normalized.startsWith(scratchRoot))
    return "scratch/" + normalized.slice(scratchRoot.length);
  return normalized.replace(/^\/?kernels\/py-parity\/|^py-parity\//, "");
}

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
        if (fs.existsSync(resolvedPath)) {
          const bytes = fs.readFileSync(resolvedPath);
          context.spice.raw.furnsh({ path: virtualPath, bytes });
        } else {
          // A missing fixture must exercise raw furnsh's actual SPICE error.
          context.spice.raw.furnsh(virtualPath);
        }
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

      let handleMatchesEntry = false;
      for (let i = 0; i < context.spice.raw.ktotal("ALL"); i++) {
        const entry = context.spice.raw.kdata(i, "ALL");
        if (
          entry.found &&
          metadataPath(context, entry.file) ===
            metadataPath(context, resolveKernelPathForTspice(step.path)) &&
          entry.handle === out.handle
        ) {
          handleMatchesEntry = true;
        }
      }
      return {
        op: step.op,
        value: {
          found: true,
          filtyp: out.filtyp,
          source: metadataPath(context, out.source),
          handleIsZero: out.handle === 0,
          handleMatchesEntry,
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
          file: metadataPath(context, out.file),
          filtyp: out.filtyp,
          source: metadataPath(context, out.source),
          handleIsZero: out.handle === 0,
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
