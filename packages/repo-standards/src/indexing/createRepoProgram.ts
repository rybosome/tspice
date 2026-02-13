import path from "node:path";

import * as ts from "typescript";

export interface RepoProgram {
  program: ts.Program;
  checker: ts.TypeChecker;
}

function formatDiagnostics(diags: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diags, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (f) => f,
    getNewLine: () => "\n"
  });
}

export function createRepoProgram(opts: { repoRoot: string }): RepoProgram {
  const configPath = path.join(opts.repoRoot, "tsconfig.json");

  const parsedSolution = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => {
      // We'll surface diagnostics from `getConfigFileParsingDiagnostics()` below.
    }
  });
  if (!parsedSolution) {
    throw new Error(`failed to parse tsconfig: ${configPath}`);
  }

  // Root `tsconfig.json` is a solution-style config (files: [], references: [...]).
  // We use it to resolve referenced projects and then build a single analysis Program.
  const solutionProgram = ts.createProgram({
    rootNames: parsedSolution.fileNames,
    options: parsedSolution.options,
    projectReferences: parsedSolution.projectReferences ?? []
  });

  const resolved = solutionProgram.getResolvedProjectReferences?.() ?? [];

  const rootNames: string[] = [];
  let baseOptions: ts.CompilerOptions | undefined;

  for (const ref of resolved) {
    if (ref === undefined) continue;
    const cmd = ref.commandLine;
    if (!cmd) continue;

    if (!baseOptions && cmd.fileNames.length > 0) {
      baseOptions = cmd.options;
    }

    rootNames.push(...cmd.fileNames);
  }

  const uniqueRootNames = Array.from(new Set(rootNames)).sort();

  if (!baseOptions) {
    throw new Error(`no referenced projects contained source files (from ${configPath})`);
  }

  const {
    rootDir: _rootDir,
    outDir: _outDir,
    tsBuildInfoFile: _tsBuildInfoFile,
    ...rest
  } = baseOptions;

  const compilerOptions: ts.CompilerOptions = {
    ...rest,
    // Ensure all source files are within rootDir so we don't get spurious diagnostics.
    rootDir: opts.repoRoot,
    // This is analysis-only.
    noEmit: true
  };

  const program = ts.createProgram({
    rootNames: uniqueRootNames,
    options: compilerOptions
  });

  const configDiags = program.getConfigFileParsingDiagnostics();
  if (configDiags.length > 0) {
    throw new Error(`tsconfig diagnostics:\n${formatDiagnostics(configDiags)}`);
  }

  return {
    program,
    checker: program.getTypeChecker()
  };
}
