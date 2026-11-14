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
  StepFramesPckcls,
  StepFramesPckcov,
  StepFramesPckfrm,
  StepFramesPcklof,
  StepFramesPckopn,
  StepFramesPckuof,
  StepFramesPckw02,
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
import {
  resolvePathRef,
  toPathRef,
  toVirtualKernelPath,
} from "../../fixtures.js";
import {
  getOrCreateIntCell,
  getOrCreateWindow,
  registerFinalizer,
  type RunTspiceContext,
} from "../context.js";
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
  | StepFramesPckcls
  | StepFramesPckcov
  | StepFramesPckfrm
  | StepFramesPcklof
  | StepFramesPckopn
  | StepFramesPckuof
  | StepFramesPckw02
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

function canonicalizeFramesCkPath(
  context: RunTspiceContext,
  step: FramesCkPathStep,
): PathRef {
  const canonical = toPathRef(step.ck);

  for (const hint of context.normalization.metadata.runtimePath
    .canonicalizationHints) {
    if (
      hint.domain !== "frames" ||
      hint.op !== step.op ||
      hint.field !== "ck"
    ) {
      continue;
    }

    if (pathRefsEqual(hint.canonicalPath, canonical)) {
      return hint.canonicalPath;
    }
  }

  return canonical;
}

function ensureVirtualFramePath(
  context: RunTspiceContext,
  pathRef: PathRefLike,
): string {
  const virtualPath = toVirtualKernelPath(pathRef);
  if (!context.state.frames.stagedVirtualKernelPaths.has(virtualPath)) {
    const resolvedPath = resolvePathRef(context.paths, pathRef);
    if (!fs.existsSync(resolvedPath)) return virtualPath;
    const bytes = fs.readFileSync(resolvedPath);

    // Stage fixture bytes once. Low-level CK and PCK loads control subsequent priority.
    context.spice.raw.furnsh({ path: virtualPath, bytes });
    context.spice.raw.unload(virtualPath);
    context.state.frames.stagedVirtualKernelPaths.add(virtualPath);
  }

  return virtualPath;
}

function setCkHandle(
  context: RunTspiceContext,
  handleId: string,
  handle: number,
): void {
  if (context.state.frames.ckHandles.has(handleId)) {
    throw new Error(`CK handle already exists: ${handleId}`);
  }
  context.state.frames.ckHandles.set(handleId, handle);
  registerFinalizer(context, `frames.ckupf:${handleId}`, () => {
    const tracked = context.state.frames.ckHandles.get(handleId);
    if (tracked === undefined) return;
    context.spice.raw.ckupf(tracked);
    context.state.frames.ckHandles.delete(handleId);
  });
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

  return [
    requiredNumber(values, 0),
    requiredNumber(values, 1),
    requiredNumber(values, 2),
  ];
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

function pckPath(context: RunTspiceContext, source: PathRefLike) {
  const ref = toPathRef(source);
  if (ref.kind === "scratch")
    return { kind: "virtual-output" as const, path: toVirtualKernelPath(ref) };
  return ensureVirtualFramePath(context, ref);
}

/** Execute one `frames.*` workflow step in tspice. */
export function runFramesStep(
  context: RunTspiceContext,
  step: FramesStep,
): StepOutput {
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
      const out = context.spice.raw.ckgp(
        step.inst,
        step.sclkdp,
        step.tol,
        step.ref,
      );
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
      const out = context.spice.raw.ckgpav(
        step.inst,
        step.sclkdp,
        step.tol,
        step.ref,
      );
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

    case "frames.pckopn":
    case "frames.pcklof": {
      const tracked = context.state.frames.pckHandles;
      if (tracked.has(step.handleId))
        throw new Error("PCK handle already registered");
      const file = pckPath(context, step.path);
      const writer = step.op === "frames.pckopn";
      const handle =
        step.op === "frames.pckopn"
          ? context.spice.raw.pckopn(file, step.ifname, step.ncomch)
          : context.spice.raw.pcklof(file);
      tracked.set(step.handleId, { handle, writer });
      registerFinalizer(context, `PCK:${step.handleId}`, () => {
        if (!tracked.has(step.handleId)) return;
        if (writer) context.spice.raw.pckcls(handle);
        else context.spice.raw.pckuof(handle);
        for (const [id, entry] of tracked)
          if (entry.handle === handle) tracked.delete(id);
      });
      return { op: step.op, value: { opened: true } };
    }
    case "frames.pckcls":
    case "frames.pckuof":
    case "frames.pckw02": {
      const tracked = context.state.frames.pckHandles;
      const entry = tracked.get(step.handleId);
      if (!entry) throw new Error("Missing PCK handle");
      if (step.op === "frames.pckw02") {
        context.spice.raw.pckw02(
          entry.handle,
          step.classId,
          step.frame,
          step.first,
          step.last,
          step.segid,
          step.intlen,
          step.n,
          step.degree,
          step.coefficients,
          step.btime,
        );
        return { op: step.op, value: null };
      }
      if (step.op === "frames.pckcls") context.spice.raw.pckcls(entry.handle);
      else context.spice.raw.pckuof(entry.handle);
      for (const [id, other] of tracked)
        if (other.handle === entry.handle) tracked.delete(id);
      return { op: step.op, value: { closed: true } };
    }
    case "frames.pckfrm": {
      const ids = getOrCreateIntCell(context, step.idsId, step.maxCard);
      if (step.reset) context.spice.raw.scard(0, ids);
      context.spice.raw.pckfrm(pckPath(context, step.path), ids);
      const values = Array.from(
        { length: context.spice.raw.card(ids) },
        (_, i) => context.spice.kit.cellGeti(ids, i),
      );
      return { op: step.op, value: { ids: values } };
    }
    case "frames.pckcov": {
      const cover = getOrCreateWindow(context, step.coverId, step.maxIntervals);
      if (step.reset) context.spice.raw.scard(0, cover);
      context.spice.raw.pckcov(
        pckPath(context, step.path),
        step.classId,
        cover,
      );
      const intervals = Array.from(
        { length: context.spice.raw.wncard(cover) },
        (_, i) => {
          const [left, right] = context.spice.raw.wnfetd(cover, i);
          return { left, right };
        },
      );
      return { op: step.op, value: { intervals } };
    }
    case "frames.cklpf": {
      if (context.state.frames.ckHandles.has(step.handleId))
        throw new Error(`CK handle already exists: ${step.handleId}`);
      const ck = ensureVirtualFramePath(
        context,
        canonicalizeFramesCkPath(context, step),
      );
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
      const ck = ensureVirtualFramePath(
        context,
        canonicalizeFramesCkPath(context, step),
      );
      const ids = getOrCreateIntCell(context, step.idsId, step.maxCard ?? 32);
      if (step.reset ?? true) context.spice.raw.scard(0, ids);
      context.spice.raw.ckobj(ck, ids);
      const values: number[] = [];
      for (let index = 0; index < context.spice.raw.card(ids); index++)
        values.push(context.spice.kit.cellGeti(ids, index));
      return { op: step.op, value: { ids: values } };
    }

    case "frames.ckcov": {
      const ck = ensureVirtualFramePath(
        context,
        canonicalizeFramesCkPath(context, step),
      );
      const cover = getOrCreateWindow(
        context,
        step.coverId,
        step.maxIntervals ?? 128,
      );
      if (step.reset ?? true) context.spice.raw.scard(0, cover);
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
