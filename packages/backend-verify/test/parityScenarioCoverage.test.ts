import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it } from "vitest";

import * as ts from "typescript";

import { loadScenarioYamlFile } from "../src/dsl/load.js";
import { parseScenario } from "../src/dsl/parse.js";
import { PARITY_SCENARIO_DENYLIST } from "../src/parity/parityScenarioDenylist.js";

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function readSourceFile(filePath: string): ts.SourceFile {
  const text = fs.readFileSync(filePath, "utf8");
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function getExportedInterface(sourceFile: ts.SourceFile, interfaceName: string): ts.InterfaceDeclaration | null {
  for (const stmt of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) continue;
    if (stmt.name.text !== interfaceName) continue;

    const isExported = (ts.getCombinedModifierFlags(stmt) & ts.ModifierFlags.Export) !== 0;
    if (!isExported) continue;

    return stmt;
  }

  return null;
}

function extractSpiceBackendApis(indexSourceFile: ts.SourceFile): string[] {
  for (const stmt of indexSourceFile.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) continue;
    if (stmt.name.text !== "SpiceBackend") continue;

    const extendsClause = stmt.heritageClauses?.find((c) => c.token === ts.SyntaxKind.ExtendsKeyword);
    if (!extendsClause) {
      throw new Error("SpiceBackend has no extends clause (unexpected)");
    }

    const apiNames = extendsClause.types
      .map((t) => t.expression)
      .map((expr) => (ts.isIdentifier(expr) ? expr.text : expr.getText(indexSourceFile)))
      .filter((n) => n.endsWith("Api"));

    return apiNames;
  }

  throw new Error("Could not find interface SpiceBackend in backend-contract/src/index.ts");
}

function computeContractKeys({ indexPath, domainsDir }: { indexPath: string; domainsDir: string }): string[] {
  const indexSf = readSourceFile(indexPath);
  const apiNames = extractSpiceBackendApis(indexSf);

  const domainFiles = fs
    .readdirSync(domainsDir)
    .filter((f) => f.endsWith(".ts"))
    .sort(stableCompare);

  const keys: string[] = [];

  for (const apiName of apiNames) {
    let apiFilePath: string | null = null;

    for (const file of domainFiles) {
      const p = path.join(domainsDir, file);
      const sf = readSourceFile(p);
      const iface = getExportedInterface(sf, apiName);
      if (iface) {
        apiFilePath = p;
        break;
      }
    }

    if (!apiFilePath) {
      throw new Error(`Could not locate exported interface ${apiName} in backend-contract/src/domains/*.ts`);
    }

    const domain = path.basename(apiFilePath, ".ts");
    const sf = readSourceFile(apiFilePath);
    const iface = getExportedInterface(sf, apiName);
    if (!iface) {
      throw new Error(`Found file for ${apiName} but could not re-locate exported interface (unexpected): ${apiFilePath}`);
    }

    const methodNames = new Set<string>();
    for (const member of iface.members) {
      if (!ts.isMethodSignature(member)) continue;

      // Ignore overloads by de-duping on name.
      const name = member.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        methodNames.add(name.text);
      } else {
        throw new Error(
          `Unsupported method name kind while parsing ${apiName} in ${apiFilePath}: ${ts.SyntaxKind[name.kind]}`,
        );
      }
    }

    for (const methodName of Array.from(methodNames).sort(stableCompare)) {
      keys.push(`${domain}.${methodName}`);
    }
  }

  // Determinism + guard against accidental duplication.
  return Array.from(new Set(keys)).sort(stableCompare);
}

async function computeScenarioCalls(scenariosDir: string): Promise<Set<string>> {
  const scenarioFiles = fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith(".yml"))
    .sort(stableCompare);

  const calls = new Set<string>();

  for (const file of scenarioFiles) {
    const scenarioPath = path.join(scenariosDir, file);

    const yamlFile = await loadScenarioYamlFile(scenarioPath);
    const scenario = parseScenario(yamlFile);

    for (const c of scenario.cases) {
      calls.add(c.call);
    }
  }

  return calls;
}

describe("backend-verify parity scenario coverage", () => {
  it("covers SpiceBackend contract calls (or explicitly denylisted)", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const scenariosDir = path.resolve(testDir, "../scenarios");

    const contractIndexPath = path.resolve(testDir, "../../backend-contract/src/index.ts");
    const contractDomainsDir = path.resolve(testDir, "../../backend-contract/src/domains");

    const contractKeys = computeContractKeys({ indexPath: contractIndexPath, domainsDir: contractDomainsDir }).sort(
      stableCompare,
    );

    const scenarioCalls = await computeScenarioCalls(scenariosDir);

    const denylist = Array.from(PARITY_SCENARIO_DENYLIST);

    // Nice-to-have: assert denylist itself is deterministic.
    const denylistSorted = [...denylist].sort(stableCompare);
    if (denylist.join("\n") !== denylistSorted.join("\n")) {
      throw new Error(
        [
          "PARITY_SCENARIO_DENYLIST must be sorted (deterministic).",
          "Suggested fix: regenerate via node ./packages/backend-verify/scripts/gen-parity-denylist.mjs --ts",
        ].join("\n"),
      );
    }

    if (new Set(denylist).size !== denylist.length) {
      throw new Error("PARITY_SCENARIO_DENYLIST must not contain duplicates.");
    }

    const contractSet = new Set(contractKeys);
    const denySet = new Set(denylist);

    const unknownDenylist = Array.from(denySet)
      .filter((k) => !contractSet.has(k))
      .sort(stableCompare);

    if (unknownDenylist.length > 0) {
      throw new Error(
        [
          `unknownDenylist (${unknownDenylist.length}) - denylist entries not present in SpiceBackend contract:`,
          ...unknownDenylist.map((k) => `  - ${k}`),
        ].join("\n"),
      );
    }

    const missing = contractKeys.filter((k) => !scenarioCalls.has(k) && !denySet.has(k)).sort(stableCompare);

    if (missing.length > 0) {
      throw new Error(
        [
          `missing (${missing.length}) - SpiceBackend contract methods not covered by parity scenarios:`,
          ...missing.map((k) => `  - ${k}`),
        ].join("\n"),
      );
    }
  });
});
