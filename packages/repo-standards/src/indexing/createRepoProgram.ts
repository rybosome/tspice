import path from "node:path";

import * as ts from "typescript";

export interface RepoProgram {
  program: ts.Program;
  checker: ts.TypeChecker;

  /** Must match the Program's module resolution assumptions. */
  moduleResolutionHost: ts.ModuleResolutionHost;
  moduleResolutionCache: ts.ModuleResolutionCache;
}

function formatDiagnostics(diags: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diags, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (f) => (ts.sys.useCaseSensitiveFileNames ? f : f.toLowerCase()),
    getNewLine: () => "\n"
  });
}

export function createRepoProgram(opts: { repoRoot: string }): RepoProgram {
  const configPath = path.join(opts.repoRoot, "tsconfig.json");

  const unrecoverable: ts.Diagnostic[] = [];

  const parsedSolution = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => unrecoverable.push(d)
  });
  if (!parsedSolution) {
    const details = unrecoverable.length > 0 ? `\n${formatDiagnostics(unrecoverable)}` : "";
    throw new Error(`failed to parse tsconfig: ${configPath}${details}`);
  }

  const parseDiagnostics = [...(parsedSolution.errors ?? []), ...unrecoverable];
  if (parseDiagnostics.length > 0) {
    throw new Error(`tsconfig parse diagnostics:\n${formatDiagnostics(parseDiagnostics)}`);
  }

  // Root `tsconfig.json` is often a solution-style config (files: [], references: [...]).
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

  // Support non-solution root `tsconfig.json` (or solution configs that also include files).
  if (parsedSolution.fileNames.length > 0) {
    if (!baseOptions) baseOptions = parsedSolution.options;
    rootNames.push(...parsedSolution.fileNames);
  }

  const uniqueRootNames = Array.from(new Set(rootNames)).sort();

  if (!baseOptions || uniqueRootNames.length === 0) {
    throw new Error(`no source files found from ${configPath}`);
  }

  const base = baseOptions as ts.CompilerOptions & { configFilePath?: string };
  const {
    rootDir: _rootDir,
    outDir: _outDir,
    tsBuildInfoFile: _tsBuildInfoFile,
    configFilePath: _configFilePath,
    composite: _composite,
    incremental: _incremental,
    declaration: _declaration,
    declarationMap: _declarationMap,
    sourceMap: _sourceMap,
    ...rest
  } = base;

  const compilerOptions: ts.CompilerOptions = {
    ...rest,
    // Ensure all source files are within rootDir so we don't get spurious diagnostics.
    rootDir: opts.repoRoot,
    // This is analysis-only.
    noEmit: true,
    // This Program is intended for analysis only, not building.
    allowImportingTsExtensions: true,
    composite: false,
    incremental: false,
    declaration: false,
    declarationMap: false,
    sourceMap: false
  };

  const host = ts.createCompilerHost(compilerOptions, true);
  host.getCurrentDirectory = () => opts.repoRoot;

  const getCanonicalFileName = (f: string) => (host.useCaseSensitiveFileNames() ? f : f.toLowerCase());
  const moduleResolutionCache = ts.createModuleResolutionCache(
    host.getCurrentDirectory(),
    getCanonicalFileName,
    compilerOptions
  );

  const projectReferences = parsedSolution.projectReferences ?? [];

  let rootNamesForProgram = uniqueRootNames;

  if (projectReferences.length > 0) {
    // When project references are present, we cannot pass referenced project source files as rootNames
    // (TypeScript treats that as an invalid build graph and reports TS6305). Instead, keep the
    // references on the Program, and pull sources in via a synthetic root module that imports them.
    rootNamesForProgram = [path.join(opts.repoRoot, "__tspice_repo_indexing_entrypoint__.ts")];
    const [analysisRootFile] = rootNamesForProgram;
    if (!analysisRootFile) {
      throw new Error("failed to compute analysis root file path");
    }

    const analysisRootContents = uniqueRootNames
      .map((abs) => {
        const rel = path.relative(opts.repoRoot, abs).split(path.sep).join(path.posix.sep);
        const spec = rel.startsWith(".") ? rel : `./${rel}`;
        return `import ${JSON.stringify(spec)};`;
      })
      .join("\n");

    const origFileExists = host.fileExists.bind(host);
    const origReadFile = host.readFile.bind(host);

    host.fileExists = (fileName) =>
      path.resolve(fileName) === analysisRootFile ? true : origFileExists(fileName);

    host.readFile = (fileName) =>
      path.resolve(fileName) === analysisRootFile ? analysisRootContents : origReadFile(fileName);

    // Allow analyzing referenced projects without requiring their build outputs on disk.
    (host as ts.CompilerHost & { useSourceOfProjectReferenceRedirect?: () => boolean }).useSourceOfProjectReferenceRedirect =
      () => true;
  }

  const program = ts.createProgram({
    rootNames: rootNamesForProgram,
    options: compilerOptions,
    ...(projectReferences.length > 0 ? { projectReferences } : {}),
    host
  });

  const configDiags = program.getConfigFileParsingDiagnostics();
  if (configDiags.length > 0) {
    throw new Error(`tsconfig diagnostics:\n${formatDiagnostics(configDiags)}`);
  }

  const optionsDiags = program.getOptionsDiagnostics();
  if (optionsDiags.length > 0) {
    throw new Error(`tsc options diagnostics:\n${formatDiagnostics(optionsDiags)}`);
  }

  return {
    program,
    checker: program.getTypeChecker(),
    moduleResolutionHost: host,
    moduleResolutionCache
  };
}
