import path from "node:path";

import * as ts from "typescript";

import { createRepoProgram } from "./createRepoProgram.js";
import { extractExportSurface } from "./exportSurface.js";
import { resolvePackageEntrypoints } from "./resolvePackageEntrypoints.js";
import type { RepoIndex, RepoRelativePath } from "./types.js";
import { validatePackageRoots } from "./validatePackageRoots.js";
import { walkExportGraph } from "./walkExportGraph.js";

export interface BuildRepoContextInput {
  repoRoot: string;
  packageRoots: string[];
}

export interface RepoContext {
  repoRoot: string;
  packageRoots: RepoRelativePath[];
  program: ts.Program;
  checker: ts.TypeChecker;
  index: RepoIndex;
}

export async function buildRepoContext(input: BuildRepoContextInput): Promise<RepoContext> {
  const validated = await validatePackageRoots({
    repoRoot: input.repoRoot,
    packageRoots: input.packageRoots
  });

  const { program, checker } = createRepoProgram({ repoRoot: input.repoRoot });

  const packages: RepoIndex["packages"] = [];

  for (const pkg of validated) {
    const entrypoints = await resolvePackageEntrypoints({
      repoRoot: input.repoRoot,
      pkg
    });

    const entrypointAbsPaths = entrypoints.map((p) => path.resolve(input.repoRoot, p));

    const reachableSourceFiles = walkExportGraph({
      repoRoot: input.repoRoot,
      program,
      checker,
      entrypointAbsPaths
    });

    const entrypointSourceFiles = entrypointAbsPaths
      .map((abs) => program.getSourceFile(abs))
      .filter((sf): sf is ts.SourceFile => Boolean(sf));

    if (entrypointSourceFiles.length === 0) {
      throw new Error(
        `failed to load entrypoint source files for ${pkg.packageRoot} (got: ${entrypoints.join(", ")})`
      );
    }

    const { exportedSymbols, exportedCallables } = extractExportSurface({
      repoRoot: input.repoRoot,
      checker,
      entrypointSourceFiles
    });

    packages.push({
      packageRoot: pkg.packageRoot,
      entrypoints,
      reachableSourceFiles,
      exportedSymbols,
      exportedCallables
    });
  }

  const index: RepoIndex = {
    packages
  };

  return {
    repoRoot: input.repoRoot,
    packageRoots: validated.map((p) => p.packageRoot),
    program,
    checker,
    index
  };
}
