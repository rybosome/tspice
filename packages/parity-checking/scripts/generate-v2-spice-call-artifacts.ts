import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type V2SpiceCallArgKind =
  | "intExpr"
  | "cellRef"
  | "cellOrWindowRef"
  | "pathExpr"
  | "dasHandleRef"
  | "dlaDescriptorRef";

type V2SpiceCallOutputMode = "forbidden" | "asSpiceInt" | "asDskDescriptor" | "outNamedDskb02";

type V2SpiceCallInvokeLane =
  | "direct"
  | "legacyDskopn"
  | "legacyDskmi2"
  | "legacyDskw02"
  | "readVirtualOutput";

type V2SpiceCallManifestEntry = {
  call: string;
  arity: number;
  argKinds: V2SpiceCallArgKind[];
  nonNegativeIntArgMask?: number;
  outputMode: V2SpiceCallOutputMode;
  invokeLane: V2SpiceCallInvokeLane;
  namedOutputs?: string[];
};

type V2SpiceCallManifest = {
  schemaVersion: number;
  calls: V2SpiceCallManifestEntry[];
};

const ALLOWED_ARG_KINDS: ReadonlySet<string> = new Set([
  "intExpr",
  "cellRef",
  "cellOrWindowRef",
  "pathExpr",
  "dasHandleRef",
  "dlaDescriptorRef",
]);

const ALLOWED_OUTPUT_MODES: ReadonlySet<string> = new Set([
  "forbidden",
  "asSpiceInt",
  "asDskDescriptor",
  "outNamedDskb02",
]);

const ALLOWED_INVOKE_LANES: ReadonlySet<string> = new Set([
  "direct",
  "legacyDskopn",
  "legacyDskmi2",
  "legacyDskw02",
  "readVirtualOutput",
]);

const EXPECTED_EXCEPTION_CALLS = ["dskb02_c", "dskgd_c"] as const;
const EXPECTED_DSKB02_NAMED_OUTPUTS = [
  "nv",
  "np",
  "nvxtot",
  "cgscal",
  "vtxnpl",
  "voxnpt",
  "voxnpl",
] as const;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const manifestPath = path.join(packageRoot, "catalogs", "v2-spice-call-manifest.json");
const tsOutputPath = path.join(packageRoot, "src", "generated", "v2SpiceCallRegistry.ts");
const nativeHeaderOutputPath = path.join(
  packageRoot,
  "native",
  "src",
  "cspice_runner_v2_spice_calls_generated.h",
);
const nativeSourceOutputPath = path.join(
  packageRoot,
  "native",
  "src",
  "cspice_runner_v2_spice_calls_generated.c",
);

function fail(message: string): never {
  throw new Error(`[v2-spice-call-generator] ${message}`);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function asInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(`${label} must be an integer`);
  }
  return value;
}

function parseManifest(): V2SpiceCallManifest {
  let rawText: string;
  try {
    rawText = fs.readFileSync(manifestPath, "utf8");
  } catch (error) {
    fail(`failed to read manifest at ${manifestPath}: ${String(error)}`);
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawText);
  } catch (error) {
    fail(`failed to parse JSON manifest at ${manifestPath}: ${String(error)}`);
  }

  const root = asRecord(parsedRaw, "manifest");
  const schemaVersion = asInteger(root.schemaVersion, "manifest.schemaVersion");
  if (schemaVersion !== 1) {
    fail(`manifest.schemaVersion must be 1 (received ${schemaVersion})`);
  }

  const callsRaw = root.calls;
  if (!Array.isArray(callsRaw) || callsRaw.length < 1) {
    fail("manifest.calls must be a non-empty array");
  }

  const calls: V2SpiceCallManifestEntry[] = callsRaw.map((entryRaw, index) => {
    const entry = asRecord(entryRaw, `manifest.calls[${index}]`);

    const call = asString(entry.call, `manifest.calls[${index}].call`);
    const arity = asInteger(entry.arity, `manifest.calls[${index}].arity`);
    if (arity < 0 || arity > 3) {
      fail(`manifest.calls[${index}].arity must be between 0 and 3 (received ${arity})`);
    }

    const argKindsRaw = entry.argKinds;
    if (!Array.isArray(argKindsRaw)) {
      fail(`manifest.calls[${index}].argKinds must be an array`);
    }
    if (argKindsRaw.length !== arity) {
      fail(
        `manifest.calls[${index}] argKinds length (${argKindsRaw.length}) must equal arity (${arity})`,
      );
    }
    const argKinds = argKindsRaw.map((argKindRaw, argIndex) => {
      const argKind = asString(
        argKindRaw,
        `manifest.calls[${index}].argKinds[${argIndex}]`,
      ) as V2SpiceCallArgKind;
      if (!ALLOWED_ARG_KINDS.has(argKind)) {
        fail(`manifest.calls[${index}].argKinds[${argIndex}] has unsupported value ${JSON.stringify(argKind)}`);
      }
      return argKind;
    });

    const outputMode = asString(
      entry.outputMode,
      `manifest.calls[${index}].outputMode`,
    ) as V2SpiceCallOutputMode;
    if (!ALLOWED_OUTPUT_MODES.has(outputMode)) {
      fail(`manifest.calls[${index}].outputMode has unsupported value ${JSON.stringify(outputMode)}`);
    }

    const invokeLane = asString(
      entry.invokeLane,
      `manifest.calls[${index}].invokeLane`,
    ) as V2SpiceCallInvokeLane;
    if (!ALLOWED_INVOKE_LANES.has(invokeLane)) {
      fail(`manifest.calls[${index}].invokeLane has unsupported value ${JSON.stringify(invokeLane)}`);
    }

    const nonNegativeIntArgMaskRaw = entry.nonNegativeIntArgMask;
    let nonNegativeIntArgMask: number | undefined;
    if (nonNegativeIntArgMaskRaw !== undefined) {
      nonNegativeIntArgMask = asInteger(
        nonNegativeIntArgMaskRaw,
        `manifest.calls[${index}].nonNegativeIntArgMask`,
      );
      if (nonNegativeIntArgMask < 0) {
        fail(`manifest.calls[${index}].nonNegativeIntArgMask must be >= 0`);
      }
      if (nonNegativeIntArgMask >= 1 << 3) {
        fail(`manifest.calls[${index}].nonNegativeIntArgMask must fit in 3 bits`);
      }
    }

    const namedOutputsRaw = entry.namedOutputs;
    let namedOutputs: string[] | undefined;
    if (namedOutputsRaw !== undefined) {
      if (!Array.isArray(namedOutputsRaw) || namedOutputsRaw.length < 1) {
        fail(`manifest.calls[${index}].namedOutputs must be a non-empty array when provided`);
      }
      namedOutputs = namedOutputsRaw.map((value, outputIndex) =>
        asString(value, `manifest.calls[${index}].namedOutputs[${outputIndex}]`),
      );
      const unique = new Set(namedOutputs);
      if (unique.size !== namedOutputs.length) {
        fail(`manifest.calls[${index}].namedOutputs must not contain duplicates`);
      }
    }

    return {
      call,
      arity,
      argKinds,
      outputMode,
      invokeLane,
      ...(nonNegativeIntArgMask !== undefined ? { nonNegativeIntArgMask } : {}),
      ...(namedOutputs ? { namedOutputs } : {}),
    };
  });

  return {
    schemaVersion,
    calls,
  };
}

