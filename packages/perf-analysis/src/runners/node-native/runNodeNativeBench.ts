import crypto from "node:crypto";
import * as path from "node:path";
import { open, readFile, mkdir, rename, rm, stat } from "node:fs/promises";

import { createBackend, type KernelSource, type SpiceBackend } from "@rybosome/tspice";

import {
  normalizeFixtureRefs,
  parseYaml,
  validate,
  type NormalizedBenchmarkContractV1,
} from "../../contracts/benchmark-contract/v1/index.js";
import {
  resolveFixtureRef,
  type ResolvedFixtureRef,
} from "../../shared/fixtures/index.js";

import { assertNodeNativeBenchCall, dispatchCall, type NodeNativeBenchCall } from "./dispatch.js";
import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForNativeNoKernels,
} from "./metaKernel.js";
import { toNodeNativeBmfMeasures } from "./bmf.js";
import { quantileSorted } from "./stats.js";

export type NodeNativeBenchBackend = "node-native";

export type BencherMetricFormat = Record<
  string,
  Record<
    string,
    {
      value: number;
      lower_value?: number;
      upper_value?: number;
    }
  >
>;

export type NodeNativeBenchRawOutput = {
  backend: NodeNativeBenchBackend;
  suite: string;
  startedAt: string;
  outDir: string;
  spiceVersion: string;
  contract: NormalizedBenchmarkContractV1;
  defaults: {
    warmupIterations: number;
    iterations: number;
  };
  cases: Array<{
    id: string;
    name?: string;
    benchmarkKey: string;
    kernel?: ResolvedFixtureRef;
    call: string;
    args: unknown[];
    warmupIterations: number;
    iterations: number;
    opsPerIteration: number;
    samplesNsPerOp: number[];
    latency_p50: number;
    latency_p95: number;
    throughput: number;
  }>;
};

export type NodeNativeBenchResult = {
  outDir: string;
  rawPath: string;
  bmfPath: string;
  raw: NodeNativeBenchRawOutput;
  bmf: BencherMetricFormat;
};

export type RunNodeNativeBenchOptions = {
  /** Stable suite id used in output filenames and benchmark keys. */
  suiteId: string;
  suitePath: string;
  outDir: string;
  warmupIterations?: number;
  iterations?: number;
};

async function writeFileTextAtomic(outPath: string, text: string): Promise<void> {
  // Write to a tmp file in the same directory, then rename.
  // This avoids leaving partially-written JSON behind on crash.
  const dir = path.dirname(outPath);
  await mkdir(dir, { recursive: true });

  const tmpPath = path.join(
    dir,
    `.${path.basename(outPath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  let fh: Awaited<ReturnType<typeof open>> | undefined;
  try {
    fh = await open(tmpPath, "wx");
    await fh.writeFile(text, { encoding: "utf8" });
    await fh.sync();
    await fh.close();
    fh = undefined;

    try {
      // Atomic on POSIX when staying on the same filesystem.
      await rename(tmpPath, outPath);
      return;
    } catch (err: any) {
      // On Windows, rename() can't replace an existing file.
      if (err?.code === "EEXIST" || err?.code === "EPERM") {
        await rm(outPath, { force: true });
        await rename(tmpPath, outPath);
        return;
      }
      throw err;
    }
  } finally {
    try {
      await fh?.close();
    } catch {
      // ignore
    }
    await rm(tmpPath, { force: true });
  }
}

type CaseConfig = {
  call: NodeNativeBenchCall;
  args: unknown[];
  warmupIterations?: number;
  iterations?: number;
  opsPerIteration?: number;
};

function isMissingNativeAddon(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (/tspice_backend_node\.node/.test(msg)) return true;
  if (/Cannot find module/.test(msg) && /tspice-native-/.test(msg)) return true;
  if (
    /tspice-backend-node/.test(msg) &&
    (/Cannot find module/.test(msg) || /ERR_MODULE_NOT_FOUND/.test(msg) || /Failed to resolve entry/.test(msg))
  ) {
    return true;
  }
  return false;
}

async function createNodeNativeBackendOrThrow(): Promise<SpiceBackend> {
  try {
    return await createBackend({ backend: "node" });
  } catch (error) {
    if (isMissingNativeAddon(error)) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(
        "node-native benchmark backend is unavailable (native addon not built/staged).\n" +
          "Remediation:\n" +
          "- Build the native addon: pnpm -C packages/backend-node run build:native\n" +
          "- (Optional) stage the platform package: pnpm -w run stage:native-platform\n" +
          "Note: on linux-arm64, CSPICE must be provided via TSPICE_CSPICE_DIR.\n" +
          `Caused by: ${cause}`,
      );
    }
    throw error;
  }
}

function tryConfigureErrorPolicy(backend: SpiceBackend): void {
  // Not part of the backend contract, but may exist on some implementations.
  const b = backend as unknown as {
    erract?: (op: string, action: string) => void;
    errprt?: (op: string, list: string) => void;
  };

  try {
    b.erract?.("SET", "RETURN");
  } catch {
    // ignore
  }

  try {
    b.errprt?.("SET", "NONE");
  } catch {
    // ignore
  }
}

function isolate(backend: SpiceBackend): void {
  backend.kclear();
  backend.reset();
  tryConfigureErrorPolicy(backend);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInteger(value: unknown, label: string, options: { min?: number } = {}): number {
  const min = options.min ?? 0;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer (got ${JSON.stringify(value)})`);
  }
  if (value < min) {
    throw new RangeError(`${label} must be >= ${min} (got ${value})`);
  }
  return value;
}

