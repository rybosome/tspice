import { quantizeEt } from "../time/quantizeEt.js";
import { DEFAULT_QUANTUM_SEC } from "../time/timeStore.js";
import type {
  BodyState,
  EtSeconds,
  GetBodyStateInput,
  GetFrameTransformInput,
  Mat3,
  SpiceClient,
} from "./SpiceClient.js";

function getBodyStateKey(input: GetBodyStateInput): string {
  const abcorr = input.abcorr ?? "";
  return `${String(input.target)}|${String(input.observer)}|${input.frame}|${abcorr}`;
}

function getFrameTransformKey(input: GetFrameTransformInput): string {
  return `${input.from}|${input.to}`;
}

export interface CachedSpiceClientOptions {
  /**
   * Quantum for ET quantization (seconds).
   * Cache keys use quantized ET to improve hit rate.
   * Defaults to DEFAULT_QUANTUM_SEC (0.1s).
   */
  quantumSec?: number;
}

/**
 * Viewer-side caching wrapper around `SpiceClient`.
 *
 * Cache strategy:
 * - ET values are quantized to improve cache hit rate
 * - Single-entry cache keyed by quantized `et` (clears when quantized `et` changes)
 * - Within a quantized `et`, memoize body states, frame transforms, and UTC strings
 */
export function createCachedSpiceClient(
  client: SpiceClient,
  options: CachedSpiceClientOptions = {}
): SpiceClient {
  const quantumSec = options.quantumSec ?? DEFAULT_QUANTUM_SEC;

  let lastEtKey: string | undefined;
  let bodyStateCache = new Map<string, Promise<BodyState>>();
  let frameTransformCache = new Map<string, Promise<Mat3>>();
  let utcCache = new Map<number, Promise<string>>();

  const ensureEt = (et: number) => {
    const quantizedEt = quantizeEt(et, quantumSec);
    const nextKey = String(quantizedEt);
    if (nextKey === lastEtKey) return quantizedEt;
    lastEtKey = nextKey;
    bodyStateCache = new Map();
    frameTransformCache = new Map();
    utcCache = new Map();
    return quantizedEt;
  };

  return {
    getBodyState(input) {
      const quantizedEt = ensureEt(input.et);
      const key = getBodyStateKey(input);
      const cached = bodyStateCache.get(key);
      if (cached) return cached;
      // Use quantized ET for the actual query to ensure consistency
      const value = client.getBodyState({ ...input, et: quantizedEt });
      bodyStateCache.set(key, value);
      void value.catch(() => bodyStateCache.delete(key));
      return value;
    },

    getFrameTransform(input) {
      const quantizedEt = ensureEt(input.et);
      const key = getFrameTransformKey(input);
      const cached = frameTransformCache.get(key);
      if (cached) return cached;
      // Use quantized ET for the actual query to ensure consistency
      const value = client.getFrameTransform({ ...input, et: quantizedEt });
      frameTransformCache.set(key, value);
      void value.catch(() => frameTransformCache.delete(key));
      return value;
    },

    etToUtc(et: EtSeconds) {
      const quantizedEt = ensureEt(et);
      const cached = utcCache.get(quantizedEt);
      if (cached) return cached;
      const value = client.etToUtc(quantizedEt);
      utcCache.set(quantizedEt, value);
      void value.catch(() => utcCache.delete(quantizedEt));
      return value;
    },

    ...(client.listBodies ? { listBodies: () => client.listBodies!() } : {}),
    ...(client.getBodyMeta ? { getBodyMeta: (body) => client.getBodyMeta!(body) } : {}),
  };
}
