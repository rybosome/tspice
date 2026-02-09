export type PathSegment = string | number;

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function formatPath(path: readonly PathSegment[]): string {
  let out = "$";

  for (const segment of path) {
    if (typeof segment === "number") {
      out += `[${segment}]`;
      continue;
    }

    if (IDENTIFIER_RE.test(segment)) {
      out += `.${segment}`;
      continue;
    }

    const escaped = segment.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
    out += `['${escaped}']`;
  }

  return out;
}
