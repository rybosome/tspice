import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

type FunctionArgKind =
  | "expr"
  | "intExpr"
  | "cellRef"
  | "cellOrWindowRef"
  | "pathExpr"
  | "dasHandleRef"
  | "dlaDescriptorRef";

type FunctionResultMode =
  | "return"
  | "forbidden"
  | "asSpiceInt"
  | "asDskDescriptor"
  | "outNamedDskb02";

type OutputBindingPolicy = "forbidden";

type NativeReturnBindingKind =
  | "generatedReturnBindingLane"
  | "exprStringToJsonString"
  | "exprSpiceIntToJsonStringViaSizedOutBuffer";

const SHARED_RETURN_NATIVE_INVOKER = "v2_invoke_contract_return";
const SHARED_AS_SPICE_INT_NATIVE_INVOKER = "v2_invoke_contract_as_spice_int";
const SHARED_FORBIDDEN_NATIVE_INVOKER = "v2_invoke_contract_forbidden";

const NATIVE_INVOKER_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

type FunctionRegistryEntry = {
  id: string;
  aliases: string[];
  impl: {
    contractMethod: string;
    cSymbol: string;
    nativeInvoker: string;
    returnBinding?: {
      kind: NativeReturnBindingKind;
    };
  };
  arity: number;
  argKinds: FunctionArgKind[];
  nonNegativeIntArgMask?: number;
  result: {
    mode: FunctionResultMode;
    outputBindingPolicy?: OutputBindingPolicy;
  };
};

type ParsedRegistry = {
  version: number;
  functions: FunctionRegistryEntry[];
};

const ALLOWED_ARG_KINDS: ReadonlySet<string> = new Set([
  "expr",
  "intExpr",
  "cellRef",
  "cellOrWindowRef",
  "pathExpr",
  "dasHandleRef",
  "dlaDescriptorRef",
]);

const ALLOWED_RESULT_MODES: ReadonlySet<string> = new Set([
  "return",
  "forbidden",
  "asSpiceInt",
  "asDskDescriptor",
  "outNamedDskb02",
]);

const ALLOWED_RETURN_BINDING_KINDS: ReadonlySet<string> = new Set([
  "generatedReturnBindingLane",
  "exprStringToJsonString",
  "exprSpiceIntToJsonStringViaSizedOutBuffer",
]);
const ALLOWED_OUTPUT_BINDING_POLICIES: ReadonlySet<string> = new Set(["forbidden"]);

const ARG_KIND_ENUM: Record<FunctionArgKind, string> = {
  expr: "V2_FUNCTION_ARG_EXPR",
  intExpr: "V2_FUNCTION_ARG_INT_EXPR",
  cellRef: "V2_FUNCTION_ARG_CELL_REF",
  cellOrWindowRef: "V2_FUNCTION_ARG_CELL_OR_WINDOW_REF",
  pathExpr: "V2_FUNCTION_ARG_PATH_EXPR",
  dasHandleRef: "V2_FUNCTION_ARG_DAS_HANDLE_REF",
  dlaDescriptorRef: "V2_FUNCTION_ARG_DLA_DESCRIPTOR_REF",
};

const RESULT_MODE_ENUM: Record<FunctionResultMode, string> = {
  return: "V2_FUNCTION_RESULT_RETURN",
  forbidden: "V2_FUNCTION_RESULT_FORBIDDEN",
  asSpiceInt: "V2_FUNCTION_RESULT_AS_SPICE_INT",
  asDskDescriptor: "V2_FUNCTION_RESULT_AS_DSK_DESCRIPTOR",
  outNamedDskb02: "V2_FUNCTION_RESULT_OUT_NAMED_DSKB02",
};

