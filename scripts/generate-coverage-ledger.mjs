#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import YAML from "yaml";
import { applyAudits } from "./coverage-ledger/audits.mjs";
import {
  compareText,
  filesUnder,
  source,
  walk,
  unwrap,
  evidence,
  contractMethods,
  registeredCases,
  tsRoutes,
  cTokens,
  cArguments,
  nativeExports,
  shimIndex,
  backendComposition,
} from "./coverage-ledger/source-analysis.mjs";

const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
const outputFiles = ["data/coverage-ledger.json", "docs/coverage-ledger.md"];
const sorted = (items) => [...new Set(items)].sort();
const readJson = (root, file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

function canonicalInventory(root) {
  const inventory = readJson(root, "data/cspice-functions.json");
  if (!Array.isArray(inventory))
    throw new Error("Canonical inventory must be an array");
  const names = new Set();
  for (const [index, routine] of inventory.entries()) {
    if (
      !routine ||
      typeof routine !== "object" ||
      typeof routine.name !== "string" ||
      !/^[a-z][a-z0-9_]*$/.test(routine.name) ||
      typeof routine.purpose !== "string" ||
      !routine.purpose.trim() ||
      !["planned", "excluded"].includes(routine.decision) ||
      (routine.justification != null &&
        typeof routine.justification !== "string")
    )
      throw new Error(`Invalid canonical inventory entry at index ${index}`);
    const normalized = routine.name.replace(/_c$/, "");
    if (names.has(normalized))
      throw new Error(`Duplicate canonical routine name: ${routine.name}`);
    names.add(normalized);
  }
  return inventory;
}

function staticStringArray(root, file, name) {
  let result;
  walk(source(path.join(root, file)), (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === name &&
      node.initializer
    ) {
      const value = unwrap(node.initializer);
      if (
        !ts.isArrayLiteralExpression(value) ||
        !value.elements.every(ts.isStringLiteral)
      )
        throw new Error(`Expected literal ${name} array in ${file}`);
      result = value.elements.map((s) => s.text);
    }
  });
  if (!result) throw new Error(`Missing ${name} in ${file}`);
  return result;
}

function ciLanes(root) {
  const file = ".github/workflows/ci.yml";
  const workflow = YAML.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const packageJson = readJson(root, "package.json");
  const parityPackageFile = "packages/py-parity-checking/package.json";
  const parityPackage = readJson(root, parityPackageFile);
  // Accept only the currently understood unfiltered suite command. Any new
  // command form needs a deliberate parser update before it counts as evidence.
  if (parityPackage.scripts?.test !== "vitest run")
    throw new Error("Parity package must invoke the full Vitest suite");
  const turbo = readJson(root, "turbo.json");
  const testEnv = [
    ...(turbo.globalEnv ?? []),
    ...(turbo.tasks?.test?.env ?? []),
    ...(turbo.globalPassThroughEnv ?? []),
    ...(turbo.tasks?.test?.passThroughEnv ?? []),
  ];
  const lanes = [];
  for (const [job, config] of Object.entries(workflow.jobs ?? {})) {
    const command = config.with?.command;
    if (typeof command !== "string") continue;
    const commands = command
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !line.startsWith("#"));
    const native = commands.some((line) =>
      /^pnpm\s+run\s+check:native:required(?:\s|$)/.test(line),
    );
    const js = commands.some((line) =>
      /^pnpm\s+run\s+check:js:required(?:\s|$)/.test(line),
    );
    if (!native && !js) continue;
    const script = native ? "check:native:required" : "check:js:required";
    const testScript = native ? "test:required" : "test:js:required";
    if (
      !packageJson.scripts[script]
        ?.split("&&")
        .some((part) => part.trim() === `pnpm run ${testScript}`)
    )
      throw new Error(`CI ${job} no longer invokes the expected test task`);
    const turboTestCommand = packageJson.scripts[testScript];
    const tokens = turboTestCommand?.trim().split(/\s+/) ?? [];
    if (
      tokens.slice(0, 3).join(" ") !== "turbo run test" ||
      tokens
        .slice(3)
        .some((token) => token !== "--filter=!@rybosome/tspice-backend-node")
    )
      throw new Error(
        `CI ${job} has an unproven Turbo parity test scope: ${turboTestCommand}`,
      );
    lanes.push({
      job,
      workflow: file,
      script,
      testScript,
      turboTestCommand,
      parityPackage: {
        file: parityPackageFile,
        name: parityPackage.name,
        testCommand: parityPackage.scripts.test,
      },
      backends: native ? ["node", "wasm"] : ["wasm"],
      matrix: config.strategy?.matrix ?? {},
      nativeExpectationConfigured:
        native &&
        commands.some((line) =>
          /^(?:export\s+)?TSPICE_EXPECT_NATIVE=(?:true|"true"|'true')$/.test(
            line,
          ),
        ),
      nativeExpectationForwardedByTurbo:
        native && testEnv.includes("TSPICE_EXPECT_NATIVE"),
      executionEvidence:
        "configuration-only; inspect CI logs for an actual run",
    });
  }
  if (
    !lanes.some((l) => l.backends.includes("node")) ||
    !lanes.some((l) => l.backends.includes("wasm"))
  )
    throw new Error("Missing configured Node or WASM parity CI lane");
  return lanes.sort((a, b) => compareText(a.job, b.job));
}

