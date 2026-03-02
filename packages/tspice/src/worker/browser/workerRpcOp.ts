export type WorkerRpcNamespace = "raw" | "kit";

export type WorkerRpcAllowlist = Partial<Record<WorkerRpcNamespace, ReadonlySet<string>>>;

type WorkerRpcSurface = Record<string, unknown>;

export type WorkerRpcInvocation = {
  namespace: WorkerRpcNamespace;
  method: string;
  target: WorkerRpcSurface;
  fn: (...args: unknown[]) => unknown;
};

const quote = (value: string): string => JSON.stringify(value);

const formatWorkerRpcContext = (context: {
  op: string;
  namespace?: string;
  method?: string;
}): string => {
  const parts = [`op=${quote(context.op)}`];
  if (context.namespace !== undefined) parts.push(`namespace=${quote(context.namespace)}`);
  if (context.method !== undefined) parts.push(`method=${quote(context.method)}`);
  return `(${parts.join(", ")})`;
};

const createCallerFacingWorkerRpcError = (opts: {
  summary: string;
  op: string;
  namespace?: string;
  method?: string;
  expected: string;
  got: string;
  hint?: string;
}): Error => {
  const messageParts = [
    `${opts.summary} ${formatWorkerRpcContext(opts)}.`,
    `Expected: ${opts.expected}.`,
    `Got: ${opts.got}.`,
  ];
  if (opts.hint) {
    messageParts.push(`Hint: ${opts.hint}.`);
  }
  return new Error(messageParts.join(" "));
};

/**
 * Resolve a worker RPC operation to an invocation target.
 *
 * Throws caller-facing, actionable errors for invalid namespace/method input.
 */
export function resolveWorkerRpcInvocation(opts: {
  op: string;
  allowlist: WorkerRpcAllowlist;
  surfaces: Record<WorkerRpcNamespace, WorkerRpcSurface>;
  isSafeRpcKey: (key: string) => boolean;
  blockedStringKeys: ReadonlySet<string>;
}): WorkerRpcInvocation {
  const { op } = opts;

  const dot = op.indexOf(".");
  if (dot <= 0 || dot === op.length - 1) {
    throw createCallerFacingWorkerRpcError({
      summary: "Invalid worker RPC operation",
      op,
      expected: '"<namespace>.<method>" where <namespace> is "raw" or "kit"',
      got: quote(op),
      hint: 'Call a namespaced operation like "kit.toolkitVersion" or "raw.furnsh"',
    });
  }

  const namespace = op.slice(0, dot);
  const method = op.slice(dot + 1);

  if (namespace !== "raw" && namespace !== "kit") {
    throw createCallerFacingWorkerRpcError({
      summary: "Unknown worker RPC namespace",
      op,
      namespace,
      method,
      expected: '"raw" or "kit"',
      got: quote(namespace),
      hint: 'Use "raw.<method>" or "kit.<method>"',
    });
  }

  if (!opts.isSafeRpcKey(method) || opts.blockedStringKeys.has(method)) {
    throw createCallerFacingWorkerRpcError({
      summary: "Invalid worker RPC method name",
      op,
      namespace,
      method,
      expected: "a safe JavaScript identifier that is not blocked",
      got: quote(method),
      hint: 'Use a method listed by "meta.surfaceMethodKeys"',
    });
  }

  const ns = namespace satisfies WorkerRpcNamespace;

  const nsAllowlist = opts.allowlist[ns];
  if (nsAllowlist && !nsAllowlist.has(method)) {
    throw createCallerFacingWorkerRpcError({
      summary: "Disallowed worker RPC operation",
      op,
      namespace: ns,
      method,
      expected: `an allowlisted "${ns}" method`,
      got: quote(method),
      hint: 'Call "meta.surfaceMethodKeys" to discover allowed operations for this worker entrypoint',
    });
  }

  const target = opts.surfaces[ns];
  const fn = target[method];
  if (typeof fn !== "function") {
    throw createCallerFacingWorkerRpcError({
      summary: "Unknown worker RPC operation",
      op,
      namespace: ns,
      method,
      expected: `an existing "${ns}" method`,
      got: quote(method),
      hint: 'Call "meta.surfaceMethodKeys" to discover available operations',
    });
  }

  return {
    namespace: ns,
    method,
    target,
    fn: fn as (...args: unknown[]) => unknown,
  };
}
