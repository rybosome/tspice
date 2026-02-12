import type { Violation } from "../engine/types.js";

function cmp(a: string | undefined, b: string | undefined): number {
  const aa = a ?? "";
  const bb = b ?? "";
  if (aa < bb) return -1;
  if (aa > bb) return 1;
  return 0;
}

function cmpNum(a: number | undefined, b: number | undefined): number {
  const aa = a ?? -1;
  const bb = b ?? -1;
  return aa - bb;
}

export function sortViolations(violations: Violation[]): Violation[] {
  return [...violations].sort((a, b) => {
    const locA = a.location ?? {};
    const locB = b.location ?? {};

    return (
      cmp(a.ruleId, b.ruleId) ||
      cmp(a.packageRoot, b.packageRoot) ||
      cmp(locA.filePath, locB.filePath) ||
      cmpNum(locA.line, locB.line) ||
      cmpNum(locA.col, locB.col) ||
      cmp(locA.callId, locB.callId) ||
      cmp(a.message, b.message)
    );
  });
}
