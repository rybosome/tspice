import type {
  CellsWindowsTargetKind,
  StepCellsWindowsCard,
  StepCellsWindowsAppndc,
  StepCellsWindowsAppndd,
  StepCellsWindowsAppndi,
  StepCellsWindowsCopy,
  StepCellsWindowsElemc,
  StepCellsWindowsElemd,
  StepCellsWindowsElemi,
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
  StepCellsWindowsWncomd,
  StepCellsWindowsWncond,
  StepCellsWindowsWndifd,
  StepCellsWindowsWnelmd,
  StepCellsWindowsWnexpd,
  StepCellsWindowsWnextd,
  StepCellsWindowsWnfild,
  StepCellsWindowsWnfltd,
  StepCellsWindowsWnincd,
  StepCellsWindowsWnintd,
  StepCellsWindowsWnreld,
  StepCellsWindowsWnsumd,
  StepCellsWindowsWnunid,
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
  | StepCellsWindowsAppndc
  | StepCellsWindowsAppndd
  | StepCellsWindowsAppndi
  | StepCellsWindowsCopy
  | StepCellsWindowsElemc
  | StepCellsWindowsElemd
  | StepCellsWindowsElemi
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
  | StepCellsWindowsWncomd
  | StepCellsWindowsWncond
  | StepCellsWindowsWndifd
  | StepCellsWindowsWnelmd
  | StepCellsWindowsWnexpd
  | StepCellsWindowsWnextd
  | StepCellsWindowsWnfild
  | StepCellsWindowsWnfltd
  | StepCellsWindowsWnincd
  | StepCellsWindowsWnintd
  | StepCellsWindowsWnreld
  | StepCellsWindowsWnsumd
  | StepCellsWindowsWnunid
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

function snapshotWindow(
  context: RunTspiceContext,
  window: ReturnType<typeof requireWindow>,
) {
  return Array.from(
    { length: context.spice.raw.wncard(window) },
    (_, index) => {
      const [left, right] = context.spice.raw.wnfetd(window, index);
      return { left, right };
    },
  );
}

function snapshotSet(
  context: RunTspiceContext,
  kind: CellsWindowsTargetKind,
  id: string,
): number[] | string[] | null {
  const { raw, kit } = context.spice;
  switch (kind) {
    case "int": {
      const cell = requireIntCell(context, id);
      return Array.from({ length: raw.card(cell) }, (_, i) =>
        kit.cellGeti(cell, i),
      );
    }
    case "double": {
      const cell = requireDoubleCell(context, id);
      return Array.from({ length: raw.card(cell) }, (_, i) =>
        kit.cellGetd(cell, i),
      );
    }
    case "char": {
      const cell = requireCharCell(context, id);
      return Array.from({ length: raw.card(cell) }, (_, i) =>
        kit.cellGetc(cell, i),
      );
    }
    // A DP cell used as a set need not be a valid interval window. Window
    // effects are inspected through wnvald/wnfetd instead of unsafe rebranding.
    case "window":
      return null;
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

    case "cells-windows.appndc": {
      const cell = getOrCreateCharCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
        step.length ?? 32,
      );
      context.spice.raw.appndc(step.item, cell);
      return {
        op: step.op,
        value: Array.from({ length: context.spice.raw.card(cell) }, (_, i) =>
          context.spice.kit.cellGetc(cell, i),
        ),
      };
    }
    case "cells-windows.appndd": {
      const cell = getOrCreateDoubleCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
      );
      context.spice.raw.appndd(step.item, cell);
      return {
        op: step.op,
        value: Array.from({ length: context.spice.raw.card(cell) }, (_, i) =>
          context.spice.kit.cellGetd(cell, i),
        ),
      };
    }
    case "cells-windows.appndi": {
      const cell = getOrCreateIntCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
      );
      context.spice.raw.appndi(step.item, cell);
      return {
        op: step.op,
        value: Array.from({ length: context.spice.raw.card(cell) }, (_, i) =>
          context.spice.kit.cellGeti(cell, i),
        ),
      };
    }
    case "cells-windows.copy": {
      switch (step.kind) {
        case "int": {
          const source = requireIntCell(context, step.sourceId);
          const target = getOrCreateIntCell(
            context,
            step.resultId,
            step.maxCardinality ?? 8,
          );
          context.spice.raw.copy(source, target);
          return {
            op: step.op,
            value: Array.from(
              { length: context.spice.raw.card(target) },
              (_, i) => context.spice.kit.cellGeti(target, i),
            ),
          };
        }
        case "double": {
          const source = requireDoubleCell(context, step.sourceId);
          const target = getOrCreateDoubleCell(
            context,
            step.resultId,
            step.maxCardinality ?? 8,
          );
          context.spice.raw.copy(source, target);
          return {
            op: step.op,
            value: Array.from(
              { length: context.spice.raw.card(target) },
              (_, i) => context.spice.kit.cellGetd(target, i),
            ),
          };
        }
        case "char": {
          const source = requireCharCell(context, step.sourceId);
          const target = getOrCreateCharCell(
            context,
            step.resultId,
            step.maxCardinality ?? 8,
            step.length ?? 32,
          );
          context.spice.raw.copy(source, target);
          return {
            op: step.op,
            value: Array.from(
              { length: context.spice.raw.card(target) },
              (_, i) => context.spice.kit.cellGetc(target, i),
            ),
          };
        }
        default: {
          const unexpected: never = step.kind;
          throw new Error(`Unknown cell copy kind: ${String(unexpected)}`);
        }
      }
    }
    case "cells-windows.elemc": {
      const cell = getOrCreateCharCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
        step.length ?? 32,
      );
      return { op: step.op, value: context.spice.raw.elemc(step.item, cell) };
    }
    case "cells-windows.elemd": {
      const cell = getOrCreateDoubleCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
      );
      return { op: step.op, value: context.spice.raw.elemd(step.item, cell) };
    }
    case "cells-windows.elemi": {
      const cell = getOrCreateIntCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
      );
      return { op: step.op, value: context.spice.raw.elemi(step.item, cell) };
    }
    case "cells-windows.insrtc": {
      const cell = getOrCreateCharCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
        step.length ?? 32,
      );
      context.spice.raw.insrtc(step.item, cell);
      return {
        op: step.op,
        value: Array.from({ length: context.spice.raw.card(cell) }, (_, i) =>
          context.spice.kit.cellGetc(cell, i),
        ),
      };
    }

    case "cells-windows.insrtd": {
      const cell = getOrCreateDoubleCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
      );
      context.spice.raw.insrtd(step.item, cell);
      return {
        op: step.op,
        value: Array.from({ length: context.spice.raw.card(cell) }, (_, i) =>
          context.spice.kit.cellGetd(cell, i),
        ),
      };
    }

    case "cells-windows.insrti": {
      const cell = getOrCreateIntCell(
        context,
        step.cellId,
        step.maxCardinality ?? 8,
      );
      context.spice.raw.insrti(step.item, cell);
      return {
        op: step.op,
        value: Array.from({ length: context.spice.raw.card(cell) }, (_, i) =>
          context.spice.kit.cellGeti(cell, i),
        ),
      };
    }

    case "cells-windows.scard": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      context.spice.raw.scard(step.card, target);
      return { op: step.op, value: context.spice.raw.card(target) };
    }

    case "cells-windows.size": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      const value = context.spice.raw.size(target);
      return { op: step.op, value };
    }

    case "cells-windows.ssize": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      context.spice.raw.ssize(step.size, target);
      return {
        op: step.op,
        value: {
          size: context.spice.raw.size(target),
          card: context.spice.raw.card(target),
        },
      };
    }

    case "cells-windows.valid": {
      const target = requireTarget(context, step.targetKind, step.targetId);
      context.spice.raw.valid(step.size, step.n, target);
      return {
        op: step.op,
        value: snapshotSet(context, step.targetKind, step.targetId),
      };
    }

    case "cells-windows.wncard": {
      const window = requireWindow(context, step.windowId);
      const value = context.spice.raw.wncard(window);
      return { op: step.op, value };
    }

    case "cells-windows.wninsd": {
      const window = getOrCreateWindow(
        context,
        step.windowId,
        step.maxIntervals ?? 8,
      );
      context.spice.raw.wninsd(step.left, step.right, window);
      return { op: step.op, value: null };
    }

    case "cells-windows.wnfetd": {
      const window = requireWindow(context, step.windowId);
      const [left, right] = context.spice.raw.wnfetd(window, step.index);
      return { op: step.op, value: { left, right } };
    }

    case "cells-windows.wncomd": {
      const window = requireWindow(context, step.windowId);
      const result = getOrCreateWindow(
        context,
        step.resultId,
        step.maxIntervals,
      );
      context.spice.raw.wncomd(step.left, step.right, window, result);
      return { op: step.op, value: snapshotWindow(context, result) };
    }

    case "cells-windows.wncond": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.wncond(step.left, step.right, window);
      return { op: step.op, value: snapshotWindow(context, window) };
    }

    case "cells-windows.wndifd": {
      const a = requireWindow(context, step.aId);
      const b = requireWindow(context, step.bId);
      const result = getOrCreateWindow(
        context,
        step.resultId,
        step.maxIntervals,
      );
      context.spice.raw.wndifd(a, b, result);
      return { op: step.op, value: snapshotWindow(context, result) };
    }

    case "cells-windows.wnelmd": {
      const window = requireWindow(context, step.windowId);
      return {
        op: step.op,
        value: context.spice.raw.wnelmd(step.point, window),
      };
    }

    case "cells-windows.wnexpd": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.wnexpd(step.left, step.right, window);
      return { op: step.op, value: snapshotWindow(context, window) };
    }

    case "cells-windows.wnextd": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.wnextd(step.side, window);
      return { op: step.op, value: snapshotWindow(context, window) };
    }

    case "cells-windows.wnfild": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.wnfild(step.small, window);
      return { op: step.op, value: snapshotWindow(context, window) };
    }

    case "cells-windows.wnfltd": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.wnfltd(step.small, window);
      return { op: step.op, value: snapshotWindow(context, window) };
    }

    case "cells-windows.wnincd": {
      const window = requireWindow(context, step.windowId);
      return {
        op: step.op,
        value: context.spice.raw.wnincd(step.left, step.right, window),
      };
    }

    case "cells-windows.wnintd": {
      const a = requireWindow(context, step.aId);
      const b = requireWindow(context, step.bId);
      const result = getOrCreateWindow(
        context,
        step.resultId,
        step.maxIntervals,
      );
      context.spice.raw.wnintd(a, b, result);
      return { op: step.op, value: snapshotWindow(context, result) };
    }

    case "cells-windows.wnreld": {
      const a = requireWindow(context, step.aId);
      const b = requireWindow(context, step.bId);
      return {
        op: step.op,
        value: context.spice.raw.wnreld(a, step.relation, b),
      };
    }

    case "cells-windows.wnsumd": {
      const window = requireWindow(context, step.windowId);
      return { op: step.op, value: context.spice.raw.wnsumd(window) };
    }

    case "cells-windows.wnunid": {
      const a = requireWindow(context, step.aId);
      const b = requireWindow(context, step.bId);
      const result = getOrCreateWindow(
        context,
        step.resultId,
        step.maxIntervals,
      );
      context.spice.raw.wnunid(a, b, result);
      return { op: step.op, value: snapshotWindow(context, result) };
    }

    case "cells-windows.wnvald": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.wnvald(step.size, step.n, window);
      return {
        op: step.op,
        value: snapshotWindow(context, window),
      };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(
        `Unhandled cells-windows step: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}
