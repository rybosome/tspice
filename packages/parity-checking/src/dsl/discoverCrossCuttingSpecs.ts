import * as fs from "node:fs";
import * as path from "node:path";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function discoverYamlFiles(rootDir: string): string[] {
  const out: string[] = [];

  if (!fs.existsSync(rootDir)) {
    return out;
  }

  const visit = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => stableSort(a.name, b.name));

    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
        continue;
      }

      if (entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))) {
        out.push(abs);
      }
    }
  };

  visit(rootDir);
  return out;
}

export function discoverCrossCuttingSpecs(rootDir: string): string[] {
  return discoverYamlFiles(rootDir);
}
