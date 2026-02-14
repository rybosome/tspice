import path from "node:path";

import * as ts from "typescript";

import type { Violation } from "../engine/types.js";
import type { SourceLocation } from "../indexing/types.js";
import type { RuleRunInput, RuleRunResult } from "./types.js";

export const id = "require-jsdoc-on-exported-callables";

type TargetDecl = ts.FunctionDeclaration | ts.VariableDeclaration;

function getPositionForSourceLocation(sf: ts.SourceFile, location: SourceLocation): number {
  return sf.getPositionOfLineAndCharacter(location.line - 1, location.col - 1);
}

function getDeclStartForLocation(decl: TargetDecl, sf: ts.SourceFile): number {
  if (ts.isFunctionDeclaration(decl)) {
    return decl.name ? decl.name.getStart(sf) : decl.getStart(sf);
  }

  // VariableDeclaration
  return decl.name.getStart(sf);
}

function findDeclarationAtSourceLocation(opts: {
  sf: ts.SourceFile;
  location: SourceLocation;
}): TargetDecl | undefined {
  const { sf, location } = opts;
  const pos = getPositionForSourceLocation(sf, location);

  let found: TargetDecl | undefined;

  const visit = (node: ts.Node): void => {
    if (found) return;

    // Bail early if the position isn't within this node.
    if (pos < node.getFullStart() || pos >= node.getEnd()) return;

    if (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) {
      if (getDeclStartForLocation(node, sf) === pos) {
        found = node;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);

  return found;
}

function isNonEmptyJsdoc(jsdoc: ts.JSDoc): boolean {
  const commentText = ts.getTextOfJSDocComment(jsdoc.comment);
  if (commentText && commentText.trim().length > 0) return true;

  return Boolean(jsdoc.tags && jsdoc.tags.length > 0);
}

function isNonEmptyJsdocCommentText(rawCommentText: string): boolean {
  if (!rawCommentText.startsWith("/**")) return false;

  // Remove `/**` + `*/`.
  const inner = rawCommentText.replace(/^\/\*\*/, "").replace(/\*\/$/, "");

  const stripped = inner
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim();

  return stripped.length > 0;
}

function nodeHasImmediatelyPrecedingNonEmptyJsdoc(sf: ts.SourceFile, node: ts.Node): boolean {
  const fullText = sf.getFullText();

  const ranges = ts.getLeadingCommentRanges(fullText, node.pos);
  if (!ranges || ranges.length === 0) return false;

  const last = ranges[ranges.length - 1];
  if (!last) return false;

  const lastText = fullText.slice(last.pos, last.end);
  if (!lastText.startsWith("/**")) return false;

  // Prefer TS-parsed JSDoc nodes when possible (handles tags reliably).
  for (const docOrTag of ts.getJSDocCommentsAndTags(node)) {
    if (!ts.isJSDoc(docOrTag)) continue;
    if (docOrTag.pos !== last.pos || docOrTag.end !== last.end) continue;
    return isNonEmptyJsdoc(docOrTag);
  }

  // Fallback for edge cases where TS doesn't surface a matching JSDoc node.
  return isNonEmptyJsdocCommentText(lastText);
}

function declarationHasNonEmptyJsdoc(sf: ts.SourceFile, decl: TargetDecl): boolean {
  if (ts.isFunctionDeclaration(decl)) {
    return nodeHasImmediatelyPrecedingNonEmptyJsdoc(sf, decl);
  }

  // VariableDeclaration: allow docs on the VariableStatement (common case), the declaration,
  // or inline docs on the initializer.
  const declList = decl.parent;
  const stmt = ts.isVariableStatement(declList.parent) ? declList.parent : undefined;
  if (stmt && nodeHasImmediatelyPrecedingNonEmptyJsdoc(sf, stmt)) return true;

  if (nodeHasImmediatelyPrecedingNonEmptyJsdoc(sf, decl)) return true;

  const init = decl.initializer;
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    if (nodeHasImmediatelyPrecedingNonEmptyJsdoc(sf, init)) return true;
  }

  return false;
}

function violationForCallable(opts: {
  packageRoot: string;
  exportName: string;
  location: SourceLocation;
  callId: string;
  message: string;
}): Violation {
  return {
    ruleId: id,
    packageRoot: opts.packageRoot,
    message: opts.message,
    location: {
      filePath: opts.location.filePath,
      line: opts.location.line,
      col: opts.location.col,
      callId: opts.callId
    }
  };
}

/** Run the JSDoc enforcement rule for a single package. */
export function run(input: RuleRunInput): RuleRunResult {
  const pkg = input.ctx.index.packages.find((p) => p.packageRoot === input.packageRoot);
  if (!pkg) return [];

  const violations: Violation[] = [];

  for (const callable of pkg.exportedCallables) {
    const absPath = path.resolve(input.ctx.repoRoot, callable.location.filePath);
    const sf = input.ctx.program.getSourceFile(absPath);

    if (!sf) {
      violations.push(
        violationForCallable({
          packageRoot: input.packageRoot,
          exportName: callable.exportName,
          location: callable.location,
          callId: callable.callId,
          message: `exported callable "${callable.exportName}" could not be checked for JSDoc (missing SourceFile)`
        })
      );
      continue;
    }

    const decl = findDeclarationAtSourceLocation({ sf, location: callable.location });

    if (!decl) {
      violations.push(
        violationForCallable({
          packageRoot: input.packageRoot,
          exportName: callable.exportName,
          location: callable.location,
          callId: callable.callId,
          message: `exported callable "${callable.exportName}" could not be checked for JSDoc (missing declaration)`
        })
      );
      continue;
    }

    if (!declarationHasNonEmptyJsdoc(sf, decl)) {
      violations.push(
        violationForCallable({
          packageRoot: input.packageRoot,
          exportName: callable.exportName,
          location: callable.location,
          callId: callable.callId,
          message: `exported callable "${callable.exportName}" is missing JSDoc`
        })
      );
    }
  }

  return violations;
}
