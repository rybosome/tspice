import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

type WorkflowKind = "callContract" | "workflow";

type MethodSurfaceEntry = {
  manifestId: string;
  canonicalMethod: string;
  contractMethod: string;
  workflowKind: WorkflowKind;
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

function collectMethodSurface(methodsDir: string): MethodSurfaceEntry[] {
  const files = discoverYamlFiles(methodsDir);
  const entries: MethodSurfaceEntry[] = [];

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

    entries.push({
      manifestId: asString(manifest.id, `${filePath}.manifest.id`),
      canonicalMethod: asString(contract.canonicalMethod, `${filePath}.contract.canonicalMethod`),
      contractMethod: asString(contract.contractMethod, `${filePath}.contract.contractMethod`),
      workflowKind: inferWorkflowKind(doc),
    });
  }

  return entries.sort(
    (a, b) =>
      stableCompare(a.canonicalMethod, b.canonicalMethod) ||
      stableCompare(a.manifestId, b.manifestId),
  );
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const methodsDir = path.resolve(packageRoot, "specs/methods");
const registryPath = path.resolve(packageRoot, "registry/method-surface.yml");

const entries = collectMethodSurface(methodsDir);
const payload = {
  schemaVersion: 1,
  description: "Canonical parity method surface registry (v3).",
  methods: entries,
};

fs.mkdirSync(path.dirname(registryPath), { recursive: true });
fs.writeFileSync(registryPath, stringifyYaml(payload, { lineWidth: 0 }), "utf8");

console.log(`[parity-checking] synced method-surface registry (${entries.length} methods)`);
console.log(`- ${registryPath}`);
