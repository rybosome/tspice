import type {
  FunctionRegistryBufferSpec,
  FunctionRegistryCatalog,
  FunctionRegistryFunctionSpec,
  FunctionRegistryOutputSpec,
  FunctionRegistrySource,
} from "./functionRegistryTypes.js";
import type { ScenarioYamlFile } from "./types.js";

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object (got ${formatValue(value)})`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array (got ${formatValue(value)})`);
  }
  return value;
}

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string (got ${formatValue(value)})`);
  }
  return value;
}

function asPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer (got ${formatValue(value)})`);
  }
  return value;
}

function ensureKnownKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new TypeError(
        `${label} has unknown key ${JSON.stringify(key)} (allowed keys: ${allowed.map((entry) => JSON.stringify(entry)).join(", ")})`,
      );
    }
  }
}

function ensureRelativeFieldOrder(
  record: Record<string, unknown>,
  orderedKeys: readonly string[],
  label: string,
): void {
  const keys = Object.keys(record);
  let previousIndex = -1;

  for (const orderedKey of orderedKeys) {
    const idx = keys.indexOf(orderedKey);
    if (idx === -1) {
      continue;
    }

    if (idx < previousIndex) {
      throw new TypeError(
        `${label} must keep canonical field order ${orderedKeys.join(" -> ")} (found order: ${keys.join(", ")})`,
      );
    }

    previousIndex = idx;
  }
}

function parseExpressionMap(value: unknown, label: string): Record<string, string> {
  const record = asRecord(value, label);
  const out: Record<string, string> = {};

  for (const [key, entry] of Object.entries(record)) {
    if (key.trim() === "") {
      throw new TypeError(`${label} must not contain blank keys`);
    }

    out[key] = asNonEmptyString(entry, `${label}.${key}`);
  }

  return out;
}

function parseInputArray(value: unknown, label: string): string[] {
  const entries = asArray(value, label);
  const out: string[] = [];
  const seen = new Set<string>();

  entries.forEach((entry, index) => {
    const name = asNonEmptyString(entry, `${label}[${index}]`);

    if (seen.has(name)) {
      throw new TypeError(`${label} contains duplicate argument name ${JSON.stringify(name)}`);
    }

    seen.add(name);
    out.push(name);
  });

  return out;
}

function parseOutputValue(value: unknown, label: string): FunctionRegistryOutputSpec {
  const record = asRecord(value, label);
  ensureKnownKeys(record, ["from", "type"], label);

  const from = asNonEmptyString(record.from, `${label}.from`);
  if (from !== "return" && !from.startsWith("out.")) {
    throw new TypeError(
      `${label}.from must be \"return\" or out.<name> (got ${JSON.stringify(from)})`,
    );
  }

  const out: {
    value: {
      from: "return" | `out.${string}`;
      type?: string;
    };
  } = {
    value: {
      from: from === "return" ? "return" : (from as `out.${string}`),
    },
  };

  if (record.type !== undefined) {
    out.value.type = asNonEmptyString(record.type, `${label}.type`);
  }

  return out;
}

function parseOutputPayload(value: unknown, label: string): FunctionRegistryOutputSpec {
  const payload = parseExpressionMap(value, label);
  if (Object.keys(payload).length === 0) {
    throw new TypeError(`${label} must contain at least one payload field`);
  }

  for (const [field, from] of Object.entries(payload)) {
    if (from !== "return" && !from.startsWith("out.")) {
      throw new TypeError(
        `${label}.${field} must be \"return\" or out.<name> (got ${JSON.stringify(from)})`,
      );
    }
  }

  return { payload };
}

function parseOutput(value: unknown, label: string): FunctionRegistryOutputSpec {
  const record = asRecord(value, label);
  ensureKnownKeys(record, ["value", "payload"], label);

  const hasValue = Object.prototype.hasOwnProperty.call(record, "value");
  const hasPayload = Object.prototype.hasOwnProperty.call(record, "payload");

  if (hasValue === hasPayload) {
    throw new TypeError(`${label} must define exactly one of output.value or output.payload`);
  }

  if (hasValue) {
    return parseOutputValue(record.value, `${label}.value`);
  }

  return parseOutputPayload(record.payload, `${label}.payload`);
}