function arrayEquals(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function validateManifest(manifest: V2SpiceCallManifest): void {
  const seenCalls = new Set<string>();

  for (let index = 0; index < manifest.calls.length; index++) {
    const entry = manifest.calls[index];

    if (seenCalls.has(entry.call)) {
      fail(`duplicate call entry ${JSON.stringify(entry.call)} in manifest.calls`);
    }
    seenCalls.add(entry.call);

    if (entry.invokeLane === "direct" && !entry.call.endsWith("_c")) {
      fail(`direct lane call must end in _c (received ${entry.call})`);
    }

    if (entry.invokeLane === "readVirtualOutput") {
      if (entry.call !== "readVirtualOutput") {
        fail(`readVirtualOutput lane must use call=readVirtualOutput`);
      }
      if (entry.arity !== 1 || entry.argKinds[0] !== "pathExpr") {
        fail(`readVirtualOutput lane must have arity=1 and argKinds=["pathExpr"]`);
      }
    }

    if (
      entry.invokeLane === "legacyDskopn" ||
      entry.invokeLane === "legacyDskmi2" ||
      entry.invokeLane === "legacyDskw02"
    ) {
      if (entry.outputMode !== "forbidden") {
        fail(`${entry.call} legacy lane must use outputMode=forbidden`);
      }
      if (entry.arity !== 0 || entry.argKinds.length !== 0) {
        fail(`${entry.call} legacy lane must have arity=0 and no argKinds`);
      }
      if (entry.namedOutputs !== undefined) {
        fail(`${entry.call} legacy lane must not define namedOutputs`);
      }
    }

    if (entry.outputMode === "asDskDescriptor") {
      if (entry.call !== "dskgd_c") {
        fail(`asDskDescriptor exception is only allowed for dskgd_c (received ${entry.call})`);
      }
      if (entry.invokeLane !== "direct") {
        fail(`dskgd_c must use direct invoke lane`);
      }
    }

    if (entry.outputMode === "outNamedDskb02") {
      if (entry.call !== "dskb02_c") {
        fail(`outNamedDskb02 exception is only allowed for dskb02_c (received ${entry.call})`);
      }
      if (entry.invokeLane !== "direct") {
        fail(`dskb02_c must use direct invoke lane`);
      }
      if (!entry.namedOutputs) {
        fail(`dskb02_c must define namedOutputs`);
      }
      if (!arrayEquals(entry.namedOutputs, EXPECTED_DSKB02_NAMED_OUTPUTS)) {
        fail(
          `dskb02_c namedOutputs must exactly equal ${JSON.stringify(EXPECTED_DSKB02_NAMED_OUTPUTS)} (received ${JSON.stringify(entry.namedOutputs)})`,
        );
      }
    } else if (entry.namedOutputs !== undefined) {
      fail(`${entry.call} namedOutputs is only valid for outNamedDskb02`);
    }

    const mask = entry.nonNegativeIntArgMask ?? 0;
    if (mask < 0 || mask >= 1 << 3) {
      fail(`${entry.call} nonNegativeIntArgMask must fit in 3 bits`);
    }

    for (let bit = 0; bit < 3; bit++) {
      const isSet = (mask & (1 << bit)) !== 0;
      if (!isSet) {
        continue;
      }

      if (bit >= entry.argKinds.length || entry.argKinds[bit] !== "intExpr") {
        fail(
          `${entry.call} nonNegativeIntArgMask bit ${bit} requires argKinds[${bit}] to be intExpr`,
        );
      }
    }
  }

  const actualExceptionCalls = manifest.calls
    .filter((entry) => entry.outputMode === "asDskDescriptor" || entry.outputMode === "outNamedDskb02")
    .map((entry) => entry.call)
    .sort();

  const expectedExceptionCalls = [...EXPECTED_EXCEPTION_CALLS].sort();
  if (!arrayEquals(actualExceptionCalls, expectedExceptionCalls)) {
    fail(
      `manifest exception calls must exactly equal ${JSON.stringify(expectedExceptionCalls)} (received ${JSON.stringify(actualExceptionCalls)})`,
    );
  }
}

function assertNever(value: never): never {
  fail(`unexpected value ${String(value)}`);
}

function cArgKindEnum(kind: V2SpiceCallArgKind): string {
  switch (kind) {
    case "intExpr":
      return "V2_SPICE_CALL_ARG_INT_EXPR";
    case "cellRef":
      return "V2_SPICE_CALL_ARG_CELL_REF";
    case "cellOrWindowRef":
      return "V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF";
    case "pathExpr":
      return "V2_SPICE_CALL_ARG_PATH_EXPR";
    case "dasHandleRef":
      return "V2_SPICE_CALL_ARG_DAS_HANDLE_REF";
    case "dlaDescriptorRef":
      return "V2_SPICE_CALL_ARG_DLA_DESCR_REF";
  }

  return assertNever(kind);
}

function cOutputKindEnum(mode: V2SpiceCallOutputMode): string {
  switch (mode) {
    case "forbidden":
      return "V2_SPICE_CALL_OUTPUT_FORBIDDEN";
    case "asSpiceInt":
      return "V2_SPICE_CALL_OUTPUT_AS_INT";
    case "asDskDescriptor":
      return "V2_SPICE_CALL_OUTPUT_AS_DSK_DESCR";
    case "outNamedDskb02":
      return "V2_SPICE_CALL_OUTPUT_NAMED_DSKB02";
  }

  return assertNever(mode);
}

function cInvokeLaneEnum(lane: V2SpiceCallInvokeLane): string {
  switch (lane) {
    case "direct":
      return "V2_SPICE_CALL_INVOKE_DIRECT";
    case "legacyDskopn":
      return "V2_SPICE_CALL_INVOKE_LEGACY_DSKOPN";
    case "legacyDskmi2":
      return "V2_SPICE_CALL_INVOKE_LEGACY_DSKMI2";
    case "legacyDskw02":
      return "V2_SPICE_CALL_INVOKE_LEGACY_DSKW02";
    case "readVirtualOutput":
      return "V2_SPICE_CALL_INVOKE_READ_VIRTUAL_OUTPUT";
  }

  return assertNever(lane);
}

function cResolvedArgExpr(kind: V2SpiceCallArgKind, index: number): string {
  switch (kind) {
    case "intExpr":
      return `context->resolved->intValues[${index}]`;
    case "cellRef":
    case "cellOrWindowRef":
      return `&context->refs[context->resolved->refIndices[${index}]].cell`;
    case "pathExpr":
      return `context->resolved->pathValues[${index}]`;
    case "dasHandleRef":
      return `context->refs[context->resolved->refIndices[${index}]].handleValue`;
    case "dlaDescriptorRef":
      return `&context->refs[context->resolved->refIndices[${index}]].dlaDescrValue`;
  }

  return assertNever(kind);
}

function tsArgCastType(kind: V2SpiceCallArgKind): string {
  switch (kind) {
    case "intExpr":
      return "number";
    case "cellRef":
      return "IntCellHandle";
    case "cellOrWindowRef":
      return "CellHandle | WindowHandle";
    case "pathExpr":
      return "string";
    case "dasHandleRef":
      return "DasHandle";
    case "dlaDescriptorRef":
      return "DlaDescriptor";
  }

  return assertNever(kind);
}

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function rawMethodNameFromCall(call: string): string {
  if (!call.endsWith("_c")) {
    fail(`cannot derive raw method name from non-_c call ${call}`);
  }
  return call.slice(0, -2);
}

function resolveNamedOutputs(manifest: V2SpiceCallManifest): readonly string[] {
  const entry = manifest.calls.find((call) => call.call === "dskb02_c");
  if (!entry || entry.outputMode !== "outNamedDskb02" || !entry.namedOutputs) {
    fail("manifest must include dskb02_c outNamedDskb02 entry with namedOutputs");
  }
  return entry.namedOutputs;
}

function generateTypeScriptArtifact(manifest: V2SpiceCallManifest): string {
  const dskb02NamedOutputs = resolveNamedOutputs(manifest);

  const callNameLiterals = manifest.calls.map((entry) => `  ${JSON.stringify(entry.call)},`).join("\n");

  const specRows = manifest.calls
    .map((entry) => {
      const argKinds = entry.argKinds.map((kind) => JSON.stringify(kind)).join(", ");
      const namedOutputs = entry.namedOutputs
        ? `,\n    namedOutputs: [${entry.namedOutputs.map((value) => JSON.stringify(value)).join(", ")}] as const`
        : "";

      return `  {\n    call: ${JSON.stringify(entry.call)},\n    arity: ${entry.arity},\n    argKinds: [${argKinds}] as const,\n    nonNegativeIntArgMask: ${entry.nonNegativeIntArgMask ?? 0},\n    outputMode: ${JSON.stringify(entry.outputMode)},\n    invokeLane: ${JSON.stringify(entry.invokeLane)}${namedOutputs}\n  },`;
    })
    .join("\n");

  const invokerFunctions = manifest.calls
    .map((entry) => {
      const functionName = `invoke_${sanitizeIdentifier(entry.call)}`;

      if (entry.invokeLane === "legacyDskopn") {
        return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  context.executeDskopnLegacy();\n}`;
      }

      if (entry.invokeLane === "legacyDskmi2") {
        return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  context.executeDskmi2Legacy();\n}`;
      }

      if (entry.invokeLane === "legacyDskw02") {
        return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  context.executeDskw02Legacy();\n}`;
      }

      if (entry.invokeLane === "readVirtualOutput") {
        return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  context.executeReadVirtualOutput(context.resolvedArgs[0] as string);\n}`;
      }

      const rawMethod = rawMethodNameFromCall(entry.call);
      const args = entry.argKinds
        .map((kind, index) => `context.resolvedArgs[${index}] as ${tsArgCastType(kind)}`)
        .join(", ");
      const callExpression = `context.raw.${rawMethod}(${args})`;

      switch (entry.outputMode) {
        case "forbidden":
          return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  ${callExpression};\n}`;

        case "asSpiceInt":
          return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  context.defineSpiceIntResult(${callExpression});\n}`;

        case "asDskDescriptor":
          return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  context.defineDskDescriptorResult(${callExpression});\n}`;

        case "outNamedDskb02":
          return `function ${functionName}(context: V2GeneratedSpiceCallInvokeContext): void {\n  context.applyNamedDskb02Outputs(${callExpression});\n}`;
      }

      return assertNever(entry.outputMode);
    })
    .join("\n\n");

  const invokerRegistryRows = manifest.calls
    .map((entry) => `  ${JSON.stringify(entry.call)}: invoke_${sanitizeIdentifier(entry.call)},`)
    .join("\n");

  const dskb02NamedOutputsLiteral = dskb02NamedOutputs
    .map((value) => `  ${JSON.stringify(value)},`)
    .join("\n");

  const generatedFromRelative = path.relative(packageRoot, manifestPath).replaceAll(path.sep, "/");

  return `/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 *
 * Generated by: pnpm -C packages/parity-checking run generate:v2-spice-calls
 * Source of truth: ${generatedFromRelative}
 */

/* eslint-disable jsdoc/require-jsdoc */

import type { SpiceBackend } from "@rybosome/tspice";

type CellHandle =
  | ReturnType<SpiceBackend["kit"]["newIntCell"]>
  | ReturnType<SpiceBackend["kit"]["newDoubleCell"]>
  | ReturnType<SpiceBackend["kit"]["newCharCell"]>;
type IntCellHandle = ReturnType<SpiceBackend["kit"]["newIntCell"]>;
type WindowHandle = ReturnType<SpiceBackend["kit"]["newWindow"]>;
type DasHandle = ReturnType<SpiceBackend["raw"]["dasopr"]>;
type DlaDescriptor = Extract<
  ReturnType<SpiceBackend["raw"]["dlabfs"]>,
  { found: true }
>["descr"];
type DskDescriptor = ReturnType<SpiceBackend["raw"]["dskgd"]>;
type DskType2Bookkeeping = ReturnType<SpiceBackend["raw"]["dskb02"]>;

export const V2_GENERATED_SPICE_CALL_NAMES = [
${callNameLiterals}
] as const;

export type V2GeneratedSpiceCallName = (typeof V2_GENERATED_SPICE_CALL_NAMES)[number];

export type V2GeneratedSpiceCallArgKind =
  | "intExpr"
  | "cellRef"
  | "cellOrWindowRef"
  | "pathExpr"
  | "dasHandleRef"
  | "dlaDescriptorRef";

export type V2GeneratedSpiceCallOutputMode =
  | "forbidden"
  | "asSpiceInt"
  | "asDskDescriptor"
  | "outNamedDskb02";

export type V2GeneratedSpiceCallInvokeLane =
  | "direct"
  | "legacyDskopn"
  | "legacyDskmi2"
  | "legacyDskw02"
  | "readVirtualOutput";

export type V2GeneratedSpiceCallSpec = {
  call: V2GeneratedSpiceCallName;
  arity: number;
  argKinds: readonly V2GeneratedSpiceCallArgKind[];
  nonNegativeIntArgMask: number;
  outputMode: V2GeneratedSpiceCallOutputMode;
  invokeLane: V2GeneratedSpiceCallInvokeLane;
  namedOutputs?: readonly string[];
};

export const V2_GENERATED_SPICE_CALL_SPECS: readonly V2GeneratedSpiceCallSpec[] = [
${specRows}
];

export const V2_DSKB02_NAMED_OUTPUTS = [
${dskb02NamedOutputsLiteral}
] as const;

export type V2Dskb02NamedOutput = (typeof V2_DSKB02_NAMED_OUTPUTS)[number];

export function lookupGeneratedV2SpiceCallSpec(
  call: string,
): V2GeneratedSpiceCallSpec | undefined {
  return V2_GENERATED_SPICE_CALL_SPECS.find((spec) => spec.call === call);
}

export type V2GeneratedSpiceCallInvokeContext = {
  backend: SpiceBackend;
  raw: SpiceBackend["raw"];
  resolvedArgs: readonly unknown[];
  defineSpiceIntResult: (value: unknown) => void;
  defineDskDescriptorResult: (value: DskDescriptor) => void;
  applyNamedDskb02Outputs: (bookkeeping: DskType2Bookkeeping) => void;
  executeDskopnLegacy: () => void;
  executeDskmi2Legacy: () => void;
  executeDskw02Legacy: () => void;
  executeReadVirtualOutput: (path: string) => void;
};

export type V2GeneratedSpiceCallInvoker = (context: V2GeneratedSpiceCallInvokeContext) => void;

${invokerFunctions}

const V2_GENERATED_SPICE_CALL_INVOKERS = {
${invokerRegistryRows}
} satisfies Record<V2GeneratedSpiceCallName, V2GeneratedSpiceCallInvoker>;

export function invokeGeneratedV2SpiceCall(
  call: V2GeneratedSpiceCallName,
  context: V2GeneratedSpiceCallInvokeContext,
): void {
  V2_GENERATED_SPICE_CALL_INVOKERS[call](context);
}
`;
}

function generateNativeHeaderArtifact(manifest: V2SpiceCallManifest): string {
  const generatedFromRelative = path.relative(packageRoot, manifestPath).replaceAll(path.sep, "/");

  return `/*
 * AUTO-GENERATED FILE. DO NOT EDIT.
 *
 * Generated by: pnpm -C packages/parity-checking run generate:v2-spice-calls
 * Source of truth: ${generatedFromRelative}
 */

#ifndef CSPICE_RUNNER_V2_SPICE_CALLS_GENERATED_H
#define CSPICE_RUNNER_V2_SPICE_CALLS_GENERATED_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_refs.h"

typedef enum {
  V2_SPICE_CALL_ARG_INT_EXPR = 0,
  V2_SPICE_CALL_ARG_CELL_REF,
  V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
  V2_SPICE_CALL_ARG_PATH_EXPR,
  V2_SPICE_CALL_ARG_DAS_HANDLE_REF,
  V2_SPICE_CALL_ARG_DLA_DESCR_REF,
} V2SpiceCallArgKind;

typedef enum {
  V2_SPICE_CALL_OUTPUT_FORBIDDEN = 0,
  V2_SPICE_CALL_OUTPUT_AS_INT,
  V2_SPICE_CALL_OUTPUT_AS_DSK_DESCR,
  V2_SPICE_CALL_OUTPUT_NAMED_DSKB02,
} V2SpiceCallOutputKind;

typedef enum {
  V2_SPICE_CALL_INVOKE_DIRECT = 0,
  V2_SPICE_CALL_INVOKE_LEGACY_DSKOPN,
  V2_SPICE_CALL_INVOKE_LEGACY_DSKMI2,
  V2_SPICE_CALL_INVOKE_LEGACY_DSKW02,
  V2_SPICE_CALL_INVOKE_READ_VIRTUAL_OUTPUT,
} V2SpiceCallInvokeLane;

#define V2_SPICE_CALL_MAX_ARITY 3

typedef struct {
  const char *name;
  int arity;
  V2SpiceCallArgKind argKinds[V2_SPICE_CALL_MAX_ARITY];
  unsigned int nonNegativeIntArgMask;
  V2SpiceCallOutputKind outputKind;
  V2SpiceCallInvokeLane invokeLane;
} V2SpiceCallSpec;

typedef struct {
  SpiceInt intValues[V2_SPICE_CALL_MAX_ARITY];
  int refIndices[V2_SPICE_CALL_MAX_ARITY];
  char *pathValues[V2_SPICE_CALL_MAX_ARITY];
} V2ResolvedSpiceCallArgs;

typedef struct {
  const char *json;
  const jsmntok_t *tokens;
  int tokenCount;
  const char *callName;
  const V2SpiceCallSpec *spec;
  const char *asRefName;
  int outMapTok;
  V2ResolvedSpiceCallArgs *resolved;
  V2RefEntry *refs;
  int *refCount;
} V2SpiceCallInvokeContext;

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *name);
bool v2_invoke_spice_call(const V2SpiceCallInvokeContext *context);