const OUTPUT_BINDING_POLICY_ENUM: Record<OutputBindingPolicy | "none", string> = {
  none: "V2_FUNCTION_OUTPUT_BINDING_POLICY_NONE",
  forbidden: "V2_FUNCTION_OUTPUT_BINDING_POLICY_FORBIDDEN",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function asFiniteInt(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be a finite integer`);
  }
  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }

  return value.map((entry, index) => asString(entry, `${label}[${index}]`));
}

function parseRegistry(raw: unknown): ParsedRegistry {
  if (!isRecord(raw)) {
    throw new TypeError("registry must be an object");
  }

  const version = asFiniteInt(raw.version, "registry.version");
  if (version !== 1) {
    throw new TypeError(`registry.version must be 1 (got ${version})`);
  }

  if (!Array.isArray(raw.functions)) {
    throw new TypeError("registry.functions must be an array");
  }

  const functions = raw.functions.map((entry, index) => parseRegistryEntry(entry, `registry.functions[${index}]`));

  return {
    version,
    functions,
  };
}

function parseRegistryEntry(raw: unknown, label: string): FunctionRegistryEntry {
  if (!isRecord(raw)) {
    throw new TypeError(`${label} must be an object`);
  }

  const id = asString(raw.id, `${label}.id`);
  const aliases = asStringArray(raw.aliases ?? [], `${label}.aliases`);

  const implRaw = raw.impl;
  if (!isRecord(implRaw)) {
    throw new TypeError(`${label}.impl must be an object`);
  }

  const contractMethod = asString(implRaw.contractMethod, `${label}.impl.contractMethod`);
  const cSymbol = asString(implRaw.cSymbol, `${label}.impl.cSymbol`);
  const nativeInvoker = asString(implRaw.nativeInvoker, `${label}.impl.nativeInvoker`);
  if (!NATIVE_INVOKER_NAME_REGEX.test(nativeInvoker)) {
    throw new TypeError(`${label}.impl.nativeInvoker must be a valid C identifier (got ${nativeInvoker})`);
  }

  let returnBinding: { kind: NativeReturnBindingKind } | undefined;
  const returnBindingRaw = implRaw.returnBinding;
  if (returnBindingRaw !== undefined) {
    if (!isRecord(returnBindingRaw)) {
      throw new TypeError(`${label}.impl.returnBinding must be an object`);
    }

    const kind = asString(returnBindingRaw.kind, `${label}.impl.returnBinding.kind`);
    if (!ALLOWED_RETURN_BINDING_KINDS.has(kind)) {
      throw new TypeError(
        `${label}.impl.returnBinding.kind must be one of: ${[...ALLOWED_RETURN_BINDING_KINDS].join(", ")}`,
      );
    }

    returnBinding = {
      kind: kind as NativeReturnBindingKind,
    };
  }

  const arity = asFiniteInt(raw.arity, `${label}.arity`);
  if (arity < 0) {
    throw new TypeError(`${label}.arity must be >= 0`);
  }

  const argKindsRaw = asStringArray(raw.argKinds, `${label}.argKinds`);
  if (argKindsRaw.length !== arity) {
    throw new TypeError(`${label}.argKinds length (${argKindsRaw.length}) must equal arity (${arity})`);
  }

  const argKinds = argKindsRaw.map((kind, index) => {
    if (!ALLOWED_ARG_KINDS.has(kind)) {
      throw new TypeError(`${label}.argKinds[${index}] must be one of: ${[...ALLOWED_ARG_KINDS].join(", ")}`);
    }
    return kind as FunctionArgKind;
  });

  const nonNegativeIntArgMaskRaw = raw.nonNegativeIntArgMask;
  let nonNegativeIntArgMask: number | undefined;
  if (nonNegativeIntArgMaskRaw !== undefined) {
    nonNegativeIntArgMask = asFiniteInt(nonNegativeIntArgMaskRaw, `${label}.nonNegativeIntArgMask`);
    if (nonNegativeIntArgMask < 0) {
      throw new TypeError(`${label}.nonNegativeIntArgMask must be >= 0`);
    }

    for (let bit = 0; bit < argKinds.length; bit += 1) {
      const isSet = (nonNegativeIntArgMask & (1 << bit)) !== 0;
      if (isSet && argKinds[bit] !== "intExpr") {
        throw new TypeError(
          `${label}.nonNegativeIntArgMask sets bit ${bit}, but argKinds[${bit}] is ${argKinds[bit]} (expected intExpr)`,
        );
      }
    }
  }

  const resultRaw = raw.result;
  if (!isRecord(resultRaw)) {
    throw new TypeError(`${label}.result must be an object`);
  }
  const mode = asString(resultRaw.mode, `${label}.result.mode`);
  if (!ALLOWED_RESULT_MODES.has(mode)) {
    throw new TypeError(`${label}.result.mode must be one of: ${[...ALLOWED_RESULT_MODES].join(", ")}`);
  }

  let outputBindingPolicy: OutputBindingPolicy | undefined;
  const outputBindingPolicyRaw = resultRaw.outputBindingPolicy;
  if (outputBindingPolicyRaw !== undefined) {
    const policy = asString(outputBindingPolicyRaw, `${label}.result.outputBindingPolicy`);
    if (!ALLOWED_OUTPUT_BINDING_POLICIES.has(policy)) {
      throw new TypeError(
        `${label}.result.outputBindingPolicy must be one of: ${[...ALLOWED_OUTPUT_BINDING_POLICIES].join(", ")}`,
      );
    }

    outputBindingPolicy = policy as OutputBindingPolicy;
  }

  return {
    id,
    aliases,
    impl: {
      contractMethod,
      cSymbol,
      nativeInvoker,
      ...(returnBinding ? { returnBinding } : {}),
    },
    arity,
    argKinds,
    ...(nonNegativeIntArgMask === undefined ? {} : { nonNegativeIntArgMask }),
    result: {
      mode: mode as FunctionResultMode,
      ...(outputBindingPolicy ? { outputBindingPolicy } : {}),
    },
  };
}

function readContractCatalog(catalogPath: string): Set<string> {
  const raw = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new TypeError(`contract catalog must be an array: ${catalogPath}`);
  }

  const methods = new Set<string>();
  for (const [index, entry] of raw.entries()) {
    methods.add(asString(entry, `contractCatalog[${index}]`));
  }

  return methods;
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        out.push(abs);
      }
    }
  }

  return out.sort();
}

function collectNativeSymbols(repoRoot: string, pkgRoot: string): Set<string> {
  const files = [
    ...walkFiles(path.join(repoRoot, "packages", "backend-shim-c", "src")),
    ...walkFiles(path.join(pkgRoot, "native", "src")),
  ].filter((filePath) => filePath.endsWith(".c") || filePath.endsWith(".h"));

  const symbols = new Set<string>();
  const symbolRegex = /\b([A-Za-z_][A-Za-z0-9_]*_c)\s*\(/g;

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    let match = symbolRegex.exec(text);
    while (match) {
      symbols.add(match[1]);
      match = symbolRegex.exec(text);
    }
  }

  return symbols;
}

function collectNativeInvokers(pkgRoot: string): Set<string> {
  const files = walkFiles(path.join(pkgRoot, "native", "src")).filter((filePath) =>
    filePath.endsWith(".c"),
  );

  const invokers = new Set<string>();
  const invokerRegex = /\b(v2_invoke_[A-Za-z0-9_]+)\s*\(/g;

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    let match = invokerRegex.exec(text);
    while (match) {
      invokers.add(match[1]);
      match = invokerRegex.exec(text);
    }
  }

  return invokers;
}

function stableSortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function validateRegistry(
  registry: ParsedRegistry,
  knownContractMethods: ReadonlySet<string>,
  nativeSymbols: ReadonlySet<string>,
  nativeInvokers: ReadonlySet<string>,
): FunctionRegistryEntry[] {
  const idSet = new Set<string>();
  const aliasOwner = new Map<string, string>();

  const normalized = registry.functions.map((entry) => {
    if (idSet.has(entry.id)) {
      throw new Error(`Duplicate function id: ${entry.id}`);
    }
    idSet.add(entry.id);

    if (entry.impl.contractMethod !== entry.id) {
      throw new Error(
        `Function ${entry.id} has impl.contractMethod=${entry.impl.contractMethod}; expected to match id`,
      );
    }

    if (!knownContractMethods.has(entry.impl.contractMethod)) {
      throw new Error(
        `Function ${entry.id} references contract method not present in catalogs/contract-methods.json: ${entry.impl.contractMethod}`,
      );
    }

    if (!nativeSymbols.has(entry.impl.cSymbol)) {
      throw new Error(
        `Function ${entry.id} references native symbol not found in source inventory: ${entry.impl.cSymbol}`,
      );
    }

    if (!nativeInvokers.has(entry.impl.nativeInvoker)) {
      throw new Error(
        `Function ${entry.id} references native invoker not found in source inventory: ${entry.impl.nativeInvoker}`,
      );
    }

    const aliases = stableSortedUnique(entry.aliases);
    for (const alias of aliases) {
      const owner = aliasOwner.get(alias);
      if (owner && owner !== entry.id) {
        throw new Error(`Alias ${alias} is duplicated across function ids: ${owner}, ${entry.id}`);
      }
      aliasOwner.set(alias, entry.id);
    }

    if (entry.result.mode !== "return" && entry.impl.nativeInvoker === SHARED_RETURN_NATIVE_INVOKER) {
      throw new Error(
        `Function ${entry.id} uses nativeInvoker=${SHARED_RETURN_NATIVE_INVOKER} but result.mode is ${entry.result.mode}; expected return`,
      );
    }

    if (entry.impl.returnBinding && entry.result.mode !== "return") {
      throw new Error(
        `Function ${entry.id} defines impl.returnBinding but result.mode is ${entry.result.mode}; expected return`,
      );
    }

    if (entry.impl.returnBinding && entry.impl.nativeInvoker !== SHARED_RETURN_NATIVE_INVOKER) {
      throw new Error(
        `Function ${entry.id} defines impl.returnBinding but nativeInvoker is ${entry.impl.nativeInvoker}; expected ${SHARED_RETURN_NATIVE_INVOKER}`,
      );
    }

    if (entry.impl.returnBinding?.kind === "exprStringToJsonString") {
      if (entry.arity !== 1 || entry.argKinds[0] !== "expr") {
        throw new Error(
          `Function ${entry.id} uses returnBinding.kind=exprStringToJsonString but signature is not (expr)->return`,
        );
      }
    }

    if (entry.impl.returnBinding?.kind === "exprSpiceIntToJsonStringViaSizedOutBuffer") {
      if (entry.arity !== 1 || entry.argKinds[0] !== "expr") {
        throw new Error(
          `Function ${entry.id} uses returnBinding.kind=exprSpiceIntToJsonStringViaSizedOutBuffer but signature is not (expr)->return`,
        );
      }
    }

    if (entry.result.mode === "forbidden" && entry.result.outputBindingPolicy !== "forbidden") {
      throw new Error(
        `Function ${entry.id} uses result.mode=forbidden but result.outputBindingPolicy is ${entry.result.outputBindingPolicy ?? "<unset>"}; expected forbidden`,
      );
    }

    if (entry.result.mode === "forbidden" && entry.impl.nativeInvoker !== SHARED_FORBIDDEN_NATIVE_INVOKER) {
      throw new Error(
        `Function ${entry.id} uses result.mode=forbidden but nativeInvoker is ${entry.impl.nativeInvoker}; expected ${SHARED_FORBIDDEN_NATIVE_INVOKER}`,
      );
    }

    if (entry.result.outputBindingPolicy && entry.result.mode !== "forbidden") {
      throw new Error(
        `Function ${entry.id} defines result.outputBindingPolicy=${entry.result.outputBindingPolicy} but result.mode is ${entry.result.mode}; expected forbidden`,
      );
    }

    if (
      entry.impl.nativeInvoker === SHARED_FORBIDDEN_NATIVE_INVOKER &&
      entry.result.mode !== "forbidden"
    ) {
      throw new Error(
        `Function ${entry.id} uses nativeInvoker=${SHARED_FORBIDDEN_NATIVE_INVOKER} but result.mode is ${entry.result.mode}; expected forbidden`,
      );
    }

    if (entry.result.mode === "asSpiceInt") {
      if (entry.impl.nativeInvoker !== SHARED_AS_SPICE_INT_NATIVE_INVOKER) {
        throw new Error(
          `Function ${entry.id} uses result.mode=asSpiceInt but nativeInvoker is ${entry.impl.nativeInvoker}; expected ${SHARED_AS_SPICE_INT_NATIVE_INVOKER}`,
        );
      }

      if (entry.arity !== 1 || entry.argKinds[0] !== "cellOrWindowRef") {
        throw new Error(
          `Function ${entry.id} uses result.mode=asSpiceInt but signature is not (cellOrWindowRef)->asSpiceInt`,
        );
      }

      if (!entry.impl.cSymbol.endsWith("_c")) {
        throw new Error(
          `Function ${entry.id} uses result.mode=asSpiceInt but cSymbol=${entry.impl.cSymbol} is not a *_c symbol`,
        );
      }
    }

    if (
      entry.impl.nativeInvoker === SHARED_AS_SPICE_INT_NATIVE_INVOKER &&
      entry.result.mode !== "asSpiceInt"
    ) {
      throw new Error(
        `Function ${entry.id} uses nativeInvoker=${SHARED_AS_SPICE_INT_NATIVE_INVOKER} but result.mode is ${entry.result.mode}; expected asSpiceInt`,
      );
    }

    return {
      ...entry,
      aliases,
    };
  });

  return normalized.sort((a, b) => a.id.localeCompare(b.id));
}

function toEnumSegment(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
  return normalized.length > 0 ? normalized : "UNKNOWN";
}

function renderTs(entries: readonly FunctionRegistryEntry[], sourceRelPath: string): string {
  const lines: string[] = [];

  lines.push("/* eslint-disable */");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");

  lines.push("export type FunctionArgKind =");
  for (const kind of [...ALLOWED_ARG_KINDS].sort()) {
    lines.push(`  | \"${kind}\"`);
  }
  lines.push(";");
  lines.push("");

  lines.push("export type FunctionResultMode =");
  for (const mode of [...ALLOWED_RESULT_MODES].sort()) {
    lines.push(`  | \"${mode}\"`);
  }
  lines.push(";");
  lines.push("");

  lines.push("export type OutputBindingPolicy =");
  for (const policy of [...ALLOWED_OUTPUT_BINDING_POLICIES].sort()) {
    lines.push(`  | \"${policy}\"`);
  }
  lines.push(";");
  lines.push("");

  lines.push("export type FunctionRegistryEntry = {");
  lines.push("  id: string;");
  lines.push("  aliases: readonly string[];");
  lines.push("  impl: {");
  lines.push("    contractMethod: string;");
  lines.push("    cSymbol: string;");
  lines.push("    nativeInvoker: string;");
  lines.push("    returnBinding?: {");
  lines.push("      kind:");
  for (const kind of [...ALLOWED_RETURN_BINDING_KINDS].sort()) {
    lines.push(`        | \"${kind}\"`);
  }
  lines.push("      ;");
  lines.push("    };");
  lines.push("  };");
  lines.push("  arity: number;");
  lines.push("  argKinds: readonly FunctionArgKind[];");
  lines.push("  nonNegativeIntArgMask?: number;");
  lines.push("  result: {");
  lines.push("    mode: FunctionResultMode;");
  lines.push("    outputBindingPolicy?: OutputBindingPolicy;");
  lines.push("  };");
  lines.push("};");
  lines.push("");

  lines.push("export const functionRegistry: readonly FunctionRegistryEntry[] = [");
  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(entry.id)},`);
    lines.push(`    aliases: ${JSON.stringify(entry.aliases)},`);
    lines.push("    impl: {");
    lines.push(`      contractMethod: ${JSON.stringify(entry.impl.contractMethod)},`);
    lines.push(`      cSymbol: ${JSON.stringify(entry.impl.cSymbol)},`);
    lines.push(`      nativeInvoker: ${JSON.stringify(entry.impl.nativeInvoker)},`);
    if (entry.impl.returnBinding) {
      lines.push("      returnBinding: {");
      lines.push(`        kind: ${JSON.stringify(entry.impl.returnBinding.kind)},`);
      lines.push("      },");
    }
    lines.push("    },");
    lines.push(`    arity: ${entry.arity},`);
    lines.push(`    argKinds: ${JSON.stringify(entry.argKinds)},`);
    if (entry.nonNegativeIntArgMask !== undefined) {
      lines.push(`    nonNegativeIntArgMask: ${entry.nonNegativeIntArgMask},`);
    }
    if (entry.result.outputBindingPolicy) {
      lines.push("    result: {");
      lines.push(`      mode: ${JSON.stringify(entry.result.mode)},`);
      lines.push(`      outputBindingPolicy: ${JSON.stringify(entry.result.outputBindingPolicy)},`);
      lines.push("    },");
    } else {
      lines.push(`    result: { mode: ${JSON.stringify(entry.result.mode)} },`);
    }
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");

  lines.push("const functionRegistryByName = new Map<string, FunctionRegistryEntry>();");
  lines.push("for (const entry of functionRegistry) {");
  lines.push("  functionRegistryByName.set(entry.id, entry);");
  lines.push("  for (const alias of entry.aliases) {");
  lines.push("    functionRegistryByName.set(alias, entry);");
  lines.push("  }");
  lines.push("}");
  lines.push("");

  lines.push("export function lookupFunctionRegistryEntry(fn: string): FunctionRegistryEntry | undefined {");
  lines.push("  return functionRegistryByName.get(fn);");
  lines.push("}");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderCH(entries: readonly FunctionRegistryEntry[], sourceRelPath: string): string {
  const maxArity = entries.reduce((max, entry) => Math.max(max, entry.arity), 0);

  const idEnumSegments = new Set<string>();
  const idEnumRows: string[] = ["  V2_FUNCTION_ID_UNKNOWN = 0,"];

  for (const entry of entries) {
    const segment = toEnumSegment(entry.id);
    if (idEnumSegments.has(segment)) {
      throw new Error(`Generated C enum name collision for function id: ${entry.id}`);
    }
    idEnumSegments.add(segment);
    idEnumRows.push(`  V2_FUNCTION_ID_${segment},`);
  }

  const lines: string[] = [];
  lines.push("#ifndef PARITY_CHECKING_GENERATED_FUNCTION_REGISTRY_H");
  lines.push("#define PARITY_CHECKING_GENERATED_FUNCTION_REGISTRY_H");
  lines.push("");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("#include <stdbool.h>");
  lines.push("");
  lines.push("typedef enum {");
  lines.push("  V2_FUNCTION_ARG_EXPR = 0,");
  lines.push("  V2_FUNCTION_ARG_INT_EXPR,");
  lines.push("  V2_FUNCTION_ARG_CELL_REF,");
  lines.push("  V2_FUNCTION_ARG_CELL_OR_WINDOW_REF,");
  lines.push("  V2_FUNCTION_ARG_PATH_EXPR,");
  lines.push("  V2_FUNCTION_ARG_DAS_HANDLE_REF,");
  lines.push("  V2_FUNCTION_ARG_DLA_DESCRIPTOR_REF,");
  lines.push("} V2FunctionArgKind;");
  lines.push("");
  lines.push("typedef enum {");
  lines.push("  V2_FUNCTION_RESULT_RETURN = 0,");
  lines.push("  V2_FUNCTION_RESULT_FORBIDDEN,");
  lines.push("  V2_FUNCTION_RESULT_AS_SPICE_INT,");
  lines.push("  V2_FUNCTION_RESULT_AS_DSK_DESCRIPTOR,");
  lines.push("  V2_FUNCTION_RESULT_OUT_NAMED_DSKB02,");
  lines.push("} V2FunctionResultMode;");
  lines.push("");
  lines.push("typedef enum {");
  lines.push("  V2_FUNCTION_OUTPUT_BINDING_POLICY_NONE = 0,");
  lines.push("  V2_FUNCTION_OUTPUT_BINDING_POLICY_FORBIDDEN,");
  lines.push("} V2FunctionOutputBindingPolicy;");
  lines.push("");
  lines.push("typedef enum {");
  lines.push(...idEnumRows);
  lines.push("} V2FunctionId;");
  lines.push("");
  lines.push(`#define V2_FUNCTION_MAX_ARITY ${maxArity}`);
  lines.push("");
  lines.push("typedef struct {");
  lines.push("  V2FunctionId id;");
  lines.push("  const char *idText;");
  lines.push("  int arity;");
  lines.push("  V2FunctionArgKind argKinds[V2_FUNCTION_MAX_ARITY];");
  lines.push("  unsigned int nonNegativeIntArgMask;");
  lines.push("  V2FunctionResultMode resultMode;");
  lines.push("  V2FunctionOutputBindingPolicy outputBindingPolicy;");
  lines.push("  const char *contractMethod;");
  lines.push("  const char *cSymbol;");
  lines.push("} V2FunctionSpec;");
  lines.push("");
  lines.push("const V2FunctionSpec *v2_lookup_function_spec(const char *fn);");
  lines.push("");
  lines.push("#endif");

  return `${lines.join("\n")}\n`;
}

