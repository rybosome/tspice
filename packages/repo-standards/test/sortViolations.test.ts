import { describe, expect, it } from "vitest";

import { sortViolations } from "../src/reporting/sortViolations.js";
import type { Violation } from "../src/engine/types.js";

describe("sortViolations", () => {
  it("sorts deterministically by rule/package/location/message", () => {
    const unsorted: Violation[] = [
      {
        ruleId: "b",
        packageRoot: "pkg",
        message: "m2",
        location: { filePath: "b.ts", line: 2, col: 1 }
      },
      {
        ruleId: "a",
        packageRoot: "pkg",
        message: "m1",
        location: { filePath: "a.ts", line: 1, col: 1 }
      },
      {
        ruleId: "a",
        packageRoot: "pkg",
        message: "m0",
        location: { callId: "x.y" }
      }
    ];

    expect(sortViolations(unsorted).map((v) => v.message)).toEqual(["m0", "m1", "m2"]);
  });
});
