import path from "node:path";

import type {
  StepEkEkaclc,
  StepEkEkacld,
  StepEkEkacli,
  StepEkEkcls,
  StepEkEkgc,
  StepEkEkgd,
  StepEkEkffld,
  StepEkEkfind,
  StepEkEkgi,
  StepEkEkifld,
  StepEkEknseg,
  StepEkEkntab,
  StepEkEkopn,
  StepEkEkopr,
  StepEkEkopw,
  StepEkEktnam,
  StepOutput,
} from "../../case-types.js";
import { toVirtualKernelPath } from "../../fixtures.js";
import {
  closeEkHandle,
  registerEkHandle,
  registerEkSegment,
  requireEkHandle,
  requireEkSegment,
  type RunTspiceContext,
} from "../context.js";
import { normalizePathRefRelativePath } from "../../runtime/path-ref.js";

type EkStep =
  | StepEkEkopn
  | StepEkEkopr
  | StepEkEkopw
  | StepEkEkcls
  | StepEkEkntab
  | StepEkEktnam
  | StepEkEknseg
  | StepEkEkfind
  | StepEkEkgc
  | StepEkEkgd
  | StepEkEkgi
  | StepEkEkifld
  | StepEkEkacli
  | StepEkEkacld
  | StepEkEkaclc
  | StepEkEkffld;

function resolveEkPath(rawPath: string): string {
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return toVirtualKernelPath({
    kind: "scratch",
    rel: normalizePathRefRelativePath(rawPath),
  });
}

/** Execute one `ek.*` workflow step in tspice. */
export function runEkStep(context: RunTspiceContext, step: EkStep): StepOutput {
  switch (step.op) {
    case "ek.ekopn": {
      const handle = context.spice.raw.ekopn(resolveEkPath(step.path), step.ifname, step.ncomch);
      registerEkHandle(context, step.handleId, handle);
      return { op: step.op, value: { handleId: step.handleId } };
    }

    case "ek.ekopr": {
      const handle = context.spice.raw.ekopr(resolveEkPath(step.path));
      registerEkHandle(context, step.handleId, handle);
      return { op: step.op, value: { handleId: step.handleId } };
    }

    case "ek.ekopw": {
      const handle = context.spice.raw.ekopw(resolveEkPath(step.path));
      registerEkHandle(context, step.handleId, handle);
      return { op: step.op, value: { handleId: step.handleId } };
    }

    case "ek.ekcls":
      closeEkHandle(context, step.handleId);
      return { op: step.op, value: null };

    case "ek.ekntab":
      return { op: step.op, value: context.spice.raw.ekntab() };

    case "ek.ektnam":
      return { op: step.op, value: context.spice.raw.ektnam(step.n) };

    case "ek.eknseg": {
      const handle = requireEkHandle(context, step.handleId);
      return { op: step.op, value: context.spice.raw.eknseg(handle) };
    }

    case "ek.ekfind":
      context.state.ek.lastQuery = step.query;
      return { op: step.op, value: context.spice.raw.ekfind(step.query) };

    case "ek.ekgc":
      return { op: step.op, value: context.spice.raw.ekgc(step.selidx, step.row, step.elment) };

    case "ek.ekgd":
      return { op: step.op, value: context.spice.raw.ekgd(step.selidx, step.row, step.elment) };

    case "ek.ekgi":
      return { op: step.op, value: context.spice.raw.ekgi(step.selidx, step.row, step.elment) };

    case "ek.ekifld": {
      const handle = requireEkHandle(context, step.handleId);
      const out = context.spice.raw.ekifld(handle, step.tabnam, step.nrows, step.cnames, step.decls);
      registerEkSegment(context, step.segmentId, {
        handleId: step.handleId,
        segno: out.segno,
        rcptrs: [...out.rcptrs],
      });
      return { op: step.op, value: { segmentId: step.segmentId } };
    }

    case "ek.ekacli": {
      const segment = requireEkSegment(context, step.segmentId);
      const handle = requireEkHandle(context, segment.handleId);
      context.spice.raw.ekacli(
        handle,
        segment.segno,
        step.column,
        step.ivals,
        step.entszs,
        step.nlflgs,
        segment.rcptrs,
      );
      return { op: step.op, value: null };
    }

    case "ek.ekacld": {
      const segment = requireEkSegment(context, step.segmentId);
      const handle = requireEkHandle(context, segment.handleId);
      context.spice.raw.ekacld(
        handle,
        segment.segno,
        step.column,
        step.dvals,
        step.entszs,
        step.nlflgs,
        segment.rcptrs,
      );
      return { op: step.op, value: null };
    }

    case "ek.ekaclc": {
      const segment = requireEkSegment(context, step.segmentId);
      const handle = requireEkHandle(context, segment.handleId);
      context.spice.raw.ekaclc(
        handle,
        segment.segno,
        step.column,
        step.cvals,
        step.entszs,
        step.nlflgs,
        segment.rcptrs,
      );
      return { op: step.op, value: null };
    }

    case "ek.ekffld": {
      const segment = requireEkSegment(context, step.segmentId);
      const handle = requireEkHandle(context, segment.handleId);
      context.spice.raw.ekffld(handle, segment.segno, segment.rcptrs);
      return { op: step.op, value: null };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled ek step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
