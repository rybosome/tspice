import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnyMethodSpec } from "../../src/dsl/types.js";
import {
  BASELINE_CONTRACT_METHOD_COUNT,
  BASELINE_CONTRACT_METHOD_COVERAGE,
  BASELINE_METHOD_SPEC_COVERAGE,
  BASELINE_UNCOVERED_CONTRACT_METHODS,
} from "../../src/guards/completenessBaseline.js";

const { readContractCatalogMock, readMethodSurfaceRegistryMock, readParityDenylistMock } = vi.hoisted(() => ({
  readContractCatalogMock: vi.fn<() => string[]>(),
  readMethodSurfaceRegistryMock: vi.fn<
    () => Array<{ manifestId: string; canonicalMethod: string; contractMethod: string; workflowKind: "callContract" | "workflow" }>
  >(),
  readParityDenylistMock: vi.fn<() => string[]>(),
}));

vi.mock("../../src/generated/readContractCatalog.js", () => ({
  readContractCatalog: readContractCatalogMock,
}));

vi.mock("../../src/generated/readMethodSurfaceRegistry.js", () => ({
  readMethodSurfaceRegistry: readMethodSurfaceRegistryMock,
}));

vi.mock("../../src/generated/readParityDenylist.js", () => ({
  readParityDenylist: readParityDenylistMock,
}));

import { validateCompleteness } from "../../src/guards/validateCompleteness.js";

const BASELINE_COVERED_METHODS = Array.from({ length: BASELINE_METHOD_SPEC_COVERAGE }, (_entry, index) =>
  `covered.method.${index}`,
);
const BASELINE_CONTRACT_COVERED_METHODS = BASELINE_COVERED_METHODS.slice(
  0,
  BASELINE_CONTRACT_METHOD_COVERAGE,
);
const BASELINE_UNCOVERED_METHODS = Array.from(
  { length: BASELINE_UNCOVERED_CONTRACT_METHODS },
  (_entry, index) => `uncovered.method.${index}`,
);
const BASELINE_CONTRACT_METHODS = [
  ...BASELINE_CONTRACT_COVERED_METHODS,
  ...BASELINE_UNCOVERED_METHODS,
];

const BASELINE_METHOD_SURFACE_REGISTRY = BASELINE_COVERED_METHODS.map((canonicalMethod, index) => ({
  manifestId: `methods/test/${index}@v3`,
  canonicalMethod,
  contractMethod: canonicalMethod,
  workflowKind: "callContract" as const,
}));

function makeMethodSpecs(canonicalMethods: string[]): AnyMethodSpec[] {
  return canonicalMethods.map((canonicalMethod, index) => ({
    schemaVersion: 3,
    manifest: {
      id: `methods/test/${index}@v3`,
      kind: "method",
    },
    contract: {
      contractMethod: canonicalMethod,
      canonicalMethod,
    },
    workflow: {
      steps: [{ op: "callContract" }],
    },
    cases: [{ id: `case-${index}`, args: [] }],
    meta: {
      sourcePath: `spec-${index}.yml`,
    },
  }));
}

describe("validateCompleteness", () => {
  beforeEach(() => {
    readContractCatalogMock.mockReset();
    readMethodSurfaceRegistryMock.mockReset();
    readParityDenylistMock.mockReset();

    readContractCatalogMock.mockReturnValue([...BASELINE_CONTRACT_METHODS]);
    readMethodSurfaceRegistryMock.mockReturnValue([...BASELINE_METHOD_SURFACE_REGISTRY]);
    readParityDenylistMock.mockReturnValue([]);
  });

  it("passes baseline coverage/catalog counts", () => {
    const summary = validateCompleteness(makeMethodSpecs(BASELINE_COVERED_METHODS));

    expect(summary).toEqual({
      contractCount: BASELINE_CONTRACT_METHOD_COUNT,
      coveredCount: BASELINE_METHOD_SPEC_COVERAGE,
      denylistCount: 0,
    });
  });

  it("fails when method-spec coverage diverges from method-surface registry", () => {
    const shortCoverage = BASELINE_COVERED_METHODS.slice(0, BASELINE_COVERED_METHODS.length - 1);

    expect(() => validateCompleteness(makeMethodSpecs(shortCoverage))).toThrow(
      /must exactly match registry\/method-surface\.yml/,
    );
  });

  it("fails when uncovered catalog methods increase", () => {
    readContractCatalogMock.mockReturnValue([
      ...BASELINE_CONTRACT_METHODS,
      "uncovered.method.new",
    ]);

    expect(() => validateCompleteness(makeMethodSpecs(BASELINE_COVERED_METHODS))).toThrow(
      /Contract catalog size changed from baseline/,
    );
  });
});
