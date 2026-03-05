import { compareValues } from "../compare/compare.js";
import { formatMismatchReport } from "../compare/report.js";
import { DEFAULT_TOL_ABS, DEFAULT_TOL_REL } from "../config/constants.js";
import { mergeCompareChain, mergeSetupChain } from "../dsl/mergeResolvedSpec.js";
import { spiceShortSymbol } from "../errors/spiceShort.js";
import { readAliasMap } from "../generated/readAliasMap.js";

import type { CaseRunner } from "../runners/types.js";
import type { MethodResultSpecV3, ResolvedMethodSpec } from "../dsl/types.js";
import type { RunCaseInputV2 } from "../runners/types.js";

type LegacyLikeMethod = {
  id?: string;
  canonicalMethod?: string;
  defaults?: { compare?: { tolAbs?: number; tolRel?: number; angleWrapPi?: boolean; errorShort?: boolean } };
  cases?: Array<{ id: string; args?: unknown; setup?: unknown; compare?: unknown }>;
  contract?: {
    contractMethod?: string;
    canonicalMethod?: string;
    aliases?: string[];
    args?: Array<{ name: string; type: "spiceInt"; constraints?: { min?: number; max?: number } }>;
    result?: MethodResultSpecV3;
    errors?: Array<{ code: string }>;
  };
  manifest?: { id?: string; kind?: "method" };
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

function normalizeCaseArgs(rawArgs: unknown): unknown {
  if (Array.isArray(rawArgs)) {
    return rawArgs;
  }

  if (typeof rawArgs === "object" && rawArgs !== null) {
    return rawArgs as Record<string, unknown>;
  }

  return {};
}

function buildCallInput(
  method: LegacyLikeMethod,
  call: string,
  callArgs: unknown,
  setup: unknown,
  scenarioName: string,
): RunCaseInputV2 {
  const normalizedArgs = normalizeCaseArgs(callArgs);
  const argInputs = Array.isArray(normalizedArgs)
    ? normalizedArgs.map((_value, index) => `$args.${index}`)
    : (method.contract?.args ?? []).map((arg) => `$args.${arg.name}`);

  const canonicalMethod = methodCanonical(method) || call;

  return {
    schemaVersion: 3,
    manifest: {
      id: method.manifest?.id ?? scenarioName,
      kind: "method",
    },
    contract: {
      contractMethod: method.contract?.contractMethod ?? canonicalMethod,
      canonicalMethod,
      aliases: method.contract?.aliases ?? [],
      args: method.contract?.args ?? [],
      ...(method.contract?.result !== undefined ? { result: method.contract.result } : {}),
      errors: method.contract?.errors ?? [],
    },
    args: normalizedArgs,
    ...(setup !== undefined ? { setup: setup as { kernels?: Array<string | { path: string; restrictToDir?: string }> } } : {}),
    workflow: {
      steps: [
        {
          op: "call",
          fn: call,
          in: argInputs,
        },
      ],
    },
  };
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

      const scenarioName = `dispatch-alias-guard:${alias}:${caseLabel}`;
      const canonicalOut = await tspiceRunner.runCase(
        buildCallInput(method, canonical, caseSpec.args, setup, scenarioName),
      );
      const aliasOut = await tspiceRunner.runCase(
        buildCallInput(method, alias, caseSpec.args, setup, scenarioName),
      );

      if (canonicalOut.ok !== aliasOut.ok) {
        throw new Error(
          `Dispatch alias guard mismatch for alias ${alias} -> ${canonical} case ${caseLabel}: canonical.ok=${canonicalOut.ok}, alias.ok=${aliasOut.ok}`,
        );
      }

      const tolAbs = compare?.tolAbs ?? DEFAULT_TOL_ABS;
      const tolRel = compare?.tolRel ?? DEFAULT_TOL_REL;
      const angleWrapPi = compare?.angleWrapPi;
      const errorShort = compare?.errorShort ?? false;

      if (!canonicalOut.ok || !aliasOut.ok) {
        if (errorShort) {
          const canonicalShort = canonicalOut.ok ? undefined : canonicalOut.error.spice?.short;
          const aliasShort = aliasOut.ok ? undefined : aliasOut.error.spice?.short;
          const canonicalSymbol = canonicalShort ? spiceShortSymbol(canonicalShort) : null;
          const aliasSymbol = aliasShort ? spiceShortSymbol(aliasShort) : null;

          if (!canonicalSymbol || !aliasSymbol || canonicalSymbol !== aliasSymbol) {
            throw new Error(
              `Dispatch alias guard error-short mismatch for alias ${alias} -> ${canonical} case ${caseLabel}: canonical=${canonicalSymbol}, alias=${aliasSymbol}`,
            );
          }
        } else {
          const cmp = compareValues(
            canonicalOut.ok ? undefined : canonicalOut.error,
            aliasOut.ok ? undefined : aliasOut.error,
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
        normalizeResult(canonical, canonicalOut.result),
        normalizeResult(alias, aliasOut.result),
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
