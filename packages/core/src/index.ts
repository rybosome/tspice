/** Error thrown when an internal invariant is violated (should never happen in correct usage). */
export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

/**
 * Assert that a condition is truthy.
 *
 * Throws {@link InvariantError} when the assertion fails.
 */
export function invariant(condition: unknown, message = "Invariant violation"): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

/**
 * Exhaustiveness helper for `switch` statements.
 *
 * Throws an error if called.
 */
export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}

/**
 * Normalize a *virtual* kernel identifier so the same `path` works across backends
 * (Node temp-file staging vs WASM `/kernels/...` FS).
 *
 * This is intentionally stricter than general filesystem normalization:
 * - `..` is rejected
 * - leading slashes and `kernels/` prefixes are stripped
 * - repeated slashes and `.` segments are collapsed
 */
export function normalizeVirtualKernelPath(input: string): string {
  // NOTE: Avoid `String.prototype.replaceAll` for compatibility with older
  // JS runtimes / conservative build targets.
  const raw = input.replace(/\\/g, "/").trim();
  if (!raw) {
    throw new Error("Kernel path must be non-empty");
  }

  // Strip leading slashes so `/kernels/foo.tls` behaves like `kernels/foo.tls`.
  let rel = raw.replace(/^\/+/, "");

  // Strip leading `./` segments.
  while (rel.startsWith("./")) {
    rel = rel.slice(2);
  }

  // Strip a leading `kernels/` directory to keep user input flexible.
  // Treat a bare `kernels` segment as equivalent to `kernels/`.
  if (rel === "kernels") {
    rel = "";
  }
  while (rel.startsWith("kernels/")) {
    rel = rel.replace(/^kernels\/+/, "");
  }

  const segments = rel.split("/");
  const out: string[] = [];
  for (const seg of segments) {
    if (!seg || seg === ".") {
      continue;
    }
    if (seg === "..") {
      throw new Error(`Invalid kernel path (.. not allowed): ${input}`);
    }
    out.push(seg);
  }

  if (out.length === 0) {
    throw new Error(`Invalid kernel path: ${input}`);
  }

  return out.join("/");
}

export type { BrandMat3Options } from "./spice-runtime/shared/mat3.js";
export {
  assertMat3ArrayLike9,
  isMat3ArrayLike9,
  brandMat3ColMajor,
  brandMat3RowMajor,
  isBrandedMat3ColMajor,
  isBrandedMat3RowMajor,
} from "./spice-runtime/shared/mat3.js";

export type { BrandVecOptions } from "./spice-runtime/shared/vec.js";
export {
  assertVec3ArrayLike3,
  assertVec6ArrayLike6,
  isVec3ArrayLike3,
  isVec6ArrayLike6,
  brandVec3,
  brandVec6,
  isBrandedVec3,
  isBrandedVec6,
} from "./spice-runtime/shared/vec.js";

export type { BrandMat6Options } from "./spice-runtime/shared/mat6.js";
export {
  assertMat6ArrayLike36,
  isMat6ArrayLike36,
  brandMat6RowMajor,
  isBrandedMat6RowMajor,
} from "./spice-runtime/shared/mat6.js";

export type { AssertSpiceInt32Options } from "./spice-runtime/shared/spice-int.js";
export {
  SPICE_INT32_MIN,
  SPICE_INT32_MAX,
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
} from "./spice-runtime/shared/spice-int.js";

export { SpiceBackendContractError } from "./spice-runtime/shared/errors.js";
export type {
  Found,
  KernelData,
  KernelKind,
  KernelKindInput,
  Mat3ColMajor,
  Mat3RowMajor,
  Mat6RowMajor,
  SpiceHandle,
  SpiceHandleEntry,
  SpiceHandleKind,
  SpiceHandleRegistry,
  Vec3,
  Vec6,
} from "./spice-runtime/shared/types.js";
export { createSpiceHandleRegistry } from "./spice-runtime/shared/spice-handles.js";

export type { GetmsgWhich } from "./spice-runtime/domains/error.js";
export {
  GETMSG_WHICH_VALUES,
  isGetmsgWhich,
  assertGetmsgWhich,
} from "./spice-runtime/domains/error.js";

export { normalizeBodItem } from "./spice-runtime/domains/ids-names-normalize.js";

export {
  kxtrctJs,
  normalizeKindInput,
  nativeKindQueryOrNull,
  matchesKernelKind,
} from "./spice-runtime/domains/kernels-utils.js";
