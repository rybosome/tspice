import type { StepCellsWindowsWnfetd, StepCellsWindowsWninsd, StepOutput } from "../../case-types.js";
import { getOrCreateWindow, requireWindow, type RunTspiceContext } from "../context.js";

type CellsWindowsStep = StepCellsWindowsWninsd | StepCellsWindowsWnfetd;

/** Execute one `cells-windows.*` workflow step in tspice. */
export function runCellsWindowsStep(
  context: RunTspiceContext,
  step: CellsWindowsStep,
): StepOutput {
  switch (step.op) {
    case "cells-windows.wninsd": {
      const window = getOrCreateWindow(context, step.windowId, step.maxIntervals ?? 8);
      context.spice.raw.wninsd(step.left, step.right, window);
      return { op: step.op, value: null };
    }

    case "cells-windows.wnfetd": {
      const window = requireWindow(context, step.windowId);
      const [left, right] = context.spice.raw.wnfetd(window, step.index);
      return { op: step.op, value: { left, right } };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled cells-windows step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
