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

type LegacyLikeMethod = {
  id?: string;
  canonicalMethod?: string;
  defaults?: { compare?: { tolAbs?: number; tolRel?: number; angleWrapPi?: boolean; errorShort?: boolean } };
  cases?: Array<{ id: string; args?: unknown; setup?: unknown; compare?: unknown }>;
  contract?: { canonicalMethod?: string };
  manifest?: { id?: string };
  meta?: { sourcePath?: string };
};

function methodCanonical(method: LegacyLikeMethod): string {
  return method.contract?.canonicalMethod ?? method.canonicalMethod ?? "";
}

function methodId(method: LegacyLikeMethod): string {
  return method.manifest?.id ?? method.id ?? "unknown-method";
}

function methodSourcePath(method: LegacyLikeMethod): string {
  return method.meta?.sourcePath ?? "dispatch-alias-guard";
}

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
  for (const resolvedMethod of resolvedMethods) {
    methodByCanonical.set(methodCanonical(resolvedMethod.method as LegacyLikeMethod), resolvedMethod);
  }

  let validatedAliasCount = 0;

  for (const [alias, canonical] of Object.entries(aliasMap)) {
    const resolvedMethod = methodByCanonical.get(canonical);
    if (!resolvedMethod) {
      throw new Error(
        `Dispatch alias guard failed: canonical method ${canonical} (for alias ${alias}) has no method spec coverage`,
      );
    }

    const method = resolvedMethod.method as LegacyLikeMethod;
    const methodCases = method.cases ?? [];

    if (methodCases.length === 0) {
      throw new Error(`Dispatch alias guard failed: method ${methodId(method)} has no cases for alias ${alias}`);
    }

    for (const caseSpec of methodCases) {
      const caseLabel = caseSpec.id;
      const setup = mergeSetupChain([resolvedMethod.mergedSetup, caseSpec.setup as undefined]);
      const compare = mergeCompareChain([
        resolvedMethod.mergedCompareDefaults,
        method.defaults?.compare,
        caseSpec.compare as undefined,
      ]);

      const scenario = parseScenario({
        sourcePath: methodSourcePath(method),
        data: {
          name: `dispatch-alias-guard:${alias}:${caseLabel}`,
          setup,
          compare,
          cases: [
            {
              id: "canonical",
              call: canonical,
              args: Array.isArray(caseSpec.args) ? caseSpec.args : [],
            },
            {
              id: "alias",
              call: alias,
              args: Array.isArray(caseSpec.args) ? caseSpec.args : [],
            },
          ],
        },
      });

      const out = await executeScenario(scenario, tspiceRunner);
      const canonicalOut = out.cases.find((scenarioCase) => scenarioCase.case.id === "canonical");
      const aliasOut = out.cases.find((scenarioCase) => scenarioCase.case.id === "alias");

      if (!canonicalOut || !aliasOut) {
        throw new Error(
          `Dispatch alias guard internal error: missing canonical/alias outputs for ${alias} case ${caseLabel}`,
        );
      }

      if (canonicalOut.outcome.ok !== aliasOut.outcome.ok) {
        throw new Error(
          `Dispatch alias guard mismatch for alias ${alias} -> ${canonical} case ${caseLabel}: canonical.ok=${canonicalOut.outcome.ok}, alias.ok=${aliasOut.outcome.ok}`,
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
              `Dispatch alias guard error-short mismatch for alias ${alias} -> ${canonical} case ${caseLabel}: canonical=${canonicalSymbol}, alias=${aliasSymbol}`,
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
              `Dispatch alias guard error mismatch for alias ${alias} -> ${canonical} case ${caseLabel}:\n${formatMismatchReport(cmp.mismatches)}`,
            );
          }
        }

        continue;
      }

      const cmp = compareValues(
        normalizeResult(canonical, canonicalOut.outcome.result),
        normalizeResult(alias, aliasOut.outcome.result),
        buildCompareOptions(tolAbs, tolRel, angleWrapPi),
      );

      if (!cmp.ok) {
        throw new Error(
          `Dispatch alias guard result mismatch for alias ${alias} -> ${canonical} case ${caseLabel}:\n${formatMismatchReport(cmp.mismatches)}`,
        );
      }
    }

    validatedAliasCount += 1;
  }

  return {
    validatedAliasCount,
  };
}
