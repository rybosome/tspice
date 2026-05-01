import fs from "node:fs";

import type {
  Matrix6x6,
  PathRef,
  PathRefLike,
  StepFramesCcifrm,
  StepFramesCidfrm,
  StepFramesCkcov,
  StepFramesCkgp,
  StepFramesCkgpav,
  StepFramesCklpf,
  StepFramesCkobj,
  StepFramesCkupf,
  StepFramesCnmfrm,
  StepFramesFrinfo,
  StepFramesFrmnam,
  StepFramesNamfrm,
  StepFramesPxform,
  StepFramesSxform,
  StepOutput,
} from "../../case-types.js";
import { resolvePathRef, toPathRef, toVirtualKernelPath } from "../../fixtures.js";
import { getOrCreateWindow, type RunTspiceContext } from "../context.js";
import { unflattenMatrix } from "../utils/matrix.js";

type FramesStep =
  | StepFramesNamfrm
  | StepFramesFrmnam
  | StepFramesCidfrm
  | StepFramesCnmfrm
  | StepFramesFrinfo
  | StepFramesCcifrm
  | StepFramesCkgp
  | StepFramesCkgpav
  | StepFramesCklpf
  | StepFramesCkupf
  | StepFramesCkobj
  | StepFramesCkcov
  | StepFramesPxform
  | StepFramesSxform;

type FramesCkPathStep = StepFramesCklpf | StepFramesCkobj | StepFramesCkcov;

function pathRefsEqual(left: PathRef, right: PathRef): boolean {
  return left.kind === right.kind && left.rel === right.rel;
}

function canonicalizeFramesCkPath(context: RunTspiceContext, step: FramesCkPathStep): PathRef {
  const canonical = toPathRef(step.ck);

  for (const hint of context.normalization.metadata.runtimePath.canonicalizationHints) {
    if (hint.domain !== "frames" || hint.op !== step.op || hint.field !== "ck") {
      continue;
    }

    if (pathRefsEqual(hint.canonicalPath, canonical)) {
      return hint.canonicalPath;
    }
  }

  return canonical;
}

function ensureVirtualCkPath(context: RunTspiceContext, pathRef: PathRefLike): string {
  const virtualPath = toVirtualKernelPath(pathRef);
  if (!context.state.frames.stagedVirtualKernelPaths.has(virtualPath)) {
    const resolvedPath = resolvePathRef(context.paths, pathRef);
    const bytes = fs.readFileSync(resolvedPath);

    // Stage CK bytes into virtual FS once, then unload; cklpf controls loaded state thereafter.
    context.spice.raw.furnsh({ path: virtualPath, bytes });
    context.spice.raw.unload(virtualPath);
    context.state.frames.stagedVirtualKernelPaths.add(virtualPath);
  }

  return virtualPath;
}

function setCkHandle(context: RunTspiceContext, handleId: string, handle: number): void {
  if (context.state.frames.ckHandles.has(handleId)) {
    throw new Error(`CK handle already exists: ${handleId}`);
  }
  context.state.frames.ckHandles.set(handleId, handle);
}

function requireCkHandle(context: RunTspiceContext, handleId: string): number {
  const handle = context.state.frames.ckHandles.get(handleId);
  if (handle == null) {
    throw new Error(`CK handle does not exist: ${handleId}`);
  }
  return handle;
}

function deleteCkHandle(context: RunTspiceContext, handleId: string): void {
  context.state.frames.ckHandles.delete(handleId);
}