function parseCaseConfig(config: Record<string, unknown> | undefined, label: string): CaseConfig {
  if (!config) {
    throw new Error(`${label}.config is required for node-native benchmarks`);
  }

  const call = config.call;
  if (typeof call !== "string") {
    throw new TypeError(`${label}.config.call must be a string (got ${JSON.stringify(call)})`);
  }
  const callParsed = assertNodeNativeBenchCall(call, `${label}.config.call`);

  const argsRaw = config.args;
  const args = argsRaw === undefined ? [] : argsRaw;
  if (!Array.isArray(args)) {
    throw new TypeError(`${label}.config.args must be an array (got ${JSON.stringify(argsRaw)})`);
  }

  const warmupIterations =
    config.warmupIterations === undefined
      ? config.warmup === undefined
        ? undefined
        : parseInteger(config.warmup, `${label}.config.warmup`, { min: 0 })
      : parseInteger(config.warmupIterations, `${label}.config.warmupIterations`, { min: 0 });

  const iterations =
    config.iterations === undefined
      ? undefined
      : parseInteger(config.iterations, `${label}.config.iterations`, { min: 1 });

  const opsPerIteration =
    config.opsPerIteration === undefined
      ? config.ops === undefined
        ? undefined
        : parseInteger(config.ops, `${label}.config.ops`, { min: 1 })
      : parseInteger(config.opsPerIteration, `${label}.config.opsPerIteration`, { min: 1 });

  return {
    call: callParsed,
    args,
    ...(warmupIterations === undefined ? {} : { warmupIterations }),
    ...(iterations === undefined ? {} : { iterations }),
    ...(opsPerIteration === undefined ? {} : { opsPerIteration }),
  };
}

async function readFileChecked(filePath: string, encoding: "utf8"): Promise<string>;
async function readFileChecked(filePath: string, encoding?: undefined): Promise<Buffer>;
async function readFileChecked(filePath: string, encoding?: "utf8"): Promise<string | Buffer> {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return await readFile(filePath, encoding === undefined ? undefined : encoding);
}