function parseBufferSpec(value: unknown, label: string): FunctionRegistryBufferSpec {
  const record = asRecord(value, label);
  ensureKnownKeys(record, ["bytes", "lengthFrom", "elementType"], label);

  const hasBytes = Object.prototype.hasOwnProperty.call(record, "bytes");
  const hasLengthFrom = Object.prototype.hasOwnProperty.call(record, "lengthFrom");

  if (hasBytes === hasLengthFrom) {
    throw new TypeError(`${label} must define exactly one of bytes or lengthFrom`);
  }

  const elementType =
    record.elementType === undefined
      ? undefined
      : asNonEmptyString(record.elementType, `${label}.elementType`);

  if (hasBytes) {
    const bytesObj = asRecord(record.bytes, `${label}.bytes`);
    ensureKnownKeys(bytesObj, ["min", "max"], `${label}.bytes`);

    const min = asPositiveInteger(bytesObj.min, `${label}.bytes.min`);
    const max = asPositiveInteger(bytesObj.max, `${label}.bytes.max`);
    if (min > max) {
      throw new TypeError(`${label}.bytes.min must be <= bytes.max (got ${min} > ${max})`);
    }

    return {
      bytes: { min, max },
      ...(elementType === undefined ? {} : { elementType }),
    };
  }

  const lengthFrom = asNonEmptyString(record.lengthFrom, `${label}.lengthFrom`);

  return {
    lengthFrom,
    ...(elementType === undefined ? {} : { elementType }),
  };
}

function parseBuffers(value: unknown, label: string): Record<string, FunctionRegistryBufferSpec> {
  const record = asRecord(value, label);
  const out: Record<string, FunctionRegistryBufferSpec> = {};

  for (const [bufferName, bufferSpec] of Object.entries(record)) {
    if (bufferName.trim() === "") {
      throw new TypeError(`${label} must not contain blank buffer names`);
    }
    out[bufferName] = parseBufferSpec(bufferSpec, `${label}.${bufferName}`);
  }

  if (Object.keys(out).length === 0) {
    throw new TypeError(`${label} must contain at least one buffer entry`);
  }

  return out;
}

function parseFunctionSpec(value: unknown, label: string): FunctionRegistryFunctionSpec {
  const record = asRecord(value, label);
  ensureKnownKeys(record, ["key", "input", "output", "buffers"], label);
  ensureRelativeFieldOrder(record, ["input", "output", "buffers"], label);

  const out: FunctionRegistryFunctionSpec = {
    key: asNonEmptyString(record.key, `${label}.key`),
    input: parseInputArray(record.input, `${label}.input`),
  };

  if (record.output !== undefined) {
    out.output = parseOutput(record.output, `${label}.output`);
  }

  if (record.buffers !== undefined) {
    out.buffers = parseBuffers(record.buffers, `${label}.buffers`);
  }

  return out;
}

function parseRegistryDocument(data: unknown, label: "functionRegistrySource" | "functionRegistryCatalog") {
  const record = asRecord(data, label);
  ensureKnownKeys(record, ["dslVersion", "functions"], label);

  const dslVersion = asPositiveInteger(record.dslVersion, `${label}.dslVersion`);
  if (dslVersion !== 1) {
    throw new TypeError(`${label}.dslVersion must be 1 (got ${formatValue(record.dslVersion)})`);
  }

  const functions = asArray(record.functions, `${label}.functions`).map((entry, index) =>
    parseFunctionSpec(entry, `${label}.functions[${index}]`),
  );

  if (functions.length === 0) {
    throw new TypeError(`${label}.functions must be a non-empty array`);
  }

  const seenKeys = new Set<string>();
  for (const fn of functions) {
    if (seenKeys.has(fn.key)) {
      throw new TypeError(`${label}.functions has duplicate key ${JSON.stringify(fn.key)}`);
    }
    seenKeys.add(fn.key);
  }

  return {
    dslVersion: 1 as const,
    functions,
  };
}

/** Parse and validate canonical `specs/function-registry/function-registry.yaml`. */
export function parseFunctionRegistrySource(file: ScenarioYamlFile): FunctionRegistrySource {
  return parseRegistryDocument(file.data, "functionRegistrySource");
}

/** Parse and validate generated `catalogs/function-registry.json`. */
export function parseFunctionRegistryCatalog(data: unknown): FunctionRegistryCatalog {
  return parseRegistryDocument(data, "functionRegistryCatalog");
}
