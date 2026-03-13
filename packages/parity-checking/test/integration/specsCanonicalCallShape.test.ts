import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

function collectSpecFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }

      if (entry.isFile() && full.endsWith("@v3.yml")) {
        out.push(full);
      }
    }
  }

  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

describe("method specs migration: canonical call step only", () => {
  it("contains no legacy authored workflow call forms", () => {
    const root = path.join(process.cwd(), "specs", "methods");
    const files = collectSpecFiles(root);

    expect(files.length).toBeGreaterThan(0);

    for (const filePath of files) {
      const text = fs.readFileSync(filePath, "utf8");
      expect(text).not.toMatch(/\bop:\s*(callContract|spiceCall|withResource)\b/);
      expect(text).toMatch(/\bop:\s*call\b/);
    }
  });
});
