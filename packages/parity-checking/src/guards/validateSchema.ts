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

export function validateSchema(specs: LoadedParitySpecs): void {
  assertUnique(
    specs.workflows.map((workflow) => workflow.id),
    "workflow id",
  );

  assertUnique(
    specs.methods.map((method) => method.id),
    "method id",
  );

  assertUnique(
    specs.crossCutting.map((spec) => spec.id),
    "cross-cutting spec id",
  );

  for (const method of specs.methods) {
    assertUnique(
      method.cases.map((scenarioCase) => scenarioCase.id),
      `case id in ${method.id}`,
    );
  }

  for (const spec of specs.crossCutting) {
    assertUnique(
      spec.cases.map((scenarioCase) => scenarioCase.id),
      `cross-cutting case id in ${spec.id}`,
    );
  }
}
