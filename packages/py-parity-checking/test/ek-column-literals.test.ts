import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import type { CaseExecutionResult } from "../src/case-types.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixturesRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const expected: Record<string, readonly unknown[]> = {
  "ek-ekaclc-audit-single-character-slots": [
    { found: true, isNull: false, value: "A" },
    { found: true, isNull: false, value: "B" },
    { found: false },
    { found: true, isNull: false, value: "C" },
    { found: true, isNull: false, value: "D" },
    { found: false },
    { found: true, isNull: false, value: "E" },
    { found: true, isNull: false, value: "F" },
    { found: false },
  ],
  "ek-ekacli-audit-fixed-vectors-and-null": [
    {
      found: true,
      isNull: false,
      value: -7,
    },
    {
      found: true,
      isNull: false,
      value: 8,
    },
    {
      found: false,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: false,
      value: 77,
    },
    {
      found: true,
      isNull: false,
      value: -99,
    },
    {
      found: false,
    },
  ],
  "ek-ekacli-audit-variable-vectors-and-null": [
    {
      found: true,
      isNull: false,
      value: -7,
    },
    {
      found: true,
      isNull: false,
      value: 8,
    },
    {
      found: false,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: false,
      value: 77,
    },
    {
      found: false,
    },
    {
      found: false,
    },
  ],
  "ek-ekacli-audit-all-null-variable": [
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
  ],
  "ek-ekacld-audit-fixed-vectors-and-null": [
    {
      found: true,
      isNull: false,
      value: -7.25,
    },
    {
      found: true,
      isNull: false,
      value: 8.5,
    },
    {
      found: false,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: false,
      value: 77.75,
    },
    {
      found: true,
      isNull: false,
      value: -99.125,
    },
    {
      found: false,
    },
  ],
  "ek-ekacld-audit-variable-vectors-and-null": [
    {
      found: true,
      isNull: false,
      value: -3.25,
    },
    {
      found: true,
      isNull: false,
      value: 2000000,
    },
    {
      found: false,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: false,
      value: -1e-7,
    },
    {
      found: false,
    },
    {
      found: false,
    },
  ],
  "ek-ekacld-audit-all-null-variable": [
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
  ],
  "ek-ekaclc-audit-fixed-vectors-and-null": [
    {
      found: true,
      isNull: false,
      value: "  first",
    },
    {
      found: true,
      isNull: false,
      value: "µmoon",
    },
    {
      found: false,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: false,
      value: "last",
    },
    {
      found: true,
      isNull: false,
      value: "",
    },
    {
      found: false,
    },
  ],
  "ek-ekaclc-audit-variable-vectors-and-null": [
    {
      found: true,
      isNull: false,
      value: "  first",
    },
    {
      found: true,
      isNull: false,
      value: "µmoon",
    },
    {
      found: false,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: false,
      value: "last",
    },
    {
      found: false,
    },
    {
      found: false,
    },
  ],
  "ek-ekaclc-audit-all-null-variable": [
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
    {
      found: true,
      isNull: true,
    },
  ],
  "ek-ekaclc-audit-blank-strings": [
    {
      found: true,
      isNull: false,
      value: "",
    },
    {
      found: true,
      isNull: false,
      value: "",
    },
    {
      found: true,
      isNull: false,
      value: "",
    },
  ],
  "ek-ekffld-audit-persisted-multitype-columns": [
    {
      found: true,
      isNull: false,
      value: 99,
    },
    {
      found: true,
      isNull: false,
      value: 99.125,
    },
    {
      found: true,
      isNull: false,
      value: "µbeta",
    },
    {
      found: true,
      isNull: false,
      value: -7,
    },
    {
      found: true,
      isNull: false,
      value: -7.25,
    },
    {
      found: true,
      isNull: false,
      value: "  alpha",
    },
  ],
  "ek-ekgc-audit-full-1024-character-value": [
    {
      found: true,
      isNull: false,
      value:
        "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
  ],
};
function assertReads(
  result: CaseExecutionResult,
  values: readonly unknown[],
): void {
  expect(result.ok, result.error?.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  expect(
    result.outputs
      .filter((x) => ["ek.ekgc", "ek.ekgd", "ek.ekgi"].includes(x.op))
      .map((x) => x.value),
  ).toEqual(values);
}
for (const [id, values] of Object.entries(expected)) {
  const parityCase = allCases.find((c) => c.caseId === id);
  if (!parityCase) throw new Error(`Missing authored case ${id}`);
  for (const backend of ["node", "wasm"] as const) {
    const enabled = backend === "wasm" || nodeBackendAvailable;
    it.runIf(enabled)(`${backend} actual persisted values: ${id}`, async () => {
      const setup = await spiceClients.toSync({ backend });
      try {
        assertReads(
          runCaseInTspice(setup.spice, parityCase, path.resolve(fixturesRoot)),
          values,
        );
      } finally {
        await setup.dispose();
      }
    });
  }
  it(`actual SpiceyPy persisted values: ${id}`, async () => {
    assertReads(await runCaseInSidecar(parityCase, fixturesRoot), values);
  });
}
