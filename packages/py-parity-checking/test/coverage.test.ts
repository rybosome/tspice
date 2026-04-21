import { describe, expect, it } from "vitest";

import contractMethodsRaw from "../../parity-checking/catalogs/contract-methods.json" with { type: "json" };
import { allCases } from "../src/cases/index.js";
import { canonicalRawMethods } from "../src/generated/canonical-raw-methods.js";

const contractMethods = contractMethodsRaw as string[];

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

describe("canonical raw coverage", () => {
  it("generated canonical method list matches parity contract catalog", () => {
    expect([...canonicalRawMethods]).toEqual(contractMethods);
  });

  it("parity case corpus covers every canonical raw method key", () => {
    const coveredOps = uniqueSorted(
      allCases.flatMap((parityCase) => parityCase.workflow.map((step) => step.op)),
    );

    const expected = uniqueSorted([...canonicalRawMethods]);
    expect(coveredOps).toEqual(expected);
  });
});
