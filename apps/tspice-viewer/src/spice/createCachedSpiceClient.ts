import type {
  BodyState,
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

/**
* Viewer-side caching wrapper around `SpiceClient`.
*
* Cache strategy:
* - single-entry cache keyed by `et` (clears when `et` changes)
* - within an `et`, memoize body states and frame transforms
*/
export function createCachedSpiceClient(client: SpiceClient): SpiceClient {
  let lastEtKey: string | undefined;
  let bodyStateCache = new Map<string, BodyState>();
  let frameTransformCache = new Map<string, Mat3>();

  const ensureEt = (et: number) => {
    const nextKey = String(et);
    if (nextKey === lastEtKey) return;
    lastEtKey = nextKey;
    bodyStateCache = new Map();
    frameTransformCache = new Map();
  };

  return {
    getBodyState(input) {
      ensureEt(input.et);
      const key = getBodyStateKey(input);
      const cached = bodyStateCache.get(key);
      if (cached) return cached;
      const value = client.getBodyState(input);
      bodyStateCache.set(key, value);
      return value;
    },

    getFrameTransform(input) {
      ensureEt(input.et);
      const key = getFrameTransformKey(input);
      const cached = frameTransformCache.get(key);
      if (cached) return cached;
      const value = client.getFrameTransform(input);
      frameTransformCache.set(key, value);
      return value;
    },

    ...(client.listBodies ? { listBodies: () => client.listBodies!() } : {}),
    ...(client.getBodyMeta ? { getBodyMeta: (body) => client.getBodyMeta!(body) } : {}),
  };
}
