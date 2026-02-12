export type BenchmarkContractSchemaVersionV1 = 1;

export type FixtureRootsV1 = Readonly<Record<string, string>>;

/**
 * A fixture reference string.
 *
 * v1 supports `$FIXTURES/<path>` and `$<ROOT>/<path>` where `<ROOT>` is a key in
 * `fixtureRoots`.
 */
export type FixtureRefV1 = string;

export interface SetupV1 {
  /** List of kernel fixture references to load during setup. */
  readonly kernels?: readonly FixtureRefV1[];
}

export interface DefaultsV1 {
  readonly setup?: SetupV1;
}

export type BenchmarkKindV1 = "micro" | "workflow";

export interface BenchmarkBaseV1 {
  readonly id: string;
  readonly kind: BenchmarkKindV1;

  /** Optional measurement configuration (shape intentionally opaque for now). */
  readonly measure?: unknown;

  /** Optional per-benchmark setup overrides. */
  readonly setup?: SetupV1;
}

export interface MicroCaseV1 {
  readonly call: string;
  readonly args?: unknown;
}

export interface MicroBenchmarkV1 extends BenchmarkBaseV1 {
  readonly kind: "micro";
  readonly cases: readonly MicroCaseV1[];
}

export interface WorkflowStepV1 {
  readonly call: string;
  readonly args?: unknown;

  /** Save the step output into a variable for later steps. */
  readonly saveAs?: string;

  /** Optional sink identifier (runner-defined). */
  readonly sink?: string | boolean;
}

export interface WorkflowBenchmarkV1 extends BenchmarkBaseV1 {
  readonly kind: "workflow";
  readonly steps: readonly WorkflowStepV1[];
}

export type BenchmarkV1 = MicroBenchmarkV1 | WorkflowBenchmarkV1;

export interface BenchmarkSuiteV1 {
  readonly schemaVersion: 1;
  readonly suite?: string;

  /**
   * Named fixture root directories.
   *
   * Example:
   *
   * ```yml
   * fixtureRoots:
   *   FIXTURES: packages/tspice/test/fixtures
   *   KERNELS: packages/tspice/test/fixtures/kernels
   * ```
   */
  readonly fixtureRoots?: FixtureRootsV1;

  readonly defaults?: DefaultsV1;

  readonly benchmarks: readonly BenchmarkV1[];
}

export interface ValidationError {
  readonly path: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

export interface ValidateBenchmarkSuiteV1Options {
  /**
   * Repository root used to resolve fixture roots/paths.
   *
   * The CLI uses the repo root next to `scripts/`.
   */
  readonly repoRoot: string;

  /**
   * Whether to perform fixture filesystem checks during validation.
   *
   * When enabled (default), validation performs **synchronous filesystem IO**
   * (e.g. `fs.statSync`, `fs.realpathSync`) to:
   *
   * - ensure declared `fixtureRoots` exist (and are directories)
   * - ensure referenced fixture files exist (and are files)
   * - enforce realpath-based containment so refs cannot escape their root via
   *   symlinks
   *
   * When disabled (`false`), validation still enforces pure path-traversal
   * containment (`..`), but **skips** root/file existence checks and symlink
   * containment guarantees.
   */
  readonly checkFixtureExistence?: boolean;

  /**
   * Whether to enforce realpath-based containment checks (symlink containment)
   * when validating fixture refs.
   *
   * Defaults to the same value as `checkFixtureExistence` for backwards
   * compatibility.
   */
  readonly checkFixtureSymlinkContainment?: boolean;

  /**
   * Default fixture roots that will be merged with any contract-provided
   * `fixtureRoots`.
   */
  readonly defaultFixtureRoots?: FixtureRootsV1;

  /**
   * Optional hook to validate benchmark `call` strings.
   *
   * This is runner-defined (the contract only requires a non-empty string).
   *
   * Return a message to report a validation error at the `.../call` path, or
   * `undefined` when the call is valid.
   */
  readonly validateCall?: (call: string) => string | undefined;
}