async function expandKernelSources(
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): Promise<KernelSource[]> {
  const absPath = path.resolve(osPath);
  const ext = path.extname(absPath).toLowerCase();

  if (ext === ".tm") {
    const loadedKey = `bytes:${absPath}`;
    if (loaded.has(loadedKey)) return [];
    loaded.add(loadedKey);

    const metaKernelText = await readFileChecked(absPath, "utf8");

    const kernelsToLoad = resolveMetaKernelKernelsToLoad(
      metaKernelText,
      absPath,
      restrictToDir ? { restrictToDir } : {},
    );

    const sanitized = sanitizeMetaKernelTextForNativeNoKernels(metaKernelText);

    const out: KernelSource[] = [
      {
        path: absPath,
        bytes: Buffer.from(sanitized, "utf8"),
      },
    ];

    for (const k of kernelsToLoad) {
      out.push(...(await expandKernelSources(k, loaded, restrictToDir)));
    }
    return out;
  }

  // Regular kernel file path.
  const loadedKey = `ospath:${absPath}`;
  if (loaded.has(loadedKey)) return [];
  loaded.add(loadedKey);

  // Fail fast on missing kernel files.
  try {
    await stat(absPath);
  } catch {
    throw new Error(`Missing required kernel file: ${absPath}`);
  }

  return [absPath];
}

async function buildKernelPlan(kernel: ResolvedFixtureRef): Promise<KernelSource[]> {
  const loaded = new Set<string>();
  return await expandKernelSources(kernel.path, loaded, kernel.restrictToDir);
}

function furnshAll(backend: SpiceBackend, kernels: readonly KernelSource[]): void {
  for (const k of kernels) {
    backend.furnsh(k);
  }
}