function renderCC(entries: readonly FunctionRegistryEntry[], sourceRelPath: string): string {
  const maxArity = entries.reduce((max, entry) => Math.max(max, entry.arity), 0);

  const idToIndex = new Map<string, number>();
  const idConstById = new Map<string, string>();
  entries.forEach((entry, index) => {
    idToIndex.set(entry.id, index);
    idConstById.set(entry.id, `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`);
  });

  const lines: string[] = [];
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("#include \"generated/function_registry.h\"");
  lines.push("");
  lines.push("#include <stddef.h>");
  lines.push("#include <string.h>");
  lines.push("");

  lines.push("static const V2FunctionSpec V2_FUNCTION_SPECS[] = {");
  for (const entry of entries) {
    const idConst = idConstById.get(entry.id);
    if (!idConst) {
      throw new Error(`Missing generated id const for ${entry.id}`);
    }

    const argKinds = [...entry.argKinds.map((kind) => ARG_KIND_ENUM[kind])];
    while (argKinds.length < maxArity) {
      argKinds.push("V2_FUNCTION_ARG_EXPR");
    }

    lines.push("  {");
    lines.push(`    ${idConst},`);
    lines.push(`    ${JSON.stringify(entry.id)},`);
    lines.push(`    ${entry.arity},`);
    lines.push(`    { ${argKinds.join(", ")} },`);
    lines.push(`    ${entry.nonNegativeIntArgMask ?? 0}u,`);
    lines.push(`    ${RESULT_MODE_ENUM[entry.result.mode]},`);
    lines.push(`    ${OUTPUT_BINDING_POLICY_ENUM[entry.result.outputBindingPolicy ?? "none"]},`);
    lines.push(`    ${JSON.stringify(entry.impl.contractMethod)},`);
    lines.push(`    ${JSON.stringify(entry.impl.cSymbol)},`);
    lines.push("  },");
  }
  lines.push("};");
  lines.push("");

  lines.push("typedef struct {");
  lines.push("  const char *name;");
  lines.push("  size_t specIndex;");
  lines.push("} V2FunctionNameMapEntry;");
  lines.push("");

  const nameMap: Array<{ name: string; index: number }> = [];
  for (const entry of entries) {
    const index = idToIndex.get(entry.id);
    if (index === undefined) continue;
    nameMap.push({ name: entry.id, index });
    for (const alias of entry.aliases) {
      nameMap.push({ name: alias, index });
    }
  }
  nameMap.sort((a, b) => a.name.localeCompare(b.name) || a.index - b.index);

  lines.push("static const V2FunctionNameMapEntry V2_FUNCTION_NAME_MAP[] = {");
  for (const entry of nameMap) {
    lines.push(`  { ${JSON.stringify(entry.name)}, ${entry.index}u },`);
  }
  lines.push("};");
  lines.push("");

  lines.push("const V2FunctionSpec *v2_lookup_function_spec(const char *fn) {");
  lines.push("  if (fn == NULL || fn[0] == '\\0') {");
  lines.push("    return NULL;");
  lines.push("  }");
  lines.push("");
  lines.push("  const size_t nameCount = sizeof(V2_FUNCTION_NAME_MAP) / sizeof(V2_FUNCTION_NAME_MAP[0]);");
  lines.push("  for (size_t i = 0; i < nameCount; i++) {");
  lines.push("    const V2FunctionNameMapEntry entry = V2_FUNCTION_NAME_MAP[i];");
  lines.push("    if (strcmp(fn, entry.name) == 0) {");
  lines.push("      return &V2_FUNCTION_SPECS[entry.specIndex];");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  return NULL;");
  lines.push("}");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

type GeneratedNativeAsSpiceIntBindingKind = "cellOrWindowRefToSpiceInt";

type GeneratedNativeAsSpiceIntBindingEntry = {
  id: string;
  enumId: string;
  cSymbol: string;
  backendMethod: string;
  kind: GeneratedNativeAsSpiceIntBindingKind;
};

const NATIVE_AS_SPICE_INT_BINDING_KIND_C: Record<GeneratedNativeAsSpiceIntBindingKind, string> = {
  cellOrWindowRefToSpiceInt: "V2_NATIVE_AS_SPICE_INT_BINDING_CELL_OR_WINDOW_REF_TO_SPICE_INT",
};

function toBackendMethodFromCSymbol(cSymbol: string, id: string): string {
  if (!cSymbol.endsWith("_c")) {
    throw new Error(`Function ${id} has non-*_c symbol for asSpiceInt binding: ${cSymbol}`);
  }

  const backendMethod = cSymbol.slice(0, -2);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(backendMethod)) {
    throw new Error(`Function ${id} has invalid backend method derived from ${cSymbol}: ${backendMethod}`);
  }

  return backendMethod;
}

