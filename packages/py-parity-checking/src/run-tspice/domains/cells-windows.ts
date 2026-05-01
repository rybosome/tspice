import type {
  CellsWindowsTargetKind,
  StepCellsWindowsCard,
  StepCellsWindowsInsrtc,
  StepCellsWindowsInsrtd,
  StepCellsWindowsInsrti,
  StepCellsWindowsScard,
  StepCellsWindowsSize,
  StepCellsWindowsSsize,
  StepCellsWindowsValid,
  StepCellsWindowsWncard,
  StepCellsWindowsWnfetd,
  StepCellsWindowsWninsd,
  StepCellsWindowsWnvald,
  StepOutput,
} from "../../case-types.js";
import {
  getOrCreateCharCell,
  getOrCreateDoubleCell,
  getOrCreateIntCell,
  getOrCreateWindow,
  requireCharCell,
  requireDoubleCell,
  requireIntCell,
  requireWindow,
  type RunTspiceContext,
} from "../context.js";

type CellsWindowsStep =
  | StepCellsWindowsCard
  | StepCellsWindowsInsrtc
  | StepCellsWindowsInsrtd
  | StepCellsWindowsInsrti
  | StepCellsWindowsScard
  | StepCellsWindowsSize
  | StepCellsWindowsSsize
  | StepCellsWindowsValid
  | StepCellsWindowsWncard
  | StepCellsWindowsWninsd
  | StepCellsWindowsWnfetd
  | StepCellsWindowsWnvald;

function requireTarget(
  context: RunTspiceContext,
  targetKind: CellsWindowsTargetKind,
  targetId: string,
) {
  switch (targetKind) {
    case "int":
      return requireIntCell(context, targetId);
    case "double":
      return requireDoubleCell(context, targetId);
    case "char":
      return requireCharCell(context, targetId);
    case "window":
      return requireWindow(context, targetId);
    default: {
      const exhaustive: never = targetKind;
      throw new Error(`Unsupported cells-windows targetKind: ${exhaustive}`);
    }
  }
}

/** Execute one `cells-windows.*` workflow step in tspice. */
export function runCellsWindowsStep(
  context: RunTspiceContext,
  step: CellsWindowsStep,
): StepOutput {
  switch (step.op) {
    case "cells-windows.card": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      const value = context.spice.raw.card(target);
      return { op: step.op, value };
    }

    case "cells-windows.insrtc": {
      const cell = getOrCreateCharCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
        step.length ?? 32,
      );
      context.spice.raw.insrtc(step.item, cell);
      return { op: step.op, value: null };
    }

    case "cells-windows.insrtd": {
      const cell = getOrCreateDoubleCell(context, step.cellId, step.maxCardinality ?? 8);
      context.spice.raw.insrtd(step.item, cell);
      return { op: step.op, value: null };
    }

    case "cells-windows.insrti": {
      const cell = getOrCreateIntCell(context, step.cellId, step.maxCardinality ?? 8);
      context.spice.raw.insrti(step.item, cell);
      return { op: step.op, value: null };
    }

    case "cells-windows.scard": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      context.spice.raw.scard(step.card, target);
      return { op: step.op, value: null };
    }

    case "cells-windows.size": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      const value = context.spice.raw.size(target);
      return { op: step.op, value };
    }

    case "cells-windows.ssize": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      context.spice.raw.ssize(step.size, target);
      return { op: step.op, value: null };
    }

    case "cells-windows.valid": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      context.spice.raw.valid(step.size, step.n, target);
      return { op: step.op, value: null };
    }

    case "cells-windows.wncard": {
      const window = requireWindow(context, step.windowId);
      const value = context.spice.raw.wncard(window);
      return { op: step.op, value };
    }

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

    case "cells-windows.wnvald": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.wnvald(step.size, step.n, window);
      return { op: step.op, value: null };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled cells-windows step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
