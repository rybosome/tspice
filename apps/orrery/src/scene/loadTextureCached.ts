import * as THREE from 'three'

import { resolveVitePublicUrl } from './resolveVitePublicUrl.js'

// E2E/dev-only diagnostic counter for async texture loading.
//
// Playwright screenshot tests can be significantly slower in CI (e.g. SwiftShader
// software rendering). This counter helps tests wait until all initial textures
// have finished loading before capturing golden screenshots.
function shouldTrackPendingTextureLoads() {
  if (typeof window === 'undefined') return false

  // `import.meta.env.DEV` is true for the dev server, but false for production
  // builds (even with custom modes). Our e2e screenshot tests run using a
  // dedicated Vite mode (`--mode e2e`).
  return import.meta.env.DEV || import.meta.env.MODE === 'e2e'
}

function ensurePendingTextureLoadsInitialized() {
  if (!shouldTrackPendingTextureLoads()) return
  window.__tspice_viewer__pending_texture_loads ??= 0
}

function incrementPendingTextureLoads() {
  if (!shouldTrackPendingTextureLoads()) return
  ensurePendingTextureLoadsInitialized()
  window.__tspice_viewer__pending_texture_loads = (window.__tspice_viewer__pending_texture_loads ?? 0) + 1
}

function decrementPendingTextureLoads() {
  if (!shouldTrackPendingTextureLoads()) return
  ensurePendingTextureLoadsInitialized()
  window.__tspice_viewer__pending_texture_loads = Math.max(0, (window.__tspice_viewer__pending_texture_loads ?? 0) - 1)
}

export type LoadTextureCachedOptions = {
  /**
   * Explicitly set the texture color space.
   *
   * Prefer passing this at call sites for readability and to avoid hidden
   * defaults (e.g. future non-sRGB maps).
   */
  colorSpace: THREE.ColorSpace
}

export type CachedTextureHandle = {
  texture: THREE.Texture
  release: () => void
}

export class TextureCacheClearedError extends Error {
  constructor() {
    super('Texture cache was cleared')
    this.name = 'TextureCacheClearedError'
  }
}

export function isTextureCacheClearedError(err: unknown): err is TextureCacheClearedError {
  return err instanceof TextureCacheClearedError
}

export class TextureCacheStaleError extends TextureCacheClearedError {
  constructor() {
    super()
    this.message = 'Texture cache entry was replaced'
    this.name = 'TextureCacheStaleError'
  }
}

/**
 * Monotonically increasing "epoch" for cache entries.
 *
 * When `clearTextureCache({ force: true })` is called, we bump this generation
 * so that any in-flight loads from the previous generation are treated as
 * invalid and fail with `TextureCacheClearedError`.
 */
let cacheGeneration = 0

const loader = new THREE.TextureLoader()

type TextureCacheEntry = {
  resolvedUrl: string
  colorSpace: THREE.ColorSpace
  generation: number
  refs: number
  texture?: THREE.Texture
  promise: Promise<THREE.Texture>
}

const entryByKey = new Map<string, TextureCacheEntry>()

function makeKey(args: { resolvedUrl: string; colorSpace: THREE.ColorSpace }): string {
  return `${args.resolvedUrl}|colorSpace:${args.colorSpace}`
}

function disposeEntry(key: string, entry: TextureCacheEntry) {
  // Avoid deleting/disposing a newer cache entry created after this one.
  if (entryByKey.get(key) !== entry) return

  entry.texture?.dispose()
  entryByKey.delete(key)
}

function decrementAndMaybeDisposeEntry(key: string, entry: TextureCacheEntry) {
  entry.refs = Math.max(0, entry.refs - 1)

  // If the entry was removed/replaced in the map, never mutate the map here.
  if (entry.refs === 0) {
    if (entry.texture) {
      disposeEntry(key, entry)
      return
    }

    // If the texture is still in-flight and nobody references it anymore,
    // remove it from the cache (but only if it's still the current entry).
    //
    // Note: we cannot cancel the underlying network / decode work. Instead, when
    // the load eventually resolves it will detect that it's no longer the active
    // entry for this key (`entryByKey.get(key) !== entry`), dispose the texture,
    // and fail with `TextureCacheStaleError`. This means stale in-flight entries
    // can temporarily exist until their promises settle.
    if (entryByKey.get(key) === entry) {
      entryByKey.delete(key)
    }
  }
}