#endif
`;
}

function generateNativeInvokerFunction(entry: V2SpiceCallManifestEntry): string {
  const fnName = `v2_invoke_${sanitizeIdentifier(entry.call)}`;

  if (entry.invokeLane === "legacyDskopn") {
    return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  (void)context;\n  return v2_execute_dskopn_legacy_call();\n}`;
  }

  if (entry.invokeLane === "legacyDskmi2") {
    return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  (void)context;\n  return v2_execute_dskmi2_legacy_call();\n}`;
  }

  if (entry.invokeLane === "legacyDskw02") {
    return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  (void)context;\n  return v2_execute_dskw02_legacy_call();\n}`;
  }

  if (entry.invokeLane === "readVirtualOutput") {
    return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  return v2_execute_read_virtual_output_call(context->resolved->pathValues[0]);\n}`;
  }

  const args = entry.argKinds.map((kind, index) => cResolvedArgExpr(kind, index));

  switch (entry.outputMode) {
    case "forbidden": {
      const callExpr = `${entry.call}(${args.join(",\n           ")})`;
      return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  ${callExpr};\n  if (failed_c() == SPICETRUE) {\n    return v2_write_spice_failure("SPICE error in ${entry.call}");\n  }\n\n  return true;\n}`;
    }

    case "asSpiceInt": {
      const callExpr = `${entry.call}(${args.join(",\n                    ")})`;
      return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  SpiceInt value =\n      ${callExpr};\n  if (failed_c() == SPICETRUE) {\n    return v2_write_spice_failure("SPICE error in ${entry.call}");\n  }\n\n  return v2_add_ref_int(context->refs,\n                        context->refCount,\n                        context->asRefName,\n                        value);\n}`;
    }

    case "asDskDescriptor": {
      const callExpr = `${entry.call}(${[...args, "&descriptor"].join(",\n          ")})`;
      return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  SpiceDSKDescr descriptor;\n  memset(&descriptor, 0, sizeof(descriptor));\n\n  ${callExpr};\n  if (failed_c() == SPICETRUE) {\n    return v2_write_spice_failure("SPICE error in ${entry.call}");\n  }\n\n  return v2_add_ref_dsk_descr(context->refs,\n                              context->refCount,\n                              context->asRefName,\n                              &descriptor);\n}`;
    }

    case "outNamedDskb02": {
      const callExpr = `${entry.call}(${[
        ...args,
        "&nv",
        "&np",
        "&nvxtot",
        "vtxbds",
        "&voxsiz",
        "voxori",
        "vgrext",
        "&cgscal",
        "&vtxnpl",
        "&voxnpt",
        "&voxnpl",
      ].join(",\n           ")})`;

      return `static bool ${fnName}(const V2SpiceCallInvokeContext *context) {\n  SpiceInt nv = 0;\n  SpiceInt np = 0;\n  SpiceInt nvxtot = 0;\n  SpiceDouble vtxbds[3][2];\n  SpiceDouble voxsiz = 0.0;\n  SpiceDouble voxori[3];\n  SpiceInt vgrext[3];\n  SpiceInt cgscal = 0;\n  SpiceInt vtxnpl = 0;\n  SpiceInt voxnpt = 0;\n  SpiceInt voxnpl = 0;\n\n  ${callExpr};\n  if (failed_c() == SPICETRUE) {\n    return v2_write_spice_failure("SPICE error in ${entry.call}");\n  }\n\n  return v2_emit_named_dskb02_outputs(context->json,\n                                      context->tokens,\n                                      context->tokenCount,\n                                      context->outMapTok,\n                                      context->refs,\n                                      context->refCount,\n                                      nv,\n                                      np,\n                                      nvxtot,\n                                      cgscal,\n                                      vtxnpl,\n                                      voxnpt,\n                                      voxnpl);\n}`;
    }
  }

  return assertNever(entry.outputMode);
}

