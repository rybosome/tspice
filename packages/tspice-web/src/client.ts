import * as Comlink from "comlink";
import type { KernelSource } from "@rybosome/tspice";

import type { TspiceWorkerApi } from "./shared.js";

export interface WorkerLike {
  postMessage(message: any, transfer?: any[]): void;
  terminate(): void;
  addEventListener(type: "message", listener: (ev: any) => void, options?: any): void;
  removeEventListener(type: "message", listener: (ev: any) => void, options?: any): void;
}

export function wrapTspiceWorker(worker: WorkerLike): {
  api: Comlink.Remote<TspiceWorkerApi>;
  dispose(): void;
} {
  const api = Comlink.wrap<TspiceWorkerApi>(worker as any);

  return {
    api,
    dispose() {
      // Release Comlink proxy first, then terminate the underlying worker.
      // (releaseProxy is a symbol so we have to index it)
      (api as any)[Comlink.releaseProxy]?.();
      worker.terminate();
    },
  };
}

/**
 * Helper to transfer kernel bytes (avoid cloning large Uint8Arrays).
 *
 * Note: this detaches `kernel.bytes.buffer` (caller should not reuse it).
 */
export function transferKernel(kernel: KernelSource): KernelSource {
  if (typeof kernel === "string") return kernel;
  return Comlink.transfer(kernel, [kernel.bytes.buffer]);
}