/**
 * Dispose all cached textures and clear the cache.
 *
 * Call this from scene/runtime teardown to avoid leaked GPU resources.
 *
 * By default this is safe: it refuses to dispose textures that still have
 * outstanding references. Pass `{ force: true }` during teardown.
 */
export function clearTextureCache(options: { force?: boolean } = {}) {
  const force = options.force ?? false

  // Only invalidate in-flight loads when we are forcing a clear. If we bumped the
  // generation while callers still hold references, we'd make their loads fail
  // unnecessarily.
  if (force) cacheGeneration += 1

  // Snapshot first so we don't mutate `entryByKey` while iterating.
  const entries = Array.from(entryByKey.entries())
  for (const [key, entry] of entries) {
    if (!force && entry.refs > 0) {
      console.warn(`clearTextureCache(): refusing to dispose in-use texture (refs=${entry.refs})`, entry.resolvedUrl)
      continue
    }

    disposeEntry(key, entry)
  }
}

/**
 * Load a texture through a shared cache.
 *
 * Unlike a clone-based cache, this shares the actual `Texture` instance (and
 * therefore the GPU upload) across callers.
 *
 * Callers must call `release()` when the texture is no longer needed.
 */
export async function loadTextureCached(url: string, options: LoadTextureCachedOptions): Promise<CachedTextureHandle> {
  const resolvedUrl = resolveVitePublicUrl(url)
  const colorSpace = options.colorSpace
  const key = makeKey({ resolvedUrl, colorSpace })

  let entry = entryByKey.get(key)
  if (!entry) {
    const newEntry: TextureCacheEntry = {
      resolvedUrl,
      colorSpace,
      generation: cacheGeneration,
      refs: 0,
      promise: Promise.resolve(null as unknown as THREE.Texture),
    }

    incrementPendingTextureLoads()

    newEntry.promise = loader
      .loadAsync(resolvedUrl)
      .then((tex) => {
        // Apply explicit options at the cache boundary so they're consistent
        // across all consumers.
        tex.colorSpace = colorSpace

        tex.needsUpdate = true

        // If the cache was cleared while this texture was in-flight,
        // dispose it and fail the request so call sites don't reinstall
        // textures after teardown.
        if (newEntry.generation !== cacheGeneration) {
          tex.dispose()
          throw new TextureCacheClearedError()
        }

        // A newer entry for this key may have been installed while this request
        // was in-flight (e.g. via cache clear + reload). In that case, treat
        // this load as stale and avoid mutating/discarding the new entry.
        if (entryByKey.get(key) !== newEntry) {
          tex.dispose()
          throw new TextureCacheStaleError()
        }

        newEntry.texture = tex

        // If all consumers released while this was still loading, dispose
        // immediately and remove from cache.
        if (newEntry.refs <= 0) {
          disposeEntry(key, newEntry)
        }

        return tex
      })
      .catch((err) => {
        // Allow retries if a transient load fails.
        if (entryByKey.get(key) === newEntry) {
          entryByKey.delete(key)
        }
        throw err
      })
      .finally(() => {
        decrementPendingTextureLoads()
      })

    entryByKey.set(key, newEntry)
    entry = newEntry
  }

  entry.refs += 1
  let texture: THREE.Texture
  try {
    texture = await entry.promise
  } catch (err) {
    decrementAndMaybeDisposeEntry(key, entry)
    throw err
  }

  let released = false
  const release = () => {
    if (released) return
    released = true

    decrementAndMaybeDisposeEntry(key, entry)
  }

  return { texture, release }
}