function requiredNumber(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Missing numeric value at index ${index}`);
  }
  return value;
}

function toVector3(values: readonly number[]): [number, number, number] {
  if (values.length !== 3) {
    throw new Error(`Expected length-3 vector, got ${values.length}`);
  }

  return [requiredNumber(values, 0), requiredNumber(values, 1), requiredNumber(values, 2)];
}

function toMatrix6x6(values: readonly number[]): Matrix6x6 {
  if (values.length !== 36) {
    throw new Error(`Expected 36 matrix values, got ${values.length}`);
  }

  const rows: Matrix6x6 = [
    [
      requiredNumber(values, 0),
      requiredNumber(values, 1),
      requiredNumber(values, 2),
      requiredNumber(values, 3),
      requiredNumber(values, 4),
      requiredNumber(values, 5),
    ],
    [
      requiredNumber(values, 6),
      requiredNumber(values, 7),
      requiredNumber(values, 8),
      requiredNumber(values, 9),
      requiredNumber(values, 10),
      requiredNumber(values, 11),
    ],
    [
      requiredNumber(values, 12),
      requiredNumber(values, 13),
      requiredNumber(values, 14),
      requiredNumber(values, 15),
      requiredNumber(values, 16),
      requiredNumber(values, 17),
    ],
    [
      requiredNumber(values, 18),
      requiredNumber(values, 19),
      requiredNumber(values, 20),
      requiredNumber(values, 21),
      requiredNumber(values, 22),
      requiredNumber(values, 23),
    ],
    [
      requiredNumber(values, 24),
      requiredNumber(values, 25),
      requiredNumber(values, 26),
      requiredNumber(values, 27),
      requiredNumber(values, 28),
      requiredNumber(values, 29),
    ],
    [
      requiredNumber(values, 30),
      requiredNumber(values, 31),
      requiredNumber(values, 32),
      requiredNumber(values, 33),
      requiredNumber(values, 34),
      requiredNumber(values, 35),
    ],
  ];
  return rows;
}

/** Execute one `frames.*` workflow step in tspice. */
export function runFramesStep(context: RunTspiceContext, step: FramesStep): StepOutput {
  switch (step.op) {
    case "frames.namfrm": {
      const out = context.spice.raw.namfrm(step.name);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return { op: step.op, value: { found: true, code: out.code } };
    }

    case "frames.frmnam": {
      const out = context.spice.raw.frmnam(step.code);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return { op: step.op, value: { found: true, name: out.name } };
    }

    case "frames.cidfrm": {
      const out = context.spice.raw.cidfrm(step.center);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return {
        op: step.op,
        value: {
          found: true,
          frcode: out.frcode,
          frname: out.frname,
        },
      };
    }

    case "frames.cnmfrm": {
      const out = context.spice.raw.cnmfrm(step.centerName);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return {
        op: step.op,
        value: {
          found: true,
          frcode: out.frcode,
          frname: out.frname,
        },
      };
    }

    case "frames.frinfo": {
      const out = context.spice.raw.frinfo(step.frameId);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return {
        op: step.op,
        value: {
          found: true,
          center: out.center,
          frameClass: out.frameClass,
          classId: out.classId,
        },
      };
    }

    case "frames.ccifrm": {
      const out = context.spice.raw.ccifrm(step.frameClass, step.classId);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return {
        op: step.op,
        value: {
          found: true,
          frcode: out.frcode,
          frname: out.frname,
          center: out.center,
        },
      };
    }

    case "frames.ckgp": {
      const out = context.spice.raw.ckgp(step.inst, step.sclkdp, step.tol, step.ref);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return {
        op: step.op,
        value: {
          found: true,
          cmat: unflattenMatrix(out.cmat),
          clkout: out.clkout,
        },
      };
    }

    case "frames.ckgpav": {
      const out = context.spice.raw.ckgpav(step.inst, step.sclkdp, step.tol, step.ref);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return {
        op: step.op,
        value: {
          found: true,
          cmat: unflattenMatrix(out.cmat),
          av: toVector3(out.av),
          clkout: out.clkout,
        },
      };
    }

    case "frames.cklpf": {
      const ck = ensureVirtualCkPath(context, canonicalizeFramesCkPath(context, step));
      const handle = context.spice.raw.cklpf(ck);
      setCkHandle(context, step.handleId, handle);
      return { op: step.op, value: { opened: true } };
    }

    case "frames.ckupf": {
      const handle = requireCkHandle(context, step.handleId);
      context.spice.raw.ckupf(handle);
      deleteCkHandle(context, step.handleId);
      return { op: step.op, value: { closed: true } };
    }

    case "frames.ckobj": {
      const ck = ensureVirtualCkPath(context, canonicalizeFramesCkPath(context, step));
      const ids = context.spice.kit.newIntCell(step.maxCard ?? 32);
      try {
        context.spice.raw.scard(0, ids);
        context.spice.raw.ckobj(ck, ids);

        const nIds = context.spice.raw.card(ids);
        const values: number[] = [];
        for (let index = 0; index < nIds; index += 1) {
          values.push(context.spice.kit.cellGeti(ids, index));
        }

        return {
          op: step.op,
          value: { ids: values },
        };
      } finally {
        context.spice.kit.freeCell(ids);
      }
    }

    case "frames.ckcov": {
      const ck = ensureVirtualCkPath(context, canonicalizeFramesCkPath(context, step));
      const cover = getOrCreateWindow(context, step.coverId, step.maxIntervals ?? 128);
      context.spice.raw.scard(0, cover);
      context.spice.raw.ckcov(
        ck,
        step.idcode,
        step.needav,
        step.level,
        step.tol,
        step.timsys,
        cover,
      );

      const nIntervals = context.spice.raw.wncard(cover);
      const intervals: Array<{ left: number; right: number }> = [];
      for (let index = 0; index < nIntervals; index += 1) {
        const [left, right] = context.spice.raw.wnfetd(cover, index);
        intervals.push({ left, right });
      }

      return {
        op: step.op,
        value: { intervals },
      };
    }

    case "frames.pxform": {
      const matrix = context.spice.raw.pxform(step.from, step.to, step.et);
      return { op: step.op, value: unflattenMatrix(matrix) };
    }

    case "frames.sxform": {
      const matrix = context.spice.raw.sxform(step.from, step.to, step.et);
      return { op: step.op, value: toMatrix6x6(matrix) };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled frames step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
