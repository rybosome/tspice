import fs from "node:fs";
import { resolvePathRef, toVirtualKernelPath } from "../../fixtures.js";
import type {
  KernelPoolFoundNumbers,
  KernelPoolFoundStrings,
  StepKernelPoolCvpool,
  StepKernelPoolDtpool,
  StepKernelPoolExpool,
  StepKernelPoolGcpool,
  StepKernelPoolBadkpv,
  StepKernelPoolBodvcd,
  StepKernelPoolBodvrd,
  StepKernelPoolClpool,
  StepKernelPoolDvpool,
  StepKernelPoolLdpool,
  StepKernelPoolLmpool,
  StepKernelPoolStpool,
  StepKernelPoolSzpool,
  StepKernelPoolGdpool,
  StepKernelPoolGipool,
  StepKernelPoolGnpool,
  StepKernelPoolPcpool,
  StepKernelPoolPdpool,
  StepKernelPoolPipool,
  StepKernelPoolSwpool,
  StepOutput,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type KernelPoolStep =
  | StepKernelPoolBadkpv
  | StepKernelPoolBodvcd
  | StepKernelPoolBodvrd
  | StepKernelPoolClpool
  | StepKernelPoolDvpool
  | StepKernelPoolLdpool
  | StepKernelPoolLmpool
  | StepKernelPoolStpool
  | StepKernelPoolSzpool
  | StepKernelPoolGdpool
  | StepKernelPoolGipool
  | StepKernelPoolGcpool
  | StepKernelPoolGnpool
  | StepKernelPoolDtpool
  | StepKernelPoolPdpool
  | StepKernelPoolPipool
  | StepKernelPoolPcpool
  | StepKernelPoolSwpool
  | StepKernelPoolCvpool
  | StepKernelPoolExpool;

function normalizeFoundNumbers(
  out: { found: false } | { found: true; values: number[] },
): KernelPoolFoundNumbers {
  if (!out.found) {
    return { found: false };
  }

  return { found: true, values: out.values };
}

function normalizeFoundStrings(
  out: { found: false } | { found: true; values: string[] },
): KernelPoolFoundStrings {
  if (!out.found) {
    return { found: false };
  }

  return { found: true, values: out.values };
}

/** Execute one `kernel-pool.*` workflow step in tspice. */
export function runKernelPoolStep(
  context: RunTspiceContext,
  step: KernelPoolStep,
): StepOutput {
  switch (step.op) {
    case "kernel-pool.badkpv":
      return {
        op: step.op,
        value: context.spice.raw.badkpv(
          step.caller,
          step.name,
          step.comp,
          step.size,
          step.divby,
          step.type,
        ),
      };

    case "kernel-pool.bodvcd":
      return {
        op: step.op,
        value: context.spice.raw.bodvcd(step.body, step.item, step.maxn),
      };

    case "kernel-pool.bodvrd":
      return {
        op: step.op,
        value: context.spice.raw.bodvrd(step.body, step.item, step.maxn),
      };

    case "kernel-pool.clpool":
      context.spice.raw.clpool();
      return { op: step.op, value: null };

    case "kernel-pool.dvpool":
      context.spice.raw.dvpool(step.name);
      return { op: step.op, value: null };

    case "kernel-pool.ldpool": {
      const physical = resolvePathRef(context.paths, step.file);
      const path = toVirtualKernelPath(step.file);
      // A byte source stages the exact fixture for this pool-only load on both
      // backends without a preceding furnsh or an entry in KEEPER.
      context.spice.raw.ldpool(
        fs.existsSync(physical)
          ? { path, bytes: fs.readFileSync(physical) }
          : path,
      );
      return { op: step.op, value: null };
    }

    case "kernel-pool.lmpool":
      context.spice.raw.lmpool(step.lines);
      return { op: step.op, value: null };

    case "kernel-pool.stpool":
      return {
        op: step.op,
        value: context.spice.raw.stpool(
          step.item,
          step.nth,
          step.contin,
          step.lenout,
        ),
      };

    case "kernel-pool.szpool":
      return { op: step.op, value: context.spice.raw.szpool(step.name) };

    case "kernel-pool.gdpool":
      return {
        op: step.op,
        value: normalizeFoundNumbers(
          context.spice.raw.gdpool(step.name, step.start, step.room),
        ),
      };

    case "kernel-pool.gipool":
      return {
        op: step.op,
        value: normalizeFoundNumbers(
          context.spice.raw.gipool(step.name, step.start, step.room),
        ),
      };

    case "kernel-pool.gcpool":
      return {
        op: step.op,
        value: normalizeFoundStrings(
          context.spice.raw.gcpool(step.name, step.start, step.room),
        ),
      };

    case "kernel-pool.gnpool":
      return {
        op: step.op,
        value: normalizeFoundStrings(
          context.spice.raw.gnpool(step.template, step.start, step.room),
        ),
      };

    case "kernel-pool.dtpool": {
      const out = context.spice.raw.dtpool(step.name);
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }

      return {
        op: step.op,
        value: {
          found: true,
          n: out.n,
          type: out.type,
        },
      };
    }

    case "kernel-pool.pdpool":
      context.spice.raw.pdpool(step.name, step.values);
      return { op: step.op, value: null };

    case "kernel-pool.pipool":
      context.spice.raw.pipool(step.name, step.values);
      return { op: step.op, value: null };

    case "kernel-pool.pcpool":
      context.spice.raw.pcpool(step.name, step.values);
      return { op: step.op, value: null };

    case "kernel-pool.swpool":
      context.spice.raw.swpool(step.agent, step.names);
      return { op: step.op, value: null };

    case "kernel-pool.cvpool":
      return { op: step.op, value: context.spice.raw.cvpool(step.agent) };

    case "kernel-pool.expool":
      return { op: step.op, value: context.spice.raw.expool(step.name) };

    default: {
      const exhaustive: never = step;
      throw new Error(
        `Unhandled kernel-pool step: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}
