import path from "node:path";

import * as ts from "typescript";

import type { Violation } from "../engine/types.js";
import type { SourceLocation } from "../indexing/types.js";
import type { RuleRunInput, RuleRunResult } from "./types.js";

export const id = "require-jsdoc-on-exported-callables";

type TargetDecl = ts.FunctionDeclaration | ts.VariableStatement;

function findDeclarationFromToken(token: ts.Node): TargetDecl | undefined {
  let current: ts.Node | undefined = token;
  while (current) {
    if (ts.isFunctionDeclaration(current)) return current;
    if (ts.isVariableStatement(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function getTokenForSourceLocation(opts: {
  sf: ts.SourceFile;
  location: SourceLocation;
}): ts.Node | undefined {
  const { sf, location } = opts;
  const pos = sf.getPositionOfLineAndCharacter(location.line - 1, location.col - 1);

  // `getTokenAtPosition` returns the token *containing* `pos`, so prefer the identifier itself
  // when we're on the identifier start.
  return ts.getTokenAtPosition(sf, pos);
}

function getLastLeadingCommentText(sf: ts.SourceFile, node: ts.Node): string | null {
  const fullText = sf.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.pos);
  if (!ranges || ranges.length === 0) return null;

  const last = ranges[ranges.length - 1];
  if (!last) return null;
  return fullText.slice(last.pos, last.end);
}

function isNonEmptyJsdocComment(rawCommentText: string): boolean {
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

function violationForCallable(opts: {
  packageRoot: string;
  exportName: string;
  location: SourceLocation;
  callId: string;
}): Violation {
  return {
    ruleId: id,
    packageRoot: opts.packageRoot,
    message: `exported callable "${opts.exportName}" is missing JSDoc`,
    location: {
      filePath: opts.location.filePath,
      line: opts.location.line,
      col: opts.location.col,
      callId: opts.callId
    }
  };
}

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
          callId: callable.callId
        })
      );
      continue;
    }

    const token = getTokenForSourceLocation({ sf, location: callable.location });
    const decl = token ? findDeclarationFromToken(token) : undefined;

    if (!decl) {
      violations.push(
        violationForCallable({
          packageRoot: input.packageRoot,
          exportName: callable.exportName,
          location: callable.location,
          callId: callable.callId
        })
      );
      continue;
    }

    const lastLeadingComment = getLastLeadingCommentText(sf, decl);
    if (!lastLeadingComment || !isNonEmptyJsdocComment(lastLeadingComment)) {
      violations.push(
        violationForCallable({
          packageRoot: input.packageRoot,
          exportName: callable.exportName,
          location: callable.location,
          callId: callable.callId
        })
      );
    }
  }

  return violations;
}