function collectGeneratedNativeAsSpiceIntBindings(
  entries: readonly FunctionRegistryEntry[],
): GeneratedNativeAsSpiceIntBindingEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.result.mode === "asSpiceInt" &&
        entry.impl.nativeInvoker === SHARED_AS_SPICE_INT_NATIVE_INVOKER,
    )
    .map((entry) => ({
      id: entry.id,
      enumId: `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`,
      cSymbol: entry.impl.cSymbol,
      backendMethod: toBackendMethodFromCSymbol(entry.impl.cSymbol, entry.id),
      kind: "cellOrWindowRefToSpiceInt",
    }));
}

function renderTsNativeAsSpiceIntBindings(
  entries: readonly GeneratedNativeAsSpiceIntBindingEntry[],
  sourceRelPath: string,
): string {
  const lines: string[] = [];
  lines.push("/* eslint-disable */");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("export type NativeAsSpiceIntBindingKind =");
  lines.push('  | "cellOrWindowRefToSpiceInt"');
  lines.push(";");
  lines.push("");
  lines.push("export type NativeAsSpiceIntBindingEntry = {");
  lines.push("  id: string;");
  lines.push("  enumId: string;");
  lines.push("  cSymbol: string;");
  lines.push("  backendMethod: string;");
  lines.push("  kind: NativeAsSpiceIntBindingKind;");
  lines.push("};");
  lines.push("");
  lines.push("export const nativeAsSpiceIntBindings: readonly NativeAsSpiceIntBindingEntry[] = [");

  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(entry.id)},`);
    lines.push(`    enumId: ${JSON.stringify(entry.enumId)},`);
    lines.push(`    cSymbol: ${JSON.stringify(entry.cSymbol)},`);
    lines.push(`    backendMethod: ${JSON.stringify(entry.backendMethod)},`);
    lines.push(`    kind: ${JSON.stringify(entry.kind)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  lines.push("const nativeAsSpiceIntBindingById = new Map<string, NativeAsSpiceIntBindingEntry>();");
  lines.push("for (const entry of nativeAsSpiceIntBindings) {");
  lines.push("  nativeAsSpiceIntBindingById.set(entry.id, entry);");
  lines.push("}");
  lines.push("");
  lines.push(
    "export function lookupNativeAsSpiceIntBindingEntry(fnId: string): NativeAsSpiceIntBindingEntry | undefined {",
  );
  lines.push("  return nativeAsSpiceIntBindingById.get(fnId);");
  lines.push("}");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderNativeAsSpiceIntBindingsHeader(sourceRelPath: string): string {
  const lines: string[] = [];
  lines.push("#ifndef PARITY_CHECKING_GENERATED_NATIVE_AS_SPICE_INT_BINDINGS_H");
  lines.push("#define PARITY_CHECKING_GENERATED_NATIVE_AS_SPICE_INT_BINDINGS_H");
  lines.push("");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("#include \"cspice_runner_common.h\"");
  lines.push("#include \"generated/function_registry.h\"");
  lines.push("");
  lines.push("typedef enum {");
  lines.push("  V2_NATIVE_AS_SPICE_INT_BINDING_CELL_OR_WINDOW_REF_TO_SPICE_INT = 0,");
  lines.push("} V2NativeAsSpiceIntBindingKind;");
  lines.push("");
  lines.push("typedef SpiceInt (*V2NativeAsSpiceIntCellOrWindowRefToSpiceIntFn)(SpiceCell *cell);");
  lines.push("");
  lines.push("typedef struct {");
  lines.push("  V2FunctionId fnId;");
  lines.push("  const char *fnIdText;");
  lines.push("  const char *cSymbol;");
  lines.push("  V2NativeAsSpiceIntBindingKind kind;");
  lines.push("  V2NativeAsSpiceIntCellOrWindowRefToSpiceIntFn invokeFn;");
  lines.push("} V2NativeAsSpiceIntBindingEntry;");
  lines.push("");
  lines.push("const V2NativeAsSpiceIntBindingEntry *v2_lookup_native_as_spice_int_binding(V2FunctionId fnId);");
  lines.push("");
  lines.push("#endif");

  return `${lines.join("\n")}\n`;
}

function renderNativeAsSpiceIntBindingsSource(
  entries: readonly GeneratedNativeAsSpiceIntBindingEntry[],
  sourceRelPath: string,
): string {
  const lines: string[] = [];
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("#include \"generated/native_as_spice_int_bindings.h\"");
  lines.push("");
  lines.push("#include <stddef.h>");
  lines.push("");
  lines.push("static const V2NativeAsSpiceIntBindingEntry V2_NATIVE_AS_SPICE_INT_BINDINGS[] = {");

  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    ${entry.enumId},`);
    lines.push(`    ${JSON.stringify(entry.id)},`);
    lines.push(`    ${JSON.stringify(entry.cSymbol)},`);
    lines.push(`    ${NATIVE_AS_SPICE_INT_BINDING_KIND_C[entry.kind]},`);
    lines.push(`    ${entry.cSymbol},`);
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");
  lines.push(
    "const V2NativeAsSpiceIntBindingEntry *v2_lookup_native_as_spice_int_binding(V2FunctionId fnId) {",
  );
  lines.push(
    "  const size_t count = sizeof(V2_NATIVE_AS_SPICE_INT_BINDINGS) / sizeof(V2_NATIVE_AS_SPICE_INT_BINDINGS[0]);",
  );
  lines.push("  for (size_t i = 0; i < count; i++) {");
  lines.push("    if (V2_NATIVE_AS_SPICE_INT_BINDINGS[i].fnId == fnId) {");
  lines.push("      return &V2_NATIVE_AS_SPICE_INT_BINDINGS[i];");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  return NULL;");
  lines.push("}");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

type GeneratedNativeReturnBindingEntry = {
  id: string;
  enumId: string;
  cSymbol: string;
  kind: NativeReturnBindingKind;
};

const DEFAULT_NATIVE_RETURN_BINDING_KIND: NativeReturnBindingKind = "generatedReturnBindingLane";

const EXECUTABLE_NATIVE_RETURN_BINDING_KINDS: ReadonlySet<NativeReturnBindingKind> = new Set([
  "generatedReturnBindingLane",
  "exprStringToJsonString",
  "exprSpiceIntToJsonStringViaSizedOutBuffer",
]);

const NATIVE_RETURN_BINDING_KIND_C: Record<GeneratedNativeReturnBindingEntry["kind"], string> = {
  generatedReturnBindingLane: "V2_NATIVE_RETURN_BINDING_GENERATED_RETURN_BINDING_LANE",
  exprStringToJsonString: "V2_NATIVE_RETURN_BINDING_EXPR_STRING_TO_JSON_STRING",
  exprSpiceIntToJsonStringViaSizedOutBuffer:
    "V2_NATIVE_RETURN_BINDING_EXPR_SPICE_INT_TO_JSON_STRING_VIA_SIZED_OUT_BUFFER",
};

function resolveNativeReturnBindingKind(entry: FunctionRegistryEntry): NativeReturnBindingKind {
  return entry.impl.returnBinding?.kind ?? DEFAULT_NATIVE_RETURN_BINDING_KIND;
}

function collectGeneratedNativeReturnBindings(
  entries: readonly FunctionRegistryEntry[],
): GeneratedNativeReturnBindingEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.result.mode === "return" && entry.impl.nativeInvoker === SHARED_RETURN_NATIVE_INVOKER,
    )
    .map((entry) => {
      const kind = resolveNativeReturnBindingKind(entry);
      if (!EXECUTABLE_NATIVE_RETURN_BINDING_KINDS.has(kind)) {
        throw new Error(
          `Function ${entry.id} uses non-executable native return binding metadata kind: ${kind}`,
        );
      }

      return {
        id: entry.id,
        enumId: `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`,
        cSymbol: entry.impl.cSymbol,
        kind,
      };
    });
}

function renderTsNativeReturnBindings(
  entries: readonly GeneratedNativeReturnBindingEntry[],
  sourceRelPath: string,
): string {
  const lines: string[] = [];
  lines.push("/* eslint-disable */");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("export type NativeReturnBindingKind =");
  for (const kind of [...ALLOWED_RETURN_BINDING_KINDS].sort()) {
    lines.push(`  | \"${kind}\"`);
  }
  lines.push(";");
  lines.push("");
  lines.push("export type NativeReturnBindingEntry = {");
  lines.push("  id: string;");
  lines.push("  enumId: string;");
  lines.push("  cSymbol: string;");
  lines.push("  kind: NativeReturnBindingKind;");
  lines.push("};");
  lines.push("");
  lines.push("export const nativeReturnBindings: readonly NativeReturnBindingEntry[] = [");

  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(entry.id)},`);
    lines.push(`    enumId: ${JSON.stringify(entry.enumId)},`);
    lines.push(`    cSymbol: ${JSON.stringify(entry.cSymbol)},`);
    lines.push(`    kind: ${JSON.stringify(entry.kind)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  lines.push("const nativeReturnBindingById = new Map<string, NativeReturnBindingEntry>();");
  lines.push("for (const entry of nativeReturnBindings) {");
  lines.push("  nativeReturnBindingById.set(entry.id, entry);");
  lines.push("}");
  lines.push("");
  lines.push("export function lookupNativeReturnBindingEntry(fnId: string): NativeReturnBindingEntry | undefined {");
  lines.push("  return nativeReturnBindingById.get(fnId);");
  lines.push("}");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderNativeReturnBindingsHeader(sourceRelPath: string): string {
  const lines: string[] = [];
  lines.push("#ifndef PARITY_CHECKING_GENERATED_NATIVE_RETURN_BINDINGS_H");
  lines.push("#define PARITY_CHECKING_GENERATED_NATIVE_RETURN_BINDINGS_H");
  lines.push("");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("#include \"cspice_runner_common.h\"");
  lines.push("#include \"generated/function_registry.h\"");
  lines.push("");
  lines.push("typedef enum {");
  lines.push("  V2_NATIVE_RETURN_BINDING_GENERATED_RETURN_BINDING_LANE = 0,");
  lines.push("  V2_NATIVE_RETURN_BINDING_EXPR_STRING_TO_JSON_STRING,");
  lines.push("  V2_NATIVE_RETURN_BINDING_EXPR_SPICE_INT_TO_JSON_STRING_VIA_SIZED_OUT_BUFFER,");
  lines.push("} V2NativeReturnBindingKind;");
  lines.push("");
  lines.push("typedef const char *(*V2NativeReturnExprStringToJsonStringFn)(const char *value);");
  lines.push(
    "typedef void (*V2NativeReturnExprSpiceIntToJsonStringViaSizedOutBufferFn)(SpiceInt code, SpiceInt outMaxBytes, SpiceChar *outValue);",
  );
  lines.push("");
  lines.push("typedef struct {");
  lines.push("  V2FunctionId fnId;");
  lines.push("  const char *fnIdText;");
  lines.push("  const char *cSymbol;");
  lines.push("  V2NativeReturnBindingKind kind;");
  lines.push("  V2NativeReturnExprStringToJsonStringFn exprStringToJsonStringFn;");
  lines.push(
    "  V2NativeReturnExprSpiceIntToJsonStringViaSizedOutBufferFn exprSpiceIntToJsonStringViaSizedOutBufferFn;",
  );
  lines.push("} V2NativeReturnBindingEntry;");
  lines.push("");
  lines.push("const V2NativeReturnBindingEntry *v2_lookup_native_return_binding(V2FunctionId fnId);");
  lines.push("");
  lines.push("#endif");

  return `${lines.join("\n")}\n`;
}

function renderNativeReturnBindingsSource(
  entries: readonly GeneratedNativeReturnBindingEntry[],
  sourceRelPath: string,
): string {
  const lines: string[] = [];
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("#include \"cspice_runner_common.h\"");
  lines.push("#include \"generated/native_return_bindings.h\"");
  lines.push("");
  lines.push("#include <stddef.h>");
  lines.push("");
  lines.push("static const V2NativeReturnBindingEntry V2_NATIVE_RETURN_BINDINGS[] = {");

  for (const entry of entries) {
    const exprStringToJsonStringFn = entry.kind === "exprStringToJsonString" ? entry.cSymbol : "NULL";
    const exprSpiceIntToJsonStringViaSizedOutBufferFn =
      entry.kind === "exprSpiceIntToJsonStringViaSizedOutBuffer" ? entry.cSymbol : "NULL";
    lines.push("  {");
    lines.push(`    ${entry.enumId},`);
    lines.push(`    ${JSON.stringify(entry.id)},`);
    lines.push(`    ${JSON.stringify(entry.cSymbol)},`);
    lines.push(`    ${NATIVE_RETURN_BINDING_KIND_C[entry.kind]},`);
    lines.push(`    ${exprStringToJsonStringFn},`);
    lines.push(`    ${exprSpiceIntToJsonStringViaSizedOutBufferFn},`);
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");
  lines.push("const V2NativeReturnBindingEntry *v2_lookup_native_return_binding(V2FunctionId fnId) {");
  lines.push("  const size_t count = sizeof(V2_NATIVE_RETURN_BINDINGS) / sizeof(V2_NATIVE_RETURN_BINDINGS[0]);");
  lines.push("  for (size_t i = 0; i < count; i++) {");
  lines.push("    if (V2_NATIVE_RETURN_BINDINGS[i].fnId == fnId) {");
  lines.push("      return &V2_NATIVE_RETURN_BINDINGS[i];");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  return NULL;");
  lines.push("}");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderTsNativeCallDispatch(entries: readonly FunctionRegistryEntry[], sourceRelPath: string): string {
  const lines: string[] = [];
  lines.push("/* eslint-disable */");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("export type NativeCallDispatchEntry = {");
  lines.push("  id: string;");
  lines.push("  enumId: string;");
  lines.push("  cSymbol: string;");
  lines.push("  invoker: string;");
  lines.push("};");
  lines.push("");
  lines.push("export const nativeCallDispatch: readonly NativeCallDispatchEntry[] = [");

  for (const entry of entries) {
    const enumId = `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`;
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(entry.id)},`);
    lines.push(`    enumId: ${JSON.stringify(enumId)},`);
    lines.push(`    cSymbol: ${JSON.stringify(entry.impl.cSymbol)},`);
    lines.push(`    invoker: ${JSON.stringify(entry.impl.nativeInvoker)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");

  lines.push("const nativeCallDispatchById = new Map<string, NativeCallDispatchEntry>();");
  lines.push("for (const entry of nativeCallDispatch) {");
  lines.push("  nativeCallDispatchById.set(entry.id, entry);");
  lines.push("}");
  lines.push("");

  lines.push("export function lookupNativeCallDispatchEntry(fnId: string): NativeCallDispatchEntry | undefined {");
  lines.push("  return nativeCallDispatchById.get(fnId);");
  lines.push("}");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderNativeCallDispatchHeader(entries: readonly FunctionRegistryEntry[], sourceRelPath: string): string {
  const lines: string[] = [];
  lines.push("#ifndef PARITY_CHECKING_GENERATED_NATIVE_CALL_DISPATCH_H");
  lines.push("#define PARITY_CHECKING_GENERATED_NATIVE_CALL_DISPATCH_H");
  lines.push("");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("// X-macro rows for native v2 call dispatch.");
  lines.push("// Usage: V2_NATIVE_CALL_DISPATCH_ROWS(MY_ROW_MACRO)");

  if (entries.length === 0) {
    lines.push("#define V2_NATIVE_CALL_DISPATCH_ROWS(X) /* no callable entries */");
  } else {
    lines.push("#define V2_NATIVE_CALL_DISPATCH_ROWS(X) \\");
    entries.forEach((entry, index) => {
      const idConst = `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`;
      const suffix = index === entries.length - 1 ? "" : ' \\';
      lines.push(`  X(${idConst}, ${entry.impl.nativeInvoker})${suffix}`);
    });
  }

  lines.push("");
  lines.push("#endif");

  return `${lines.join("\n")}\n`;
}

function main(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(scriptDir, "..");
  const repoRoot = path.resolve(pkgRoot, "..", "..");

  const registryPath = path.join(pkgRoot, "registry", "functions.registry.yml");
  const contractCatalogPath = path.join(pkgRoot, "catalogs", "contract-methods.json");

  const rawRegistry = parseYaml(fs.readFileSync(registryPath, "utf8"));
  const parsedRegistry = parseRegistry(rawRegistry);

  const contractMethods = readContractCatalog(contractCatalogPath);
  const nativeSymbols = collectNativeSymbols(repoRoot, pkgRoot);
  const nativeInvokers = collectNativeInvokers(pkgRoot);

  const validatedEntries = validateRegistry(parsedRegistry, contractMethods, nativeSymbols, nativeInvokers);
  const generatedNativeAsSpiceIntBindings = collectGeneratedNativeAsSpiceIntBindings(validatedEntries);
  const generatedNativeReturnBindings = collectGeneratedNativeReturnBindings(validatedEntries);

  const sourceRelPath = path.relative(repoRoot, registryPath).replaceAll(path.sep, "/");

  const tsOutPath = path.join(pkgRoot, "src", "generated", "functionRegistry.ts");
  const tsNativeDispatchOutPath = path.join(pkgRoot, "src", "generated", "nativeCallDispatch.ts");
  const tsNativeAsSpiceIntBindingsOutPath = path.join(
    pkgRoot,
    "src",
    "generated",
    "nativeAsSpiceIntBindings.ts",
  );
  const tsNativeReturnBindingsOutPath = path.join(pkgRoot, "src", "generated", "nativeReturnBindings.ts");
  const cHeaderOutPath = path.join(pkgRoot, "native", "src", "generated", "function_registry.h");
  const cSourceOutPath = path.join(pkgRoot, "native", "src", "generated", "function_registry.c");
  const cNativeDispatchHeaderOutPath = path.join(pkgRoot, "native", "src", "generated", "native_call_dispatch.h");
  const cNativeAsSpiceIntBindingsHeaderOutPath = path.join(
    pkgRoot,
    "native",
    "src",
    "generated",
    "native_as_spice_int_bindings.h",
  );
  const cNativeAsSpiceIntBindingsSourceOutPath = path.join(
    pkgRoot,
    "native",
    "src",
    "generated",
    "native_as_spice_int_bindings.c",
  );
  const cNativeReturnBindingsHeaderOutPath = path.join(
    pkgRoot,
    "native",
    "src",
    "generated",
    "native_return_bindings.h",
  );
  const cNativeReturnBindingsSourceOutPath = path.join(
    pkgRoot,
    "native",
    "src",
    "generated",
    "native_return_bindings.c",
  );

  fs.mkdirSync(path.dirname(tsOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(cHeaderOutPath), { recursive: true });

  fs.writeFileSync(tsOutPath, renderTs(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(tsNativeDispatchOutPath, renderTsNativeCallDispatch(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(
    tsNativeAsSpiceIntBindingsOutPath,
    renderTsNativeAsSpiceIntBindings(generatedNativeAsSpiceIntBindings, sourceRelPath),
    "utf8",
  );
  fs.writeFileSync(
    tsNativeReturnBindingsOutPath,
    renderTsNativeReturnBindings(generatedNativeReturnBindings, sourceRelPath),
    "utf8",
  );
  fs.writeFileSync(cHeaderOutPath, renderCH(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(cSourceOutPath, renderCC(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(
    cNativeDispatchHeaderOutPath,
    renderNativeCallDispatchHeader(validatedEntries, sourceRelPath),
    "utf8",
  );
  fs.writeFileSync(
    cNativeAsSpiceIntBindingsHeaderOutPath,
    renderNativeAsSpiceIntBindingsHeader(sourceRelPath),
    "utf8",
  );
  fs.writeFileSync(
    cNativeAsSpiceIntBindingsSourceOutPath,
    renderNativeAsSpiceIntBindingsSource(generatedNativeAsSpiceIntBindings, sourceRelPath),
    "utf8",
  );
  fs.writeFileSync(
    cNativeReturnBindingsHeaderOutPath,
    renderNativeReturnBindingsHeader(sourceRelPath),
    "utf8",
  );
  fs.writeFileSync(
    cNativeReturnBindingsSourceOutPath,
    renderNativeReturnBindingsSource(generatedNativeReturnBindings, sourceRelPath),
    "utf8",
  );

  console.log(
    `[parity-checking] wrote function registry (${validatedEntries.length}) -> ${tsOutPath}, ${tsNativeDispatchOutPath}, ${tsNativeAsSpiceIntBindingsOutPath}, ${tsNativeReturnBindingsOutPath}, ${cHeaderOutPath}, ${cSourceOutPath}, ${cNativeDispatchHeaderOutPath}, ${cNativeAsSpiceIntBindingsHeaderOutPath}, ${cNativeAsSpiceIntBindingsSourceOutPath}, ${cNativeReturnBindingsHeaderOutPath}, ${cNativeReturnBindingsSourceOutPath}`,
  );
}

main();
