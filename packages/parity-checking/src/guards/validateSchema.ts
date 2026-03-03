import { crossCuttingSpecId, methodSpecId } from "../dsl/types.js";

import type { LoadedParitySpecs } from "../dsl/types.js";

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${JSON.stringify(value)}`);
    }
    seen.add(value);
  }
}

/** Validate high-level uniqueness constraints across loaded parity specs. */
export function validateSchema(specs: LoadedParitySpecs): void {
  assertUnique(
    specs.workflows.map((workflow) => workflow.id),
    "workflow id",
  );

  assertUnique(
    specs.methods.map((method) => methodSpecId(method)),
    "method id",
  );

  assertUnique(
    specs.crossCutting.map((spec) => crossCuttingSpecId(spec)),
    "cross-cutting spec id",
  );

  for (const method of specs.methods) {
    if (method.cases) {
      assertUnique(
        method.cases.map((scenarioCase) => scenarioCase.id),
        `case id in ${methodSpecId(method)}`,
      );
    }

    if (method.suites) {
      assertUnique(
        method.suites.map((suite) => suite.id),
        `suite id in ${methodSpecId(method)}`,
      );

      for (const suite of method.suites) {
        assertUnique(
          suite.cases.map((scenarioCase) => scenarioCase.id),
          `case id in ${methodSpecId(method)} suite=${suite.id}`,
        );
      }
    }
  }

  for (const spec of specs.crossCutting) {
    assertUnique(
      spec.cases.map((scenarioCase) => scenarioCase.id),
      `cross-cutting case id in ${crossCuttingSpecId(spec)}`,
    );
  }
}