function scenarioPaths(scenario, tracked) {
  const refs = [];
  function visit(value) {
    if (typeof value === "string" && value.startsWith("kernels/")) {
      refs.push({
        path: value,
        kind: value.startsWith("kernels/generated/")
          ? "generated-output"
          : tracked.has(`packages/py-parity-checking/fixtures/${value}`)
            ? "checked-in-fixture"
            : "missing-or-negative-test-reference",
      });
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (
        (value.kind === "fixture" || value.kind === "scratch") &&
        typeof value.rel === "string"
      ) {
        refs.push({
          path: value.rel,
          kind:
            value.kind === "scratch"
              ? "scratch"
              : tracked.has(`packages/py-parity-checking/fixtures/${value.rel}`)
                ? "checked-in-fixture"
                : "missing-or-negative-test-reference",
        });
      } else Object.values(value).forEach(visit);
    }
  }
  visit(scenario.workflow);
  return [
    ...new Map(refs.map((r) => [`${r.kind}:${r.path}`, r])).values(),
  ].sort((a, b) => compareText(a.path, b.path));
}

export function buildLedger(root = defaultRoot, options = {}) {
  const errors = [];
  const inventory = canonicalInventory(root);
  const policy = readJson(root, "data/coverage-ledger-policy.json");
  if (policy.schemaVersion !== 1)
    throw new Error("Unknown coverage-ledger policy schema");
  const methods = contractMethods(root);
  const byName = new Map(methods.map((m) => [m.name, m]));
  const routines = new Map(
    inventory.map((r) => [r.name.replace(/_c$/, ""), r]),
  );
  for (const method of methods)
    if (!routines.has(method.name))
      errors.push(
        `Raw contract method has no canonical inventory entry: ${method.name}`,
      );
  const scenarios = registeredCases(root);
  const dispatchFile = "packages/py-parity-checking/src/run-tspice/dispatch.ts";
  const dispatched = new Map();
  walk(source(path.join(root, dispatchFile)), (node) => {
    if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression))
      dispatched.set(node.expression.text, evidence(root, node));
  });
  const operationRoutes = new Map();
  function operationRoute(op) {
    if (operationRoutes.has(op)) return operationRoutes.get(op);
    if (
      typeof op !== "string" ||
      op.split(".").length !== 2 ||
      !dispatched.has(op)
    )
      return null;
    const [domain, name] = op.split(".");
    const contract = byName.get(name);
    if (!contract) return null;
    let aliasEvidence = null;
    if (domain !== contract.domain) {
      const file = path.join(
        root,
        `packages/py-parity-checking/src/run-tspice/domains/${domain}.ts`,
      );
      if (!fs.existsSync(file)) return null;
      walk(source(file), (node) => {
        if (
          !ts.isCaseClause(node) ||
          !ts.isStringLiteral(node.expression) ||
          node.expression.text !== op
        )
          return;
        walk(node, (child) => {
          if (
            ts.isCallExpression(child) &&
            ts.isPropertyAccessExpression(child.expression) &&
            child.expression.name.text === name &&
            child.expression.expression.getText() === "context.spice.raw"
          )
            aliasEvidence = evidence(root, child);
        });
      });
      if (!aliasEvidence) return null;
    }
    const route = {
      operation: op,
      contractMethod: name,
      contractDomain: contract.domain,
      dispatch: dispatched.get(op),
      namespaceMapping: aliasEvidence
        ? "dispatcher-alias-with-direct-raw-call"
        : "canonical-domain",
      aliasEvidence,
    };
    operationRoutes.set(op, route);
    return route;
  }
  const caseIds = new Set();
  const caseFiles = new Set();
  const casesByMethod = new Map();
  const tracked = new Set(
    options.trackedFiles ??
      execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
        .split("\0")
        .filter(Boolean),
  );
  for (const scenario of scenarios) {
    if (typeof scenario.caseId !== "string" || caseIds.has(scenario.caseId))
      errors.push(`Missing or duplicate caseId: ${scenario.caseId}`);
    caseIds.add(scenario.caseId);
    caseFiles.add(scenario.source);
    const name = path.basename(scenario.source, ".cases.json");
    if (!byName.has(name))
      errors.push(
        `Registered case file has no raw contract method: ${scenario.source}`,
      );
    if (!Array.isArray(scenario.workflow) || scenario.workflow.length === 0)
      errors.push(`Empty workflow: ${scenario.caseId}`);
    for (const step of scenario.workflow ?? [])
      if (typeof step.op !== "string" || !operationRoute(step.op))
        errors.push(
          `Scenario operation has no raw contract method: ${scenario.caseId} -> ${step.op}`,
        );
    if (
      !scenario.workflow?.some(
        (step) => operationRoute(step.op)?.contractMethod === name,
      )
    )
      errors.push(
        `Scenario never references its routine: ${scenario.caseId} -> ${name}`,
      );
    if (!["success", "error"].includes(scenario.expectation?.kind))
      errors.push(`Invalid expectation: ${scenario.caseId}`);
    const record = {
      caseId: scenario.caseId,
      source: scenario.source,
      expectation: scenario.expectation?.kind,
      operations: sorted(scenario.workflow?.map((step) => step.op) ?? []),
      paths: scenarioPaths(scenario, tracked),
      assertionQuality: "unaudited",
    };
    casesByMethod.set(name, [...(casesByMethod.get(name) ?? []), record]);
  }
  for (const file of filesUnder(
    path.join(root, "packages/py-parity-checking/src/cases"),
    ".cases.json",
  )) {
    const relative = path.relative(root, file);
    if (!caseFiles.has(relative))
      errors.push(`Unregistered case file: ${relative}`);
  }
  const nodeRoutes = tsRoutes(root, "node", methods, policy.routes);
  const wasmRoutes = tsRoutes(root, "wasm", methods, policy.routes);
  const native = nativeExports(root);
  const shim = shimIndex(root);
  const nativeBuild = readJson(
    root,
    "packages/backend-node/native/binding.gyp",
  ).targets.find((target) => target.target_name === "tspice_backend_node");
  if (!nativeBuild) throw new Error("Missing production node-gyp target");
  const nativeSources = new Set(
    nativeBuild.sources.map((file) =>
      path.normalize(path.join("packages/backend-node/native", file)),
    ),
  );
  const nativeEntryTokens = cTokens(
    fs.readFileSync(
      path.join(root, "packages/backend-node/native/src/addon.cc"),
      "utf8",
    ),
  );
  const registrations = new Set();
  for (let i = 0; i < nativeEntryTokens.length; i++)
    if (
      nativeEntryTokens[i].value === "registerDomain" &&
      nativeEntryTokens[i + 1]?.kind === "punctuation" &&
      nativeEntryTokens[i + 1]?.value === "("
    ) {
      const args = cArguments(nativeEntryTokens, i + 1);
      const registration = args[0]
        ?.filter((t) => t.kind === "id")
        .at(-1)?.value;
      if (registration?.startsWith("Register")) registrations.add(registration);
    }
  const compositions = {
    node: [backendComposition(root, "packages/backend-node/src/index.ts")],
    wasm: [
      backendComposition(
        root,
        "packages/backend-wasm/src/runtime/create-backend.node.ts",
      ),
      backendComposition(
        root,
        "packages/backend-wasm/src/runtime/create-backend.web.ts",
      ),
    ],
  };
  const wasmSources = new Set();
  walk(source(path.join(root, "scripts/build-backend-wasm.mjs")), (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      node.name.getText() !== "shimSources" ||
      !node.initializer ||
      !ts.isArrayLiteralExpression(node.initializer)
    )
      return;
    for (const item of node.initializer.elements) {
      if (
        !ts.isCallExpression(item) ||
        item.expression.getText() !== "path.join" ||
        item.arguments[0]?.getText() !== "repoRoot" ||
        !item.arguments.slice(1).every(ts.isStringLiteral)
      )
        throw new Error("Unsupported WASM shimSources entry");
      wasmSources.add(
        path.join(...item.arguments.slice(1).map((arg) => arg.text)),
      );
    }
  });
  const exportedWasm = new Set(
    staticStringArray(
      root,
      "scripts/build-backend-wasm.mjs",
      "exportedFunctions",
    ).map((n) => n.replace(/^_/, "")),
  );
  const binary = new WebAssembly.Module(
    fs.readFileSync(
      path.join(
        root,
        "packages/backend-wasm/emscripten/tspice_backend_wasm.wasm",
      ),
    ),
  );
  const binaryExports = new Set(
    WebAssembly.Module.exports(binary).map((e) => e.name),
  );
  const wasmTypes = new Set();
  walk(
    source(path.join(root, "packages/backend-wasm/src/lowlevel/exports.ts")),
    (node) => {
      if (
        ts.isMethodSignature(node) &&
        node.name.getText().startsWith("_tspice_")
      )
        wasmTypes.add(node.name.getText().slice(1));
    },
  );
  const lanes = ciLanes(root);

  function shimEvidence(symbols) {
    return sorted(symbols).map((symbol) => {
      const definition = shim.definitions.get(symbol);
      const declaration = shim.declarations.get(symbol);
      if (!definition || !declaration)
        errors.push(`Missing shared shim declaration/definition: ${symbol}`);
      return {
        symbol,
        declaration: declaration ?? null,
        definition: definition?.evidence ?? null,
      };
    });
  }

  function cspiceCalls(symbols) {
    const seen = new Set();
    const result = new Set();
    function visit(symbol, fromFile) {
      const key = `${fromFile}:${symbol}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (symbol.endsWith("_c")) {
        result.add(symbol);
        return;
      }
      const definition = shim.resolve(symbol, fromFile);
      for (const call of definition?.calls ?? [])
        visit(call, definition.evidence.file);
    }
    symbols.forEach((symbol) => visit(symbol));
    return [...result].sort();
  }

  const entries = inventory
    .map((routine) => {
      const name = routine.name.replace(/_c$/, "");
      const contract = byName.get(name);
      const base = {
        routine: routine.name,
        purpose: routine.purpose,
        inventoryDecision: routine.decision,
        inventoryJustification: routine.justification ?? null,
        implementation: contract
          ? "contract-present"
          : routine.decision === "excluded"
            ? "excluded"
            : "planned",
      };
      if (!contract) return base;
      if (routine.decision === "excluded")
        errors.push(`Excluded routine appears in raw contract: ${name}`);
      const cases = casesByMethod.get(name) ?? [];
      if (!cases.length)
        errors.push(`Raw contract method has no registered cases: ${name}`);
      const node = nodeRoutes.get(name);
      const wasm = wasmRoutes.get(name);
      if (!node) errors.push(`Missing Node route: ${name}`);
      if (!wasm) errors.push(`Missing WASM route: ${name}`);
      const nativeMethods = (node?.calls ?? []).map((call) => {
        const target = native.get(call);
        if (!target)
          errors.push(`Unresolved Node native export ${name} -> ${call}`);
        if (target && !registrations.has(target.registration))
          errors.push(
            `Native registration is not wired into addon: ${name} -> ${target.registration}`,
          );
        if (target && !nativeSources.has(target.evidence.file))
          errors.push(
            `Native adapter source not compiled: ${name} -> ${target.evidence.file}`,
          );
        return { name: call, ...target };
      });
      const nodeShim = sorted(
        nativeMethods
          .flatMap((m) => m.calls ?? [])
          .filter((n) => n.startsWith("tspice_")),
      );
      const wasmShim = wasm?.calls ?? [];
      const exception = policy.exceptions[name]?.wasm;
      for (const [backend, route] of [
        ["node", node],
        ["wasm", wasm],
      ])
        for (const composition of compositions[backend]) {
          if (!composition.factories.has(route?.factory))
            errors.push(
              `Factory not wired into ${backend} raw backend: ${route?.factory}`,
            );
          if (route?.policy?.binding) {
            const binding = composition.variables.get(route.policy.binding);
            if (
              !binding ||
              !ts.isCallExpression(binding) ||
              binding.expression.getText() !== route.policy.bindingFactory
            )
              errors.push(`Stale delegated binding for ${backend}.${name}`);
          }
          if (route?.policy?.classification === "cached-shim-result") {
            const binding = composition.variables.get("toolkitVersion");
            const api = composition.variables.get("timeApi");
            if (
              !binding ||
              !ts.isCallExpression(binding) ||
              binding.expression.getText() !== "getToolkitVersion" ||
              !api ||
              !ts.isCallExpression(api) ||
              api.expression.getText() !== "createTimeApi" ||
              api.arguments[1]?.getText() !== "toolkitVersion"
            )
              errors.push(
                `Cached toolkit-version binding drift in ${composition.sf.fileName}`,
              );
          }
        }
      if (!node?.calls.length || !nodeShim.length)
        errors.push(`No traced Node native/shared-shim route for ${name}`);
      let wasmStatus = "source-and-binary-route-present";
      let harness = null;
      let unsupportedThrow = null;
      if (exception) {
        unsupportedThrow =
          wasm?.throws.find(
            (statement) =>
              statement.message === exception.message &&
              statement.errorType === exception.errorType,
          ) ?? null;
        if (
          exception.status !== "unsupported" ||
          !unsupportedThrow ||
          wasmShim.length !== 0
        )
          errors.push(`Stale WASM exception for ${name}`);
        const file = source(path.join(root, exception.harnessFile));
        const fallback = file.statements.find(
          (n) =>
            ts.isFunctionDeclaration(n) &&
            n.name?.text === exception.harnessFunction,
        );
        if (!fallback?.body)
          errors.push(`Missing documented harness fallback for ${name}`);
        const dispatcher = file.statements.find(
          (n) =>
            ts.isFunctionDeclaration(n) &&
            n.name?.text === exception.harnessDispatcher,
        );
        let hasWasmFallback = false;
        let hasOperationDispatch = false;
        if (dispatcher?.body)
          walk(dispatcher.body, (node) => {
            if (
              !ts.isIfStatement(node) ||
              !ts.isBinaryExpression(node.expression) ||
              node.expression.operatorToken.kind !==
                ts.SyntaxKind.EqualsEqualsEqualsToken ||
              !ts.isStringLiteral(node.expression.right) ||
              node.expression.right.text !== "wasm"
            )
              return;
            walk(node.thenStatement, (child) => {
              if (
                ts.isCallExpression(child) &&
                child.expression.getText() === exception.harnessFunction
              )
                hasWasmFallback = true;
            });
          });
        walk(file, (node) => {
          if (
            !ts.isCaseClause(node) ||
            !ts.isStringLiteral(node.expression) ||
            node.expression.text !== exception.operation
          )
            return;
          walk(node, (child) => {
            if (
              ts.isCallExpression(child) &&
              child.expression.getText() === exception.harnessDispatcher
            )
              hasOperationDispatch = true;
          });
        });
        if (!hasWasmFallback || !hasOperationDispatch)
          errors.push(`Stale harness fallback dispatch for ${name}`);
        harness = {
          classification: "harness-fallback-not-raw-parity",
          reason: exception.reason,
          evidence: fallback ? evidence(root, fallback) : null,
          dispatcher: dispatcher ? evidence(root, dispatcher) : null,
        };
        wasmStatus = "unsupported";
      } else if (
        !wasmShim.length &&
        wasm?.policy?.classification !== "javascript-implementation"
      )
        errors.push(
          `No traced WASM shared-shim route for ${name}; explain it in policy rather than silently counting support`,
        );
      if (wasm?.policy?.classification === "javascript-implementation")
        wasmStatus = "javascript-implementation";
      for (const symbol of wasmShim) {
        if (!wasmTypes.has(symbol))
          errors.push(`WASM route missing typed export: ${name} -> ${symbol}`);
        if (!exportedWasm.has(symbol))
          errors.push(
            `WASM route missing configured export: ${name} -> ${symbol}`,
          );
        if (!binaryExports.has(symbol))
          errors.push(
            `WASM route missing checked-in binary export: ${name} -> ${symbol}`,
          );
      }
      for (const symbol of nodeShim)
        if (
          shim.definitions.has(symbol) &&
          !nativeSources.has(shim.definitions.get(symbol).evidence.file)
        )
          errors.push(
            `Node shared shim source not compiled: ${name} -> ${symbol}`,
          );
      for (const symbol of wasmShim)
        if (
          shim.definitions.has(symbol) &&
          !wasmSources.has(shim.definitions.get(symbol).evidence.file)
        )
          errors.push(
            `WASM shared shim source not compiled: ${name} -> ${symbol}`,
          );
      const targets = cspiceCalls(sorted([...nodeShim, ...wasmShim]));
      function mappingFor(backend, symbols, status) {
        const targets = cspiceCalls(symbols);
        const note = policy.mappingNotes?.[name]?.[backend];
        const sameNamed = targets.includes(routine.name);
        if (!sameNamed && status !== "unsupported" && !note)
          errors.push(`Unexplained non-direct ${backend} mapping for ${name}`);
        if (
          note &&
          (sameNamed ||
            !note.reason ||
            !note.expectedEntrypoints.every((entrypoint) =>
              targets.includes(entrypoint),
            ))
        )
          errors.push(`Stale non-direct mapping policy for ${backend}.${name}`);
        return {
          classification:
            status === "unsupported"
              ? "unsupported"
              : status === "javascript-implementation"
                ? status
                : sameNamed
                  ? "same-named-cspice-entrypoint"
                  : "alias-or-composed",
          reason: note?.reason ?? null,
          cspiceEntrypoints: targets,
        };
      }
      const nodeMapping = mappingFor("node", nodeShim, "source-route-present");
      const wasmMapping = mappingFor("wasm", wasmShim, wasmStatus);
      return {
        ...base,
        contract,
        mapping: {
          classification:
            nodeMapping.classification === wasmMapping.classification
              ? nodeMapping.classification
              : "backend-dependent",
          cspiceEntrypoints: targets,
          node: nodeMapping,
          wasm: wasmMapping,
          semanticEquivalence:
            "unaudited; static call graph does not establish 1:1 wrapper semantics",
        },
        shim: shimEvidence([...nodeShim, ...wasmShim]),
        backends: {
          node: {
            status: "source-route-present",
            evidence: node?.evidence,
            factory: node?.factory,
            delegation: node?.delegatedEvidence,
            routePolicy: node?.policy,
            nativeExports: nativeMethods,
            shimSymbols: nodeShim,
            cspiceEntrypoints: cspiceCalls(nodeShim),
            ciJobs: lanes
              .filter((l) => l.backends.includes("node"))
              .map((l) => l.job),
            oracleParity:
              "registered-scenarios; execution must be established by CI logs",
          },
          wasm: {
            status: wasmStatus,
            unsupportedThrow,
            evidence: wasm?.evidence,
            factory: wasm?.factory,
            delegation: wasm?.delegatedEvidence,
            routePolicy: wasm?.policy,
            shimSymbols: wasmShim,
            cspiceEntrypoints: cspiceCalls(wasmShim),
            ciJobs: lanes
              .filter((l) => l.backends.includes("wasm"))
              .map((l) => l.job),
            oracleParity:
              harness ??
              "registered-scenarios; execution must be established by CI logs",
          },
        },
        parity: {
          scenarios: cases.sort((a, b) => compareText(a.caseId, b.caseId)),
          meaningfulCoverage: "unaudited",
        },
      };
    })
    .sort((a, b) => compareText(a.routine, b.routine));
  for (const section of [policy.exceptions, policy.routes, policy.mappingNotes])
    for (const name of Object.keys(section ?? {}))
      if (!byName.has(name)) errors.push(`Orphan policy entry: ${name}`);
  if (errors.length)
    throw new Error(
      `Coverage ledger drift:\n${sorted(errors)
        .map((e) => `- ${e}`)
        .join("\n")}`,
    );
  const audit = applyAudits(root, entries);
  return {
    audit,
    schemaVersion: 1,
    generator: "scripts/generate-coverage-ledger.mjs",
    limitations: [
      "Static evidence proves source registration and binary export presence, not numerical correctness or runtime execution.",
      "Semantic review and observed verification are maintained in per-batch audit inputs; unreviewed routines remain explicitly unreviewed.",
      "Inventory decisions are retained verbatim; contract presence is derived separately.",
      "Known fallback/unsupported behavior is maintained in data/coverage-ledger-policy.json.",
    ],
    summary: {
      total: entries.length,
      eligible: entries.filter((e) => e.inventoryDecision !== "excluded")
        .length,
      implemented: entries.filter((e) => e.contract).length,
      planned: entries.filter((e) => e.implementation === "planned").length,
      excluded: entries.filter((e) => e.inventoryDecision === "excluded")
        .length,
      caseFiles: caseFiles.size,
      scenarios: scenarios.length,
      wasmRawUnsupported: entries.filter(
        (e) => e.backends?.wasm.status === "unsupported",
      ).length,
    },
    ciLanes: lanes,
    operationRoutes: [...operationRoutes.values()].sort((a, b) =>
      compareText(a.operation, b.operation),
    ),
    routines: entries,
  };
}

export function renderSummary(ledger) {
  const { summary } = ledger;
  const implemented = ledger.routines.filter((r) => r.contract);
  const link = (e) => `[${e.file}:${e.line}](../${e.file}#L${e.line})`;
  const mappingRows = implemented
    .flatMap((routine) =>
      ["node", "wasm"].flatMap((backend) => {
        const reason =
          routine.mapping[backend].reason ??
          (routine.backends[backend].routePolicy?.classification ===
          "cached-shim-result"
            ? routine.backends[backend].routePolicy.reason
            : null);
        return reason
          ? [`| \`${routine.routine}\` | ${backend} | ${reason} |`]
          : [];
      }),
    )
    .join("\n");
  const ciRows = ledger.ciLanes
    .map(
      (lane) =>
        `| \`${lane.job}\` | ${lane.backends.join(", ")} | ${JSON.stringify(lane.matrix)} | ${lane.nativeExpectationConfigured} | ${lane.nativeExpectationForwardedByTurbo} |`,
    )
    .join("\n");
  return `# CSPICE routine and parity ledger\n\nGenerated by \`pnpm generate:coverage-ledger\`. Check drift with \`pnpm check:coverage-ledger\`. Do not edit this report or [the JSON ledger](../data/coverage-ledger.json) by hand.\n\n## Measures\n\n| Measure | Count | Meaning |\n| --- | ---: | --- |\n| Canonical routines | ${summary.total} | Inventory entries; ${summary.excluded} explicitly excluded |\n| Eligible routines | ${summary.eligible} | Current expansion denominator |\n| Contract-present routines | ${summary.implemented} | ${summary.planned} remain planned; presence is not semantic completion |\n| Registered scenario files | ${summary.caseFiles} | Reached through the static allCases import/spread graph |\n| Registered scenarios | ${summary.scenarios} | Scenario presence is not meaningful parity coverage |\n| Unsupported raw WASM methods | ${summary.wasmRawUnsupported} | Explicitly recorded exception |\n\nThe canonical inventory currently labels most eligible entries \`planned\`, including routines already present in the contract. The JSON preserves \`inventoryDecision\` and derives \`implementation\` separately. Source line/branch coverage is a different measure.\n\n## Raw backend gaps\n\n${summary.wasmRawUnsupported ? "See the explicit unsupported raw methods in the JSON and coverage-ledger-policy.json; harness substitutes do not establish raw parity." : "No raw WASM methods are currently recorded as unsupported. kplfrm uses its actual shared-shim export on both backends; its former harness substitute has been removed. This structural status does not itself certify semantic audit completion."}\n\n## Intentional non-direct behavior\n\n| Routine | Backend | Evidence-backed reason |\n| --- | --- | --- |\n${mappingRows}\n\n## Configured CI lanes\n\n| Job | Backends | Matrix | Native flag configured | Forwarded by Turbo |\n| --- | --- | --- | --- | --- |\n${ciRows}\n\nThese fields describe configuration, not a recorded successful execution. The generator verifies the root check-to-test script chain, accepts only understood Turbo test scopes that include the parity package, and requires its unfiltered \`vitest run\` command. Unknown command forms fail closed.\n\n## Evidence and limits\n\nTypeScript's compiler API resolves the composed raw contract, parses returned backend API objects, and follows local helper calls. A balanced-token C/C++ index traces native registrations and shared shim definitions while excluding comments and literal contents from call detection. WASM routes must have typed exports, build-configured exports, and exports in the checked-in binary. The registry evaluator accepts static imports, identifiers, type assertions, arrays, and spreads and rejects unsupported syntax. Qualified workflow operations must exist in the dispatcher; cross-domain aliases additionally require a direct raw-method call in the matching domain handler. The JSON records these aliases with source evidence.\n\nThese are static evidence checks, not a semantic audit or an observation of a successful CI run. \`same-named-cspice-entrypoint\` means the traced shim graph contains that entrypoint; wrapper normalization, validation, state, and composed behavior still require review. Referenced paths distinguish checked-in fixtures, generated outputs, scratch paths, and missing/negative-test references. Path requiredness is unaudited.\n\nConfigured CI lanes come from [.github/workflows/ci.yml](../.github/workflows/ci.yml). The actual backend execution, native-required guard, tolerances, error normalization, and assertion depth need separate verification in CI logs and the planned case audit. Browser integration is not established by WASM tests running in Node.\n\n## Maintained semantic audit\n\nThe Step 7 baseline is ${ledger.audit.baselineRoutines} contract-present routines at \`${ledger.audit.baselineCommit}\`. ${ledger.audit.expansionRoutines} newly contract-present routines are assigned to Step 8 batches under the same acceptance rules. Human reviews in [data/parity-audits](../data/parity-audits) are separate from static registration and configured CI. \`verified\` requires meaningful success coverage, edge/error assessments, repaired findings, and explicit source-bound local and observed CI execution on that backend.\n\n| Backend | Unreviewed | Reviewed; verification pending | Needs repair | Verified |\n| --- | ---: | ---: | ---: | ---: |\n${[
    "node",
    "wasm",
  ]
    .map((b) => {
      const c = ledger.audit.counts[b];
      return `| ${b} | ${c.unreviewed} | ${c.reviewed} | ${c["needs-repair"]} | ${c.verified} |`;
    })
    .join(
      "\n",
    )}\n\n| Batch | Routines | Node / WASM verified | PRs / dependencies | Next action |\n| --- | --- | --- | --- | --- |\n${ledger.audit.batches.map((b) => `| ${b.id} | ${b.routines.map((n) => `\`${n}\``).join(", ")} | ${["node", "wasm"].map((backend) => b.routines.filter((n) => implemented.find((r) => r.routine === n).audit[backend].status === "verified").length).join(" / ")} | ${[...b.prs, ...b.dependsOn].join(", ") || "None"} | ${b.nextAction} |`).join("\n")}\n\nThe JSON includes each contract-present routine's assigned batch and per-backend review/repair/verification status, maintained evidence path, and verification references. Recorded CI jobs describe observed executions, not merely configured lanes.\n\n## Implemented surface\n\n| Routine | Contract | Node route | WASM route | Scenarios | Entry-point mapping |\n| --- | --- | --- | --- | ---: | --- |\n${implemented.map((r) => `| \`${r.routine}\` | ${link(r.contract.evidence)} | ${link(r.backends.node.evidence)} | ${r.backends.wasm.status === "unsupported" ? "**unsupported; harness fallback**" : link(r.backends.wasm.evidence)} | ${r.parity.scenarios.length} | ${r.mapping.classification} |`).join("\n")}\n\nThe JSON includes all planned/excluded routines, native export handlers, shim symbols/declarations/definitions, scenario IDs/expectations/operations, referenced paths, and CI lane configuration. It is the input for assigning bounded follow-up audits and expansion batches.\n`;
}

export function generate(root = defaultRoot, check = false, options = {}) {
  const ledger = buildLedger(root, options);
  const outputs = [
    `${JSON.stringify(ledger, null, 2)}\n`,
    renderSummary(ledger),
  ];
  for (let i = 0; i < outputFiles.length; i++) {
    const file = path.join(root, outputFiles[i]);
    if (check) {
      if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== outputs[i])
        throw new Error(
          `Stale coverage ledger: ${outputFiles[i]}; run pnpm generate:coverage-ledger`,
        );
    } else fs.writeFileSync(file, outputs[i]);
  }
  return ledger.summary;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check"))
    throw new Error(
      "Usage: node scripts/generate-coverage-ledger.mjs [--check]",
    );
  console.log(
    JSON.stringify(generate(defaultRoot, args.includes("--check")), null, 2),
  );
}
