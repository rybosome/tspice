import { compareValues } from "../compare/compare.js";
import { formatMismatchReport } from "../compare/report.js";

import type { V3ContractResultProperty, V3ContractResultSpec } from "./types.js";

const SPICE_INT32_MIN = -2147483648;
const SPICE_INT32_MAX = 2147483647;

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    return String(value);
  }

  try {
    const s = JSON.stringify(value);
    return s === undefined ? String(value) : s;
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(
  value: unknown,
  label: string,
  fail: (message: string) => never,
): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(`${label} must be an object (got ${formatValue(value)})`);
  }
  return value;
}

function assertSpiceInt(value: unknown, label: string, fail: (message: string) => never): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    fail(`${label} must be a finite integer (got ${formatValue(value)})`);
  }

  if (value < SPICE_INT32_MIN || value > SPICE_INT32_MAX) {
    fail(`${label} must be within SpiceInt32 range [${SPICE_INT32_MIN}, ${SPICE_INT32_MAX}]`);
  }

  return value;
}

function validateResultProperty(
  propertyLabel: string,
  descriptor: V3ContractResultProperty,
  value: unknown,
  fail: (message: string) => never,
): void {
  if (descriptor.const !== undefined && value !== descriptor.const) {
    fail(`${propertyLabel} must equal const ${formatValue(descriptor.const)} (got ${formatValue(value)})`);
  }

  if (descriptor.type === "spiceInt") {
    assertSpiceInt(value, propertyLabel, fail);
  }
}

/**
 * Validate a runtime result against a schema-v2 method `contract.result` declaration.
 *
 * The `fail` callback controls error classification (`invalid_request` in runner code,
 * generic Error in engine parity checks, etc.).
 */
export function validateV2ContractResultOrThrow(
  runtimeResult: unknown,
  contractResult: V3ContractResultSpec,
  label: string,
  fail: (message: string) => never,
): void {
  if ("const" in contractResult) {
    const cmp = compareValues(runtimeResult, contractResult.const);
    if (!cmp.ok) {
      fail(`${label} must match contract.result.const:\n${formatMismatchReport(cmp.mismatches)}`);
    }
    return;
  }

  const resultObj = assertRecord(runtimeResult, label, fail);

  for (const requiredKey of contractResult.required ?? []) {
    if (!Object.prototype.hasOwnProperty.call(resultObj, requiredKey)) {
      fail(`${label} missing required key ${JSON.stringify(requiredKey)}`);
    }
  }

  for (const [key, descriptor] of Object.entries(contractResult.properties)) {
    if (!Object.prototype.hasOwnProperty.call(resultObj, key)) {
      continue;
    }

    validateResultProperty(`${label}.${key}`, descriptor, resultObj[key], fail);
  }
}
