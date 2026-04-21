import type { StepOutput, WorkflowStep } from "../case-types.js";
import type { RunTspiceContext } from "./context.js";
import { runCellsWindowsStep } from "./domains/cells-windows.js";
import { runCoordsVectorsStep } from "./domains/coords-vectors.js";
import { runEkStep } from "./domains/ek.js";
import { runIdsNamesStep } from "./domains/ids-names.js";
import { runKernelPoolStep } from "./domains/kernel-pool.js";
import { runKernelsStep } from "./domains/kernels.js";
import { runTimeStep } from "./domains/time.js";

/** Dispatch one workflow step to its corresponding tspice domain handler. */
export function dispatchStep(context: RunTspiceContext, step: WorkflowStep): StepOutput {
  switch (step.op) {
    case "time.str2et":
    case "time.et2utc":
    case "time.tkvrsn":
    case "time.timout":
    case "time.deltet":
    case "time.unitim":
    case "time.tparse":
    case "time.tpictr":
    case "time.timdef":
    case "time.scs2e":
    case "time.sce2s":
    case "time.scencd":
    case "time.scdecd":
    case "time.sct2e":
    case "time.sce2c":
      return runTimeStep(context, step);

    case "ids-names.bodn2c":
      return runIdsNamesStep(context, step);

    case "coords-vectors.mxm":
    case "coords-vectors.recgeo":
      return runCoordsVectorsStep(context, step);

    case "cells-windows.wninsd":
    case "cells-windows.wnfetd":
      return runCellsWindowsStep(context, step);

    case "kernel-pool.gdpool":
    case "kernel-pool.gipool":
    case "kernel-pool.gcpool":
    case "kernel-pool.gnpool":
    case "kernel-pool.dtpool":
    case "kernel-pool.pdpool":
    case "kernel-pool.pipool":
    case "kernel-pool.pcpool":
    case "kernel-pool.swpool":
    case "kernel-pool.cvpool":
    case "kernel-pool.expool":
      return runKernelPoolStep(context, step);

    case "kernels.furnsh":
    case "kernels.ktotal":
    case "kernels.kdata":
    case "kernels.kxtrct":
      return runKernelsStep(context, step);

    case "ek.ekfind":
    case "ek.ekgc":
      return runEkStep(context, step);

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
