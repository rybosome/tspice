import type { ParityCase } from "../case-types.js";

export const cellsWindowsCases: ParityCase[] = [
  {
    caseId: "cells-windows-wninsd-wnfetd-success",
    description: "Stateful wninsd -> wnfetd workflow",
    workflow: [
      { op: "cells-windows.wninsd", windowId: "W1", left: 1, right: 2, maxIntervals: 8 },
      { op: "cells-windows.wninsd", windowId: "W1", left: 5, right: 6 },
      { op: "cells-windows.wnfetd", windowId: "W1", index: 0 },
      { op: "cells-windows.wnfetd", windowId: "W1", index: 1 },
    ],
    expectation: { kind: "success" },
  },
  {
    caseId: "cells-windows-wnfetd-out-of-range-error",
    description: "Representative wnfetd bounds error",
    workflow: [
      { op: "cells-windows.wninsd", windowId: "WERR", left: 1, right: 2, maxIntervals: 4 },
      { op: "cells-windows.wnfetd", windowId: "WERR", index: 4 },
    ],
    expectation: { kind: "error" },
  },
];
