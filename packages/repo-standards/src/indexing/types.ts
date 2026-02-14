/**
 * Stable, serializable types for repo indexing.
 *
 * All paths MUST be repo-root relative and POSIX ("/") separated.
 */

/** Repo-root relative POSIX path (no leading "./"). */
export type RepoRelativePath = string;

/** Source location within the repo (repo-relative path + 1-based line/col). */
export interface SourceLocation {
  filePath: RepoRelativePath;
  /** 1-based */
  line: number;
  /** 1-based */
  col: number;
}

/** Indexed information about a symbol exported from a package's public entrypoints. */
export interface ExportedSymbolInfo {
  /** Name as exported from the package entrypoint(s). */
  exportName: string;
  /** Name of the original symbol (may differ when re-exported/aliased). */
  originalName: string;
  /** Present when the original declaration is inside the repo root. */
  declaration?: SourceLocation;
  /** True when the export has no value declaration (type-only). */
  isTypeOnly: boolean;
}

/** Indexed exported callable target (function/class/method) that should have JSDoc. */
export interface ExportedCallableTarget {
  /** Name as exported from the package entrypoint(s). */
  exportName: string;
  /**
   * Stable identifier for this callable target.
   *
   * This is intended to align with `ViolationLocation.callId`.
   */
  callId: string;

  /** Location of the original declaration (not the re-export site). */
  location: SourceLocation;

  /** Name of the original callable symbol. */
  originalName: string;
}

/** Public API/export-surface index for a single workspace package. */
export interface PackageIndex {
  packageRoot: RepoRelativePath;

  /** Source entrypoints that define the public API (repo-relative, POSIX). */
  entrypoints: RepoRelativePath[];

  /** Source files reachable from entrypoints by walking the export graph. */
  reachableSourceFiles: RepoRelativePath[];

  /** Export surface for the package (resolved back to original declarations). */
  exportedSymbols: ExportedSymbolInfo[];

  /** Exported callables derived from the public API surface. */
  exportedCallables: ExportedCallableTarget[];
}

/** Export-surface index for the whole repo (all workspace packages). */
export interface RepoIndex {
  packages: PackageIndex[];
}
