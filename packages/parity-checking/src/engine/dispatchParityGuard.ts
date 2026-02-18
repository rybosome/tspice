import { compareValues } from "../compare/compare.js";
import { formatMismatchReport } from "../compare/report.js";
import { DEFAULT_TOL_ABS, DEFAULT_TOL_REL } from "../config/constants.js";
import { mergeCompareChain, mergeSetupChain } from "../dsl/mergeResolvedSpec.js";
import { parseScenario } from "../dsl/parse.js";
import { executeScenario } from "../dsl/execute.js";
import { spiceShortSymbol } from "../errors/spiceShort.js";
import { readAliasMap } from "../generated/readAliasMap.js";

import type { CaseRunner } from "../runners/types.js";
import type { ResolvedMethodSpec } from "../dsl/types.js";

export type DispatchAliasGuardSummary = {
  validatedAliasCount: number;
};

function normalizeResult(call: string, result: unknown): unknown {
  if (call !== "ephemeris.spksfs" || typeof result !== "object" || result === null) {
    return result;
  }

  const record = result as Record<string, unknown>;
  if (record.found !== true || !("handle" in record)) {
    return result;
  }

  const clone = { ...record };
  delete clone.handle;
  return clone;
}


function buildCompareOptions(tolAbs: number, tolRel: number, angleWrapPi: boolean | undefined): {
  tolAbs: number;
  tolRel: number;
  angleWrapPi?: boolean;
} {
  const out: { tolAbs: number; tolRel: number; angleWrapPi?: boolean } = { tolAbs, tolRel };
  if (angleWrapPi !== undefined) {
    out.angleWrapPi = angleWrapPi;
  }
  return out;
}

/** Validate that each dispatch alias matches its canonical method behavior. */
export async function runDispatchAliasParityGuard(
  resolvedMethods: ResolvedMethodSpec[],
  tspiceRunner: CaseRunner,
): Promise<DispatchAliasGuardSummary> {
  const aliasMap = readAliasMap();

  const methodByCanonical = new Map<string, ResolvedMethodSpec>();
  for (const method of resolvedMethods) {
    methodByCanonical.set(method.method.canonicalMethod, method);
  }

  let validatedAliasCount = 0;

  for (const [alias, canonical] of Object.entries(aliasMap)) {
    const resolvedMethod = methodByCanonical.get(canonical);
    if (!resolvedMethod) {
      throw new Error(
        `Dispatch alias guard failed: canonical method ${canonical} (for alias ${alias}) has no method spec coverage`,
      );
    }

    const caseSpec = resolvedMethod.method.cases[0];
    if (!caseSpec) {
      throw new Error(
        `Dispatch alias guard failed: method ${resolvedMethod.method.id} has no cases for alias ${alias}`,
      );
    }

    const setup = mergeSetupChain([resolvedMethod.mergedSetup, caseSpec.setup]);
    const compare = mergeCompareChain([
      resolvedMethod.mergedCompareDefaults,
      resolvedMethod.method.defaults?.compare,
      caseSpec.compare,
    ]);

    const scenario = parseScenario({
      sourcePath: resolvedMethod.method.meta.sourcePath,
      data: {
        name: `dispatch-alias-guard:${alias}`,
        setup,
        compare,
        cases: [
          {
            id: "canonical",
            call: canonical,
            args: caseSpec.args ?? [],
          },
          {
            id: "alias",
            call: alias,
            args: caseSpec.args ?? [],
          },
        ],
      },
    });

    const out = await executeScenario(scenario, tspiceRunner);
    const canonicalOut = out.cases.find((scenarioCase) => scenarioCase.case.id === "canonical");
    const aliasOut = out.cases.find((scenarioCase) => scenarioCase.case.id === "alias");

    if (!canonicalOut || !aliasOut) {
      throw new Error(`Dispatch alias guard internal error: missing canonical/alias outputs for ${alias}`);
    }

    if (canonicalOut.outcome.ok !== aliasOut.outcome.ok) {
      throw new Error(
        `Dispatch alias guard mismatch for alias ${alias} -> ${canonical}: canonical.ok=${canonicalOut.outcome.ok}, alias.ok=${aliasOut.outcome.ok}`,
      );
    }

    const tolAbs = compare?.tolAbs ?? DEFAULT_TOL_ABS;
    const tolRel = compare?.tolRel ?? DEFAULT_TOL_REL;
    const angleWrapPi = compare?.angleWrapPi;
    const errorShort = compare?.errorShort ?? false;

    if (!canonicalOut.outcome.ok || !aliasOut.outcome.ok) {
      if (errorShort) {
        const canonicalShort = canonicalOut.outcome.ok ? undefined : canonicalOut.outcome.error.spice?.short;
        const aliasShort = aliasOut.outcome.ok ? undefined : aliasOut.outcome.error.spice?.short;
        const canonicalSymbol = canonicalShort ? spiceShortSymbol(canonicalShort) : null;
        const aliasSymbol = aliasShort ? spiceShortSymbol(aliasShort) : null;

        if (!canonicalSymbol || !aliasSymbol || canonicalSymbol !== aliasSymbol) {
          throw new Error(
            `Dispatch alias guard error-short mismatch for alias ${alias} -> ${canonical}: canonical=${canonicalSymbol}, alias=${aliasSymbol}`,
          );
        }
      } else {
        const cmp = compareValues(
          canonicalOut.outcome.ok ? undefined : canonicalOut.outcome.error,
          aliasOut.outcome.ok ? undefined : aliasOut.outcome.error,
          buildCompareOptions(tolAbs, tolRel, angleWrapPi),
        );

        if (!cmp.ok) {
          throw new Error(
            `Dispatch alias guard error mismatch for alias ${alias} -> ${canonical}:\n${formatMismatchReport(cmp.mismatches)}`,
          );
        }
      }

      validatedAliasCount += 1;
      continue;
    }

    const cmp = compareValues(
      normalizeResult(canonical, canonicalOut.outcome.result),
      normalizeResult(alias, aliasOut.outcome.result),
      buildCompareOptions(tolAbs, tolRel, angleWrapPi),
    );

    if (!cmp.ok) {
      throw new Error(
        `Dispatch alias guard result mismatch for alias ${alias} -> ${canonical}:\n${formatMismatchReport(cmp.mismatches)}`,
      );
    }

    validatedAliasCount += 1;
  }

  return {
    validatedAliasCount,
  };
}
