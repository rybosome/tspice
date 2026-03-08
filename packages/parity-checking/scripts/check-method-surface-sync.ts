import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

type WorkflowKind = "callContract" | "workflow";

type MethodSurfaceEntry = {
  manifestId: string;
  canonicalMethod: string;
  contractMethod: string;
  workflowKind: WorkflowKind;
};

type MethodSpecProjection = MethodSurfaceEntry & {
  sourcePath: string;
};

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function discoverYamlFiles(dirPath: string): string[] {
  const out: string[] = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...discoverYamlFiles(entryPath));
      continue;
    }

    if (/\.ya?ml$/u.test(entry.name)) {
      out.push(entryPath);
    }
  }

  return out.sort(stableCompare);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value;
}

function inferWorkflowKind(doc: Record<string, unknown>): WorkflowKind {
  const workflowValue = doc.workflow;
  if (workflowValue && typeof workflowValue === "object" && !Array.isArray(workflowValue)) {
    const workflow = workflowValue as Record<string, unknown>;
    const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
    const cleanup = Array.isArray(workflow.cleanup) ? workflow.cleanup : [];

    if (
      steps.length === 1 &&
      typeof steps[0] === "object" &&
      steps[0] !== null &&
      (steps[0] as Record<string, unknown>).op === "callContract" &&
      cleanup.length === 0
    ) {
      return "callContract";
    }
  }

  if (Array.isArray(doc.suites) && doc.suites.length > 0) {
    const allSuitesCallContract = doc.suites.every((suite) => {
      if (typeof suite !== "object" || suite === null || Array.isArray(suite)) {
        return false;
      }

      const workflow = (suite as Record<string, unknown>).workflow;
      if (typeof workflow !== "object" || workflow === null || Array.isArray(workflow)) {
        return false;
      }

      const steps = Array.isArray((workflow as Record<string, unknown>).steps)
        ? ((workflow as Record<string, unknown>).steps as unknown[])
        : [];
      const cleanup = Array.isArray((workflow as Record<string, unknown>).cleanup)
        ? ((workflow as Record<string, unknown>).cleanup as unknown[])
        : [];

      if (steps.length !== 1 || cleanup.length !== 0) {
        return false;
      }

      const step = steps[0];
      return typeof step === "object" && step !== null && !Array.isArray(step) && (step as Record<string, unknown>).op === "callContract";
    });

    if (allSuitesCallContract) {
      return "callContract";
    }
  }

  return "workflow";
}

function loadMethodSpecs(methodsDir: string): MethodSpecProjection[] {
  const files = discoverYamlFiles(methodsDir);
  const out: MethodSpecProjection[] = [];

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parseYaml(raw);
    const doc = asRecord(parsed, filePath);

    if (doc.schemaVersion !== 3) {
      continue;
    }

    const manifest = asRecord(doc.manifest, `${filePath}.manifest`);
    if (manifest.kind !== "method") {
      continue;
    }

    const contract = asRecord(doc.contract, `${filePath}.contract`);

    out.push({
      sourcePath: path.relative(methodsDir, filePath),
      manifestId: asString(manifest.id, `${filePath}.manifest.id`),
      canonicalMethod: asString(contract.canonicalMethod, `${filePath}.contract.canonicalMethod`),
      contractMethod: asString(contract.contractMethod, `${filePath}.contract.contractMethod`),
      workflowKind: inferWorkflowKind(doc),
    });
  }

  return out.sort(
    (a, b) =>
      stableCompare(a.canonicalMethod, b.canonicalMethod) ||
      stableCompare(a.manifestId, b.manifestId) ||
      stableCompare(a.sourcePath, b.sourcePath),
  );
}

function loadRegistry(registryPath: string): MethodSurfaceEntry[] {
  const raw = fs.readFileSync(registryPath, "utf8");
  const parsed = parseYaml(raw);
  const obj = asRecord(parsed, "registry");

  if (obj.schemaVersion !== 1) {
    throw new TypeError(`registry.schemaVersion must be 1 (got ${JSON.stringify(obj.schemaVersion)})`);
  }

  if (!Array.isArray(obj.methods)) {
    throw new TypeError("registry.methods must be an array");
  }

  const methods = obj.methods.map((entry, index) => {
    const method = asRecord(entry, `registry.methods[${index}]`);
    const workflowKind = asString(method.workflowKind, `registry.methods[${index}].workflowKind`);

    if (workflowKind !== "callContract" && workflowKind !== "workflow") {
      throw new TypeError(`registry.methods[${index}].workflowKind must be callContract|workflow`);
    }

    return {
      manifestId: asString(method.manifestId, `registry.methods[${index}].manifestId`),
      canonicalMethod: asString(method.canonicalMethod, `registry.methods[${index}].canonicalMethod`),
      contractMethod: asString(method.contractMethod, `registry.methods[${index}].contractMethod`),
      workflowKind,
    } satisfies MethodSurfaceEntry;
  });

  return methods.sort(
    (a, b) =>
      stableCompare(a.canonicalMethod, b.canonicalMethod) || stableCompare(a.manifestId, b.manifestId),
  );
}

function toComparableRows(entries: MethodSurfaceEntry[]): string[] {
  return entries.map(
    (entry) =>
      `${entry.canonicalMethod}\t${entry.contractMethod}\t${entry.manifestId}\t${entry.workflowKind}`,
  );
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const registryPath = path.resolve(packageRoot, "registry/method-surface.yml");
const methodsDir = path.resolve(packageRoot, "specs/methods");

const registryEntries = loadRegistry(registryPath);
const specEntries = loadMethodSpecs(methodsDir);

const registryRows = toComparableRows(registryEntries);
const specRows = toComparableRows(specEntries);

if (registryRows.length !== specRows.length) {
  throw new Error(
    `method-surface registry count mismatch: registry=${registryRows.length} specs=${specRows.length}`,
  );
}

const missingFromRegistry = specRows.filter((row) => !registryRows.includes(row));
const staleInRegistry = registryRows.filter((row) => !specRows.includes(row));

if (missingFromRegistry.length > 0 || staleInRegistry.length > 0) {
  const lines = [
    "method-surface registry is out of sync with specs/methods.",
    "Run: pnpm -C packages/parity-checking run sync:method-surface && pnpm -C packages/parity-checking run generate:method-surface-artifacts",
  ];

  if (missingFromRegistry.length > 0) {
    lines.push("Missing from registry (present in specs):");
    lines.push(...missingFromRegistry.slice(0, 20).map((entry) => `  - ${entry}`));
    if (missingFromRegistry.length > 20) {
      lines.push(`  - ... (${missingFromRegistry.length - 20} more)`);
    }
  }

  if (staleInRegistry.length > 0) {
    lines.push("Stale in registry (missing from specs):");
    lines.push(...staleInRegistry.slice(0, 20).map((entry) => `  - ${entry}`));
    if (staleInRegistry.length > 20) {
      lines.push(`  - ... (${staleInRegistry.length - 20} more)`);
    }
  }

  throw new Error(lines.join("\n"));
}

console.log(`[parity-checking] method-surface registry is in sync (${registryRows.length} methods)`);
