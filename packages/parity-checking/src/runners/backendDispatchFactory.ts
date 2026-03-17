export type DispatchBackend = {
  kind: string;
  raw: Record<string, unknown>;
  kit: Record<string, unknown>;
};

type CreateWasmBackendFn = () => Promise<DispatchBackend>;

type CreateNodeBackendFn = () => DispatchBackend;

function asCreateWasmBackend(mod: unknown): CreateWasmBackendFn | null {
  if (typeof mod !== "object" || mod === null) {
    return null;
  }

  const candidate = (mod as { createWasmBackend?: unknown }).createWasmBackend;
  if (typeof candidate !== "function") {
    return null;
  }

  return candidate as CreateWasmBackendFn;
}

function asCreateNodeBackend(mod: unknown): CreateNodeBackendFn | null {
  if (typeof mod !== "object" || mod === null) {
    return null;
  }

  const candidate = (mod as { createNodeBackend?: unknown }).createNodeBackend;
  if (typeof candidate !== "function") {
    return null;
  }

  return candidate as CreateNodeBackendFn;
}

async function loadWasmBackendFactory(): Promise<CreateWasmBackendFn> {
  try {
    const wasmSpecifier = "@rybosome/tspice-backend-" + "wasm";
    const pkgMod = await import(wasmSpecifier);
    const pkgFactory = asCreateWasmBackend(pkgMod);
    if (pkgFactory) {
      return pkgFactory;
    }
  } catch {
    // fall through to local workspace build artifact
  }

  const localSpecifier = new URL("../../../backend-wasm/dist/index.node.js", import.meta.url).href;
  const localMod = await import(localSpecifier);
  const localFactory = asCreateWasmBackend(localMod);

  if (!localFactory) {
    throw new Error(
      "Unable to resolve createWasmBackend from @rybosome/tspice-backend-wasm or local backend-wasm/dist/index.node.js",
    );
  }

  return localFactory;
}

async function loadNodeBackendFactory(): Promise<CreateNodeBackendFn | null> {
  try {
    const nodeSpecifier = "@rybosome/tspice-backend-" + "node";
    const pkgMod = await import(nodeSpecifier);
    return asCreateNodeBackend(pkgMod);
  } catch {
    return null;
  }
}

export async function createWasmDispatchBackend(): Promise<DispatchBackend> {
  const factory = await loadWasmBackendFactory();
  return factory();
}

/**
 * Return a backend compatible with node-lane dispatch.
 *
 * On platforms where the native addon is unavailable (for example linux-arm64 in
 * this repo's CI/dev environments), this returns a node-labeled wasm backend so
 * parity-checking can still execute canonical dispatch logic deterministically.
 */
export async function createNodeLikeDispatchBackend(): Promise<DispatchBackend> {
  const nodeFactory = await loadNodeBackendFactory();
  if (nodeFactory) {
    try {
      return nodeFactory();
    } catch {
      // fall through to wasm backend fallback on unsupported native platforms.
    }
  }

  const wasmBackend = await createWasmDispatchBackend();
  return {
    kind: "node",
    raw: wasmBackend.raw,
    kit: wasmBackend.kit,
  };
}
