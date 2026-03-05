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

type FunctionInvokeKind = "backendMethod" | "spice";

type FunctionRegistryEntry = {
  id: string;
  aliases: string[];
  impl: {
    contractMethod: string;
    cSymbol: string;
    invoke: FunctionInvokeKind;
  };
  arity: number;
  argKinds: FunctionArgKind[];
  nonNegativeIntArgMask?: number;
  result: {
    mode: FunctionResultMode;
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

const ALLOWED_INVOKE_KINDS: ReadonlySet<string> = new Set(["backendMethod", "spice"]);

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

const INVOKE_KIND_ENUM: Record<FunctionInvokeKind, string> = {
  backendMethod: "V2_FUNCTION_INVOKE_BACKEND_METHOD",
  spice: "V2_FUNCTION_INVOKE_SPICE",
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
  const invoke = asString(implRaw.invoke, `${label}.impl.invoke`);
  if (!ALLOWED_INVOKE_KINDS.has(invoke)) {
    throw new TypeError(`${label}.impl.invoke must be one of: ${[...ALLOWED_INVOKE_KINDS].join(", ")}`);
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

  return {
    id,
    aliases,
    impl: {
      contractMethod,
      cSymbol,
      invoke: invoke as FunctionInvokeKind,
    },
    arity,
    argKinds,
    ...(nonNegativeIntArgMask === undefined ? {} : { nonNegativeIntArgMask }),
    result: {
      mode: mode as FunctionResultMode,
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

  // Internal pseudo-symbol used by parity fixtures.
  symbols.add("readVirtualOutput");

  return symbols;
}

function stableSortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function validateRegistry(
  registry: ParsedRegistry,
  knownContractMethods: ReadonlySet<string>,
  nativeSymbols: ReadonlySet<string>,
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

    const aliases = stableSortedUnique(entry.aliases);
    for (const alias of aliases) {
      const owner = aliasOwner.get(alias);
      if (owner && owner !== entry.id) {
        throw new Error(`Alias ${alias} is duplicated across function ids: ${owner}, ${entry.id}`);
      }
      aliasOwner.set(alias, entry.id);
    }

    if (entry.impl.invoke === "spice" && entry.result.mode === "return") {
      throw new Error(`Function ${entry.id} uses invoke=spice with result.mode=return (unsupported)`);
    }

    if (entry.impl.invoke === "backendMethod" && entry.result.mode !== "return") {
      throw new Error(
        `Function ${entry.id} uses invoke=backendMethod and must use result.mode=return (got ${entry.result.mode})`,
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

function toIdentifierSegment(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (normalized.length === 0) {
    return "unknown";
  }

  return /^[0-9]/.test(normalized) ? `_${normalized}` : normalized;
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

  lines.push("export type FunctionInvokeKind = \"backendMethod\" | \"spice\";");
  lines.push("");

  lines.push("export type FunctionRegistryEntry = {");
  lines.push("  id: string;");
  lines.push("  aliases: readonly string[];");
  lines.push("  impl: {");
  lines.push("    contractMethod: string;");
  lines.push("    cSymbol: string;");
  lines.push("    invoke: FunctionInvokeKind;");
  lines.push("  };");
  lines.push("  arity: number;");
  lines.push("  argKinds: readonly FunctionArgKind[];");
  lines.push("  nonNegativeIntArgMask?: number;");
  lines.push("  result: { mode: FunctionResultMode };");
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
    lines.push(`      invoke: ${JSON.stringify(entry.impl.invoke)},`);
    lines.push("    },");
    lines.push(`    arity: ${entry.arity},`);
    lines.push(`    argKinds: ${JSON.stringify(entry.argKinds)},`);
    if (entry.nonNegativeIntArgMask !== undefined) {
      lines.push(`    nonNegativeIntArgMask: ${entry.nonNegativeIntArgMask},`);
    }
    lines.push(`    result: { mode: ${JSON.stringify(entry.result.mode)} },`);
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
  lines.push("  V2_FUNCTION_INVOKE_BACKEND_METHOD = 0,");
  lines.push("  V2_FUNCTION_INVOKE_SPICE,");
  lines.push("} V2FunctionInvokeKind;");
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
  lines.push("  V2FunctionInvokeKind invokeKind;");
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
    lines.push(`    ${INVOKE_KIND_ENUM[entry.impl.invoke]},`);
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

function renderTsNativeCallDispatch(entries: readonly FunctionRegistryEntry[], sourceRelPath: string): string {
  const spiceEntries = entries.filter((entry) => entry.impl.invoke === "spice");

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

  for (const entry of spiceEntries) {
    const enumId = `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`;
    const invoker = `v2_invoke_${toIdentifierSegment(entry.impl.cSymbol)}`;
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(entry.id)},`);
    lines.push(`    enumId: ${JSON.stringify(enumId)},`);
    lines.push(`    cSymbol: ${JSON.stringify(entry.impl.cSymbol)},`);
    lines.push(`    invoker: ${JSON.stringify(invoker)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderNativeCallDispatchHeader(entries: readonly FunctionRegistryEntry[], sourceRelPath: string): string {
  const spiceEntries = entries.filter((entry) => entry.impl.invoke === "spice");

  const lines: string[] = [];
  lines.push("#ifndef PARITY_CHECKING_GENERATED_NATIVE_CALL_DISPATCH_H");
  lines.push("#define PARITY_CHECKING_GENERATED_NATIVE_CALL_DISPATCH_H");
  lines.push("");
  lines.push("// GENERATED FILE - DO NOT EDIT.");
  lines.push(`// Source: ${sourceRelPath}`);
  lines.push("");
  lines.push("// X-macro rows for native spice call dispatch.");
  lines.push("// Usage: V2_NATIVE_CALL_DISPATCH_ROWS(MY_ROW_MACRO)");

  if (spiceEntries.length === 0) {
    lines.push("#define V2_NATIVE_CALL_DISPATCH_ROWS(X) /* no spice-invoke entries */");
  } else {
    lines.push("#define V2_NATIVE_CALL_DISPATCH_ROWS(X) \\");
    spiceEntries.forEach((entry, index) => {
      const idConst = `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`;
      const invoker = `v2_invoke_${toIdentifierSegment(entry.impl.cSymbol)}`;
      const suffix = index === spiceEntries.length - 1 ? "" : ' \\';
      lines.push(`  X(${idConst}, ${invoker})${suffix}`);
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

  const validatedEntries = validateRegistry(parsedRegistry, contractMethods, nativeSymbols);

  const sourceRelPath = path.relative(repoRoot, registryPath).replaceAll(path.sep, "/");

  const tsOutPath = path.join(pkgRoot, "src", "generated", "functionRegistry.ts");
  const tsNativeDispatchOutPath = path.join(pkgRoot, "src", "generated", "nativeCallDispatch.ts");
  const cHeaderOutPath = path.join(pkgRoot, "native", "src", "generated", "function_registry.h");
  const cSourceOutPath = path.join(pkgRoot, "native", "src", "generated", "function_registry.c");
  const cNativeDispatchHeaderOutPath = path.join(pkgRoot, "native", "src", "generated", "native_call_dispatch.h");

  fs.mkdirSync(path.dirname(tsOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(cHeaderOutPath), { recursive: true });

  fs.writeFileSync(tsOutPath, renderTs(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(tsNativeDispatchOutPath, renderTsNativeCallDispatch(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(cHeaderOutPath, renderCH(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(cSourceOutPath, renderCC(validatedEntries, sourceRelPath), "utf8");
  fs.writeFileSync(
    cNativeDispatchHeaderOutPath,
    renderNativeCallDispatchHeader(validatedEntries, sourceRelPath),
    "utf8",
  );

  console.log(
    `[parity-checking] wrote function registry (${validatedEntries.length}) -> ${tsOutPath}, ${tsNativeDispatchOutPath}, ${cHeaderOutPath}, ${cSourceOutPath}, ${cNativeDispatchHeaderOutPath}`,
  );
}

main();