export async function runNodeNativeBench(options: RunNodeNativeBenchOptions): Promise<NodeNativeBenchResult> {
  const suiteId = options.suiteId;
  const suitePath = path.resolve(options.suitePath);
  const suiteDir = path.dirname(suitePath);
  const outDir = path.resolve(options.outDir);

  const defaultWarmupIterations = options.warmupIterations ?? 10;
  const defaultIterations = options.iterations ?? 50;

  const suiteYamlText = await readFileChecked(suitePath, "utf8");
  const parsed = parseYaml(suiteYamlText);
  const validated = validate(parsed);
  const contract = normalizeFixtureRefs(validated);

  if (contract.runner !== undefined && contract.runner !== "node-native") {
    throw new Error(
      `Suite runner ${JSON.stringify(contract.runner)} does not match selected backend "node-native". ` +
        `Either update the suite YAML runner field, or run with the matching --backend.`,
    );
  }

  const fixtureRoots = contract.fixtureRoots ?? [];

  const backend = await createNodeNativeBackendOrThrow();

  const spiceVersion = backend.spiceVersion();

  const cases: NodeNativeBenchRawOutput["cases"] = [];
  const bmf: BencherMetricFormat = {};

  for (let i = 0; i < contract.benchmarks.length; i++) {
    const benchCase = contract.benchmarks[i]!;
    const label = `benchmarks[${i}](${benchCase.id})`;

    const configRaw = benchCase.config;
    if (configRaw !== undefined && !isRecord(configRaw)) {
      throw new TypeError(`${label}.config must be a mapping/object (got ${JSON.stringify(configRaw)})`);
    }

    const config = parseCaseConfig(configRaw, label);

    const warmupIterations = config.warmupIterations ?? defaultWarmupIterations;
    const iterations = config.iterations ?? defaultIterations;
    const opsPerIteration = config.opsPerIteration ?? 1;

    if (iterations < 1) {
      throw new Error(`${label}: iterations must be >= 1 (got ${iterations})`);
    }
    if (opsPerIteration < 1) {
      throw new Error(`${label}: opsPerIteration must be >= 1 (got ${opsPerIteration})`);
    }

    const resolvedKernel =
      benchCase.kernel === undefined
        ? undefined
        : resolveFixtureRef(benchCase.kernel, fixtureRoots, { baseDir: suiteDir });

    const kernelPlan = resolvedKernel === undefined ? [] : await buildKernelPlan(resolvedKernel);

    // Preflight: ensure kernel loading works outside the measured section.
    if (kernelPlan.length > 0) {
      isolate(backend);
      furnshAll(backend, kernelPlan);
      isolate(backend);
    }

    // Warmup.
    //
    // Semantics:
    // - Warmup runs outside the measured timer.
    // - Isolation is per-iteration (not per-op): each iteration starts from a
    //   clean SPICE pool and freshly-loaded kernels.
    // - Warmup exists to reduce cold-start variance (JIT, OS caches, etc.).
    for (let w = 0; w < warmupIterations; w++) {
      isolate(backend);
      furnshAll(backend, kernelPlan);
      for (let op = 0; op < opsPerIteration; op++) {
        dispatchCall(backend, config.call, config.args);
      }
    }

    // Measured.
    //
    // Timing boundaries:
    // - We start the timer after isolation + kernel loading.
    // - We stop the timer immediately after the benchmark call loop.
    //
    // This means the reported latency/throughput values exclude:
    // - kernel loading (furnsh)
    // - per-iteration isolation/reset overhead
    //
    // If opsPerIteration > 1, each sample is the average ns/op over the loop.
    const samplesNsPerOp: number[] = [];
    for (let m = 0; m < iterations; m++) {
      isolate(backend);
      furnshAll(backend, kernelPlan);

      const start = process.hrtime.bigint();
      for (let op = 0; op < opsPerIteration; op++) {
        dispatchCall(backend, config.call, config.args);
      }
      const end = process.hrtime.bigint();

      const durationNsBigInt = end - start;
      if (durationNsBigInt < 0n) {
        throw new Error(`${label}: measured duration was negative (start=${start} end=${end})`);
      }

      // Convert to number only when it's safe to represent precisely.
      // (Benchmarks should be short; if this trips, something is very wrong.)
      if (durationNsBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(
          `${label}: measured duration exceeded Number.MAX_SAFE_INTEGER nanoseconds (${durationNsBigInt}). ` +
            `Refusing to convert BigInt -> number due to potential precision loss.`,
        );
      }

      const durationNs = Number(durationNsBigInt);
      samplesNsPerOp.push(durationNs / opsPerIteration);
    }

    const sorted = [...samplesNsPerOp].sort((a, b) => a - b);
    const latency_p50 = quantileSorted(sorted, 0.5);
    const latency_p95 = quantileSorted(sorted, 0.95);

    const meanNsPerOp = samplesNsPerOp.reduce((acc, v) => acc + v, 0) / samplesNsPerOp.length;
    const throughput = meanNsPerOp > 0 ? 1e9 / meanNsPerOp : 0;

    const benchmarkKey = `node-native/${suiteId}/${benchCase.id}`;

    cases.push({
      id: benchCase.id,
      ...(benchCase.name === undefined ? {} : { name: benchCase.name }),
      benchmarkKey,
      ...(resolvedKernel === undefined ? {} : { kernel: resolvedKernel }),
      call: config.call,
      args: config.args,
      warmupIterations,
      iterations,
      opsPerIteration,
      samplesNsPerOp,
      latency_p50,
      latency_p95,
      throughput,
    });

    // Bencher Metric Format (BMF) does not have a unit field.
    //
    // Semantics/units (implied):
    // - latency_p50 / latency_p95: ns/op (quantiles of the per-iteration ns/op samples)
    // - throughput: ops/sec (derived from mean(ns/op))
    //
    // We emit p50/p95 as separate measures (instead of overloading upper_value)
    // so they're first-class metrics for thresholding.
    bmf[benchmarkKey] = toNodeNativeBmfMeasures({
      latency_p50,
      latency_p95,
      throughput,
    });
  }

  const raw: NodeNativeBenchRawOutput = {
    backend: "node-native",
    suite: suiteId,
    startedAt: new Date().toISOString(),
    outDir,
    spiceVersion,
    contract,
    defaults: {
      warmupIterations: defaultWarmupIterations,
      iterations: defaultIterations,
    },
    cases,
  };

  const rawPath = path.join(outDir, "raw.json");
  const bmfPath = path.join(outDir, "bmf.json");

  await mkdir(outDir, { recursive: true });
  await writeFileTextAtomic(rawPath, JSON.stringify(raw, null, 2) + "\n");
  await writeFileTextAtomic(bmfPath, JSON.stringify(bmf, null, 2) + "\n");

  return { outDir, rawPath, bmfPath, raw, bmf };
}
