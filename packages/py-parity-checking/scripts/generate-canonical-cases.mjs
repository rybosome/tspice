import fs from "node:fs";
import path from "node:path";

import * as ts from "typescript";

const repoRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const backendContractRoot = path.join(repoRoot, "packages", "backend-contract", "src");
const pyParityRoot = path.join(repoRoot, "packages", "py-parity-checking");

const indexPath = path.join(backendContractRoot, "index.ts");
const domainsDir = path.join(backendContractRoot, "domains");

/**
 * Method-specific auto-case overrides used where tspice and SpiceyPy differ on missing-arg behavior.
 * These keep deterministic fixed coverage while aligning lane semantics.
 */
const CASE_OVERRIDES = {
  "coords-vectors.georec": {
    args: [0, 0, 0, 6378.137, 1 / 298.257223563],
    expectation: "success",
    description: "Auto-generated canonical success call with deterministic Earth reference values.",
  },
  "coords-vectors.latrec": {
    args: [1, 0, 0],
    expectation: "success",
    description: "Auto-generated canonical success call with unit-radius spherical coordinates.",
  },
  "coords-vectors.sphrec": {
    args: [1, 0, 0],
    expectation: "success",
    description: "Auto-generated canonical success call with unit-radius spherical coordinates.",
  },
  "frames.ccifrm": {
    args: [1, 1],
    expectation: "success",
    description: "Auto-generated canonical success call using frame class 1 / class ID 1.",
  },
  "frames.cidfrm": {
    args: [0],
    expectation: "success",
    description: "Auto-generated canonical success call using center ID 0.",
  },
  "frames.frinfo": {
    args: [1],
    expectation: "success",
    description: "Auto-generated canonical success call for frame code 1 (J2000).",
  },
  "frames.frmnam": {
    args: [1],
    expectation: "success",
    description: "Auto-generated canonical success call for frame code 1 (J2000).",
  },
  "geometry-gf.gfsstp": {
    args: [1],
    expectation: "success",
    description: "Auto-generated canonical success call with positive step size.",
  },
  "geometry-gf.gfstol": {
    args: [1e-6],
    expectation: "success",
    description: "Auto-generated canonical success call with positive convergence tolerance.",
  },
  "geometry-gf.gfstep": {
    workflow: [
      { op: "geometry-gf.gfsstp", args: [1] },
      { op: "geometry-gf.gfstep", args: [0] },
    ],
    expectation: "success",
    description: "Auto-generated canonical success workflow that initializes GF step size before stepping.",
  },
  "ids-names.bodc2n": {
    args: [0],
    expectation: "success",
    description: "Auto-generated canonical success call for body ID 0.",
  },
  "ids-names.bodc2s": {
    args: [0],
    expectation: "success",
    description: "Auto-generated canonical success call for body ID 0.",
  },
  "kernels.kdata": {
    args: [0, "ALL"],
    expectation: "success",
    description: "Auto-generated canonical success call returning found=false when no kernels are loaded.",
  },
  "kernels.ktotal": {
    args: ["ALL"],
    expectation: "success",
    description: "Auto-generated canonical success call with explicit kind=ALL.",
  },
};

function readSourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function domainFromApiName(apiName) {
  return apiName
    .slice(0, -"Api".length)
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function extractApiNamesFromTypeReference(typeRef) {
  if (!ts.isIdentifier(typeRef.typeName)) {
    throw new Error(`Unsupported type reference: ${typeRef.getText()}`);
  }

  const name = typeRef.typeName.text;
  if (name.endsWith("Api")) {
    return [name];
  }

  if (name === "Pick" || name === "Omit") {
    const firstTypeArg = typeRef.typeArguments?.[0];
    if (!firstTypeArg || !ts.isTypeReferenceNode(firstTypeArg)) {
      throw new Error(`Unsupported ${name}<...> shape while extracting SpiceRawBackend`);
    }
    return extractApiNamesFromTypeReference(firstTypeArg);
  }

  throw new Error(`Unsupported extends composition type while extracting SpiceRawBackend: ${name}`);
}

function extractRawApiNames(indexSourceFile) {
  for (const statement of indexSourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    if (statement.name.text !== "SpiceRawBackend") continue;

    const extendsClause = statement.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
    );

    if (!extendsClause) {
      throw new Error("SpiceRawBackend has no extends clause");
    }

    const apiNames = [];
    for (const heritageType of extendsClause.types) {
      if (!ts.isIdentifier(heritageType.expression)) {
        throw new Error(`Unsupported heritage type expression: ${heritageType.getText(indexSourceFile)}`);
      }

      const name = heritageType.expression.text;
      if (name.endsWith("Api")) {
        apiNames.push(name);
        continue;
      }

      if (name === "Pick" || name === "Omit") {
        const wrapped = heritageType.typeArguments?.[0];
        if (!wrapped || !ts.isTypeReferenceNode(wrapped)) {
          throw new Error(`Unsupported ${name}<...> while extracting SpiceRawBackend`);
        }
        apiNames.push(...extractApiNamesFromTypeReference(wrapped));
        continue;
      }

      throw new Error(`Unsupported composition member in SpiceRawBackend: ${name}`);
    }

    return Array.from(new Set(apiNames)).sort();
  }

  throw new Error("Could not find exported interface SpiceRawBackend in backend-contract index.ts");
}