function generateNativeSourceArtifact(manifest: V2SpiceCallManifest): string {
  const generatedFromRelative = path.relative(packageRoot, manifestPath).replaceAll(path.sep, "/");
  const dskb02NamedOutputs = resolveNamedOutputs(manifest);

  const specRows = manifest.calls
    .map((entry) => {
      const argKinds = [...entry.argKinds];
      while (argKinds.length < 3) {
        argKinds.push("intExpr");
      }

      return `    SPEC_ROW(${JSON.stringify(entry.call)},\n             ${entry.arity},\n             ${cArgKindEnum(argKinds[0] as V2SpiceCallArgKind)},\n             ${cArgKindEnum(argKinds[1] as V2SpiceCallArgKind)},\n             ${cArgKindEnum(argKinds[2] as V2SpiceCallArgKind)},\n             ${entry.nonNegativeIntArgMask ?? 0}U,\n             ${cOutputKindEnum(entry.outputMode)},\n             ${cInvokeLaneEnum(entry.invokeLane)}),`;
    })
    .join("\n\n");

  const namedOutputResolutionRows = dskb02NamedOutputs
    .map((name) => {
      return `  if (strcmp(name, ${JSON.stringify(name)}) == 0) {\n    *out = ${name};\n    return true;\n  }`;
    })
    .join("\n");

  const invokerFunctions = manifest.calls.map(generateNativeInvokerFunction).join("\n\n");

  const invokerRows = manifest.calls
    .map(
      (entry) =>
        `    {.name = ${JSON.stringify(entry.call)}, .invoke = v2_invoke_${sanitizeIdentifier(entry.call)}},`,
    )
    .join("\n");

  return `/*
 * AUTO-GENERATED FILE. DO NOT EDIT.
 *
 * Generated by: pnpm -C packages/parity-checking run generate:v2-spice-calls
 * Source of truth: ${generatedFromRelative}
 */

#include "cspice_runner_v2_spice_calls_generated.h"

#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_temp_files.h"
#include "cspice_runner_v2_fixtures.h"

#define SPEC_ROW(_name, _arity, _k0, _k1, _k2, _nonNegMask, _outKind, _invokeLane) \\
  {                                                                               \\
      .name = (_name),                                                            \\
      .arity = (_arity),                                                          \\
      .argKinds = {(_k0), (_k1), (_k2)},                                          \\
      .nonNegativeIntArgMask = (_nonNegMask),                                     \\
      .outputKind = (_outKind),                                                   \\
      .invokeLane = (_invokeLane),                                                \\
  }

static const V2SpiceCallSpec V2_SPICE_CALL_SPECS[] = {
${specRows}
};

#undef SPEC_ROW

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *name) {
  const int count = (int)(sizeof(V2_SPICE_CALL_SPECS) / sizeof(V2_SPICE_CALL_SPECS[0]));
  for (int i = 0; i < count; i++) {
    if (strcmp(V2_SPICE_CALL_SPECS[i].name, name) == 0) {
      return &V2_SPICE_CALL_SPECS[i];
    }
  }

  return NULL;
}

static bool v2_strdup_json_token(const char *json, const jsmntok_t *tok,
                                 char **out) {
  char detail[256];
  detail[0] = '\\0';
  jsmn_strdup_err_t err = jsmn_strdup(json, tok, out, detail, sizeof(detail));
  if (err == JSMN_STRDUP_OK) {
    return true;
  }

  if (err == JSMN_STRDUP_INVALID) {
    write_error_json_ex("invalid_request", "Invalid JSON string escape",
                        detail[0] ? detail : NULL, NULL, NULL, NULL);
  } else {
    write_error_json("Out of memory", NULL, NULL, NULL);
  }

  return false;
}

static bool v2_write_spice_failure(const char *messagePrefix) {
  char shortMsg[1841];
  char longMsg[1841];
  char traceMsg[1841];
  capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                      traceMsg, sizeof(traceMsg));
  write_error_json_ex("spice_error", messagePrefix, NULL, shortMsg, longMsg,
                      traceMsg);
  return false;
}

static bool v2_execute_dskopn_legacy_call(void) {
  char tempPath[PATH_MAX];
  char detail[256];
  detail[0] = '\\0';
  int tempFd = -1;
  if (!build_file_io_temp_path("v2-dskopn", ".bds", tempPath,
                               sizeof(tempPath), &tempFd, detail,
                               sizeof(detail))) {
    write_error_json_ex("invalid_request", "Failed to create DSK temp path",
                        detail[0] ? detail : NULL, NULL, NULL, NULL);
    return false;
  }

  if (tempFd >= 0) {
    close(tempFd);
    tempFd = -1;
  }
  unlink(tempPath);

  SpiceInt handle = 0;
  dskopn_c(tempPath, "TSPICE", 0, &handle);
  if (failed_c() == SPICETRUE) {
    unlink(tempPath);
    return v2_write_spice_failure("SPICE error in dskopn_c");
  }

  dascls_c(handle);
  if (failed_c() == SPICETRUE) {
    unlink(tempPath);
    return v2_write_spice_failure("SPICE error in dascls_c");
  }

  unlink(tempPath);
  return true;
}

static bool v2_execute_dskmi2_legacy_call(void) {
  if ((size_t)DSK_MINIMAL_WORKSZ > SIZE_MAX / sizeof(SpiceInt[2])) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceInt(*work)[2] = (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) *
                                              (size_t)DSK_MINIMAL_WORKSZ);
  if (work == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceDouble spaixd[SPICE_DSK02_IXDFIX];
  SpiceInt spaixi[DSK_MINIMAL_SPXISZ];

  dskmi2_c((SpiceInt)DSK_MINIMAL_NV,
           (SpiceDouble(*)[3])DSK_MINIMAL_VERTICES,
           (SpiceInt)DSK_MINIMAL_NP,
           (SpiceInt(*)[3])DSK_MINIMAL_PLATES,
           0.2,
           5,
           (SpiceInt)DSK_MINIMAL_WORKSZ,
           (SpiceInt)DSK_MINIMAL_VOXPSZ,
           (SpiceInt)DSK_MINIMAL_VOXLSZ,
           SPICETRUE,
           (SpiceInt)DSK_MINIMAL_SPXISZ,
           work,
           spaixd,
           spaixi);

  free(work);

  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in dskmi2_c");
  }

  if (SPICE_DSK02_IXDFIX <= 0 || DSK_MINIMAL_SPXISZ <= 0 ||
      spaixd[0] != spaixd[0] || spaixi[0] < 0) {
    write_error_json_ex("invalid_request",
                        "spiceCall dskmi2_c expected non-empty outputs",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_execute_dskw02_legacy_call(void) {
  char tempPath[PATH_MAX];
  if (!v2_write_minimal_dsk_file("v2-dskw02", tempPath, sizeof(tempPath))) {
    return false;
  }

  unlink(tempPath);
  return true;
}

static bool v2_execute_read_virtual_output_call(const char *path) {
  FILE *fp = fopen(path, "rb");
  if (fp == NULL) {
    char detail[384];
    snprintf(detail, sizeof(detail), "%s (%s)", path, strerror(errno));
    write_error_json_ex("invalid_request",
                        "spiceCall readVirtualOutput failed to open file",
                        detail, NULL, NULL, NULL);
    return false;
  }

  if (fseek(fp, 0, SEEK_END) != 0) {
    fclose(fp);
    write_error_json_ex("invalid_request",
                        "spiceCall readVirtualOutput could not read file size",
                        path, NULL, NULL, NULL);
    return false;
  }

  long size = ftell(fp);
  fclose(fp);
  if (size <= 0) {
    write_error_json_ex("invalid_request",
                        "spiceCall readVirtualOutput expected non-empty bytes",
                        path, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_try_resolve_named_dskb02_value(const char *name,
                                               SpiceInt nv,
                                               SpiceInt np,
                                               SpiceInt nvxtot,
                                               SpiceInt cgscal,
                                               SpiceInt vtxnpl,
                                               SpiceInt voxnpt,
                                               SpiceInt voxnpl,
                                               SpiceInt *out) {
${namedOutputResolutionRows}

  return false;
}

static bool v2_emit_named_dskb02_outputs(const char *json,
                                         const jsmntok_t *tokens,
                                         int tokenCount,
                                         int outMapTok,
                                         V2RefEntry *refs,
                                         int *refCount,
                                         SpiceInt nv,
                                         SpiceInt np,
                                         SpiceInt nvxtot,
                                         SpiceInt cgscal,
                                         SpiceInt vtxnpl,
                                         SpiceInt voxnpt,
                                         SpiceInt voxnpl) {
  const int pairCount = jsmn_object_pair_count(&tokens[outMapTok]);
  if (pairCount < 0) {
    write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int idx = outMapTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING ||
        tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char *outName = NULL;
    char *refName = NULL;
    if (!v2_strdup_json_token(json, &tokens[keyTok], &outName) ||
        !v2_strdup_json_token(json, &tokens[valueTok], &refName)) {
      free(outName);
      free(refName);
      return false;
    }

    SpiceInt value = 0;
    if (!v2_try_resolve_named_dskb02_value(outName,
                                            nv,
                                            np,
                                            nvxtot,
                                            cgscal,
                                            vtxnpl,
                                            voxnpt,
                                            voxnpl,
                                            &value)) {
      write_error_json_ex("invalid_args",
                          "Unsupported dskb02 named out param",
                          outName,
                          NULL,
                          NULL,
                          NULL);
      free(outName);
      free(refName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, refName, value);
    free(outName);
    free(refName);
    if (!ok) {
      return false;
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  return true;
}

${invokerFunctions}

typedef bool (*V2SpiceCallInvokerFn)(const V2SpiceCallInvokeContext *context);

typedef struct {
  const char *name;
  V2SpiceCallInvokerFn invoke;
} V2SpiceCallInvokerEntry;

static const V2SpiceCallInvokerEntry V2_SPICE_CALL_INVOKER_REGISTRY[] = {
${invokerRows}
};

static V2SpiceCallInvokerFn v2_lookup_spice_call_invoker(const char *callName) {
  const size_t count =
      sizeof(V2_SPICE_CALL_INVOKER_REGISTRY) /
      sizeof(V2_SPICE_CALL_INVOKER_REGISTRY[0]);

  for (size_t i = 0; i < count; i++) {
    if (strcmp(V2_SPICE_CALL_INVOKER_REGISTRY[i].name, callName) == 0) {
      return V2_SPICE_CALL_INVOKER_REGISTRY[i].invoke;
    }
  }

  return NULL;
}

bool v2_invoke_spice_call(const V2SpiceCallInvokeContext *context) {
  if (context == NULL || context->spec == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  const char *callName = context->spec->name != NULL ? context->spec->name : context->callName;
  V2SpiceCallInvokerFn invoker = v2_lookup_spice_call_invoker(callName);
  if (invoker == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall",
                        context->callName, NULL, NULL, NULL);
    return false;
  }

  return invoker(context);
}
`;
}

function writeFileEnsuringDir(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, "utf8");
}

function main(): void {
  const manifest = parseManifest();
  validateManifest(manifest);

  writeFileEnsuringDir(tsOutputPath, generateTypeScriptArtifact(manifest));
  writeFileEnsuringDir(nativeHeaderOutputPath, generateNativeHeaderArtifact(manifest));
  writeFileEnsuringDir(nativeSourceOutputPath, generateNativeSourceArtifact(manifest));

  console.log(`[parity-checking] wrote generated v2 spice call artifacts from ${manifestPath}`);
}

main();
