import path from "node:path";

import * as ts from "typescript";

import { isWithinRepoRoot, toRepoRelativePath } from "./pathUtils.js";
import type { RepoRelativePath } from "./types.js";

function resolveModuleToFile(opts: {
  program: ts.Program;
  containingFile: string;
  moduleName: string;
}): string | undefined {
  const resolved = ts.resolveModuleName(
    opts.moduleName,
    opts.containingFile,
    opts.program.getCompilerOptions(),
    ts.sys
  );

  const resolvedFile = resolved.resolvedModule?.resolvedFileName;
  if (!resolvedFile) return undefined;

  // We only care about source files.
  if (resolvedFile.endsWith(".d.ts")) return undefined;

  return resolvedFile;
}

function getImportModuleSpecifierText(decl: ts.Declaration): string | undefined {
  if (ts.isImportSpecifier(decl)) {
    const importDecl = decl.parent.parent.parent;
    if (ts.isImportDeclaration(importDecl) && ts.isStringLiteralLike(importDecl.moduleSpecifier)) {
      return importDecl.moduleSpecifier.text;
    }
  }

  if (ts.isNamespaceImport(decl)) {
    const importDecl = decl.parent.parent;
    if (ts.isImportDeclaration(importDecl) && ts.isStringLiteralLike(importDecl.moduleSpecifier)) {
      return importDecl.moduleSpecifier.text;
    }
  }

  if (ts.isImportClause(decl)) {
    const importDecl = decl.parent;
    if (ts.isImportDeclaration(importDecl) && ts.isStringLiteralLike(importDecl.moduleSpecifier)) {
      return importDecl.moduleSpecifier.text;
    }
  }

  if (ts.isImportEqualsDeclaration(decl)) {
    if (ts.isExternalModuleReference(decl.moduleReference)) {
      const expr = decl.moduleReference.expression;
      if (expr && ts.isStringLiteralLike(expr)) return expr.text;
    }
  }

  return undefined;
}

function tryGetImportModuleSpecifierForSymbol(checker: ts.TypeChecker, sym: ts.Symbol): string | undefined {

  // Prefer value declaration, but fall back to any declaration (some imports are type-only).
  const decls: readonly ts.Declaration[] = sym.valueDeclaration
    ? [sym.valueDeclaration]
    : sym.declarations ?? [];

  for (const decl of decls) {
    const text = getImportModuleSpecifierText(decl);
    if (text) return text;
  }

  // If this is an alias symbol, its target might have import declarations too.
  if (sym.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(sym);
    const aliasedDecls: readonly ts.Declaration[] = aliased.valueDeclaration
      ? [aliased.valueDeclaration]
      : aliased.declarations ?? [];

    for (const decl of aliasedDecls) {
      const text = getImportModuleSpecifierText(decl);
      if (text) return text;
    }
  }

  return undefined;
}

export function walkExportGraph(opts: {
  repoRoot: string;
  program: ts.Program;
  checker: ts.TypeChecker;
  entrypointAbsPaths: string[];
}): RepoRelativePath[] {
  const visited = new Set<string>();
  const queue = [...opts.entrypointAbsPaths].sort();

  while (queue.length > 0) {
    const fileName = queue.shift();
    if (!fileName) continue;

    const absFileName = path.resolve(fileName);
    if (visited.has(absFileName)) continue;
    visited.add(absFileName);

    const sf = opts.program.getSourceFile(absFileName);
    if (!sf) continue;

    const nextFiles: string[] = [];

    for (const stmt of sf.statements) {
      if (!ts.isExportDeclaration(stmt)) continue;

      // `export * from "..."` and `export { X } from "..."`.
      if (stmt.moduleSpecifier && ts.isStringLiteralLike(stmt.moduleSpecifier)) {
        const resolved = resolveModuleToFile({
          program: opts.program,
          containingFile: absFileName,
          moduleName: stmt.moduleSpecifier.text
        });

        if (resolved && isWithinRepoRoot(opts.repoRoot, resolved)) {
          nextFiles.push(resolved);
        }

        continue;
      }

      // Local `export { X }` (often used for import+export re-exports).
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const spec of stmt.exportClause.elements) {
          const localSym = opts.checker.getExportSpecifierLocalTargetSymbol(spec);
          if (!localSym) continue;

          const modName = tryGetImportModuleSpecifierForSymbol(opts.checker, localSym);
          if (!modName) continue;

          const resolved = resolveModuleToFile({
            program: opts.program,
            containingFile: absFileName,
            moduleName: modName
          });

          if (resolved && isWithinRepoRoot(opts.repoRoot, resolved)) {
            nextFiles.push(resolved);
          }
        }
      }
    }

    nextFiles.sort();
    queue.push(...nextFiles);
  }

  const reachable: RepoRelativePath[] = [];
  for (const abs of visited) {
    if (!isWithinRepoRoot(opts.repoRoot, abs)) continue;
    if (abs.endsWith(".d.ts")) continue;
    reachable.push(toRepoRelativePath(opts.repoRoot, abs));
  }

  return reachable.sort();
}