function loadExportedInterfaces() {
  const interfaces = new Map();

  for (const fileName of fs.readdirSync(domainsDir).filter((entry) => entry.endsWith(".ts"))) {
    const filePath = path.join(domainsDir, fileName);
    const sourceFile = readSourceFile(filePath);

    for (const statement of sourceFile.statements) {
      if (!ts.isInterfaceDeclaration(statement)) continue;
      const isExported =
        (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) !== 0;
      if (!isExported) continue;
      interfaces.set(statement.name.text, statement);
    }
  }

  return interfaces;
}

function requiredParamCount(methodSignature) {
  let count = 0;
  for (const parameter of methodSignature.parameters) {
    if (parameter.dotDotDotToken) continue;
    if (parameter.questionToken) continue;
    if (parameter.initializer) continue;
    count += 1;
  }
  return count;
}

function computeCanonicalRawMethodMetadata() {
  const indexSourceFile = readSourceFile(indexPath);
  const apiNames = extractRawApiNames(indexSourceFile);
  const interfaces = loadExportedInterfaces();

  const entries = [];

  for (const apiName of apiNames) {
    const iface = interfaces.get(apiName);
    if (!iface) {
      throw new Error(`Could not find exported interface ${apiName} under backend-contract/src/domains`);
    }

    const domain = domainFromApiName(apiName);
    const methods = new Map();

    for (const member of iface.members) {
      if (!ts.isMethodSignature(member)) continue;

      let methodName;
      if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name)) {
        methodName = member.name.text;
      } else {
        throw new Error(`Unsupported method name syntax in ${apiName}`);
      }

      const required = requiredParamCount(member);
      const previous = methods.get(methodName);
      if (previous === undefined || required < previous) {
        methods.set(methodName, required);
      }
    }

    const methodNames = Array.from(methods.keys()).sort();
    for (const methodName of methodNames) {
      entries.push({
        op: `${domain}.${methodName}`,
        requiredParams: methods.get(methodName),
      });
    }
  }

  entries.sort((a, b) => a.op.localeCompare(b.op));
  return entries;
}

function renderCanonicalMethodsTs(metadata) {
  const ops = metadata.map((entry) => entry.op);
  return `// AUTO-GENERATED by scripts/generate-canonical-cases.mjs. Do not edit manually.\n\nexport const canonicalRawMethods = ${JSON.stringify(ops, null, 2)} as const;\n\nexport type CanonicalRawMethod = (typeof canonicalRawMethods)[number];\n`;
}

function toParityCase(entry) {
  const override = CASE_OVERRIDES[entry.op];
  if (override) {
    return {
      caseId: `${entry.op}.autogen.${override.expectation}-override`,
      description: `${override.description} (override for ${entry.op}).`,
      workflow: override.workflow ?? [{ op: entry.op, args: override.args }],
      expectation: { kind: override.expectation },
    };
  }

  if (entry.requiredParams === 0) {
    return {
      caseId: `${entry.op}.autogen.success-no-args`,
      description: `Auto-generated baseline success call for ${entry.op} with no args (requiredParams=0).`,
      workflow: [{ op: entry.op, args: [] }],
      expectation: { kind: "success" },
    };
  }

  return {
    caseId: `${entry.op}.autogen.error-no-args`,
    description: `Auto-generated baseline invalid-args call for ${entry.op} with no args (requiredParams=${entry.requiredParams}).`,
    workflow: [{ op: entry.op, args: [] }],
    expectation: { kind: "error" },
  };
}

function writeOutputs(metadata) {
  const generatedDir = path.join(pyParityRoot, "src", "generated");
  const casesDir = path.join(pyParityRoot, "src", "cases");
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(casesDir, { recursive: true });

  const methodsTsPath = path.join(generatedDir, "canonical-raw-methods.ts");
  const casesJsonPath = path.join(casesDir, "canonical-auto.cases.json");

  fs.writeFileSync(methodsTsPath, renderCanonicalMethodsTs(metadata));

  const cases = metadata.map(toParityCase);
  fs.writeFileSync(casesJsonPath, `${JSON.stringify(cases, null, 2)}\n`);

  console.log(`[py-parity] wrote ${metadata.length} canonical methods -> ${path.relative(repoRoot, methodsTsPath)}`);
  console.log(`[py-parity] wrote ${cases.length} auto cases -> ${path.relative(repoRoot, casesJsonPath)}`);
}

const metadata = computeCanonicalRawMethodMetadata();
writeOutputs(metadata);
