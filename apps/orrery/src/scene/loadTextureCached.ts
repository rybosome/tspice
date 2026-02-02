import * as THREE from 'three'

import { resolveVitePublicUrl } from './resolveVitePublicUrl.js'

export type LoadTextureCachedOptions = {
  /**
   * Explicitly set the texture color space.
   *
   * Prefer passing this at call sites for readability and to avoid hidden
   * defaults (e.g. future non-sRGB maps).
   */
  colorSpace?: THREE.ColorSpace
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

let cacheGeneration = 0

const loader = new THREE.TextureLoader()

type TextureCacheEntry = {
  resolvedUrl: string
  colorSpace: THREE.ColorSpace | undefined
  generation: number
  refs: number
  texture?: THREE.Texture
  promise: Promise<THREE.Texture>
}

const entryByKey = new Map<string, TextureCacheEntry>()

function makeKey(args: { resolvedUrl: string; colorSpace: THREE.ColorSpace | undefined }): string {
  return `${args.resolvedUrl}|colorSpace:${args.colorSpace ?? 'unset'}`
}

function disposeEntry(key: string, entry: TextureCacheEntry) {
  entry.texture?.dispose()

  // Avoid deleting a newer cache entry created after this one.
  if (entryByKey.get(key) === entry) {
    entryByKey.delete(key)
  }
}

/**
 * Dispose all cached textures and clear the cache.
 *
 * Call this from scene/runtime teardown to avoid leaked GPU resources.
 */
export function clearTextureCache() {
  // Invalidate in-flight loads so late resolves don't re-install textures
  // after a clear/teardown.
  cacheGeneration += 1

  const entries = Array.from(entryByKey.entries())
  entryByKey.clear()

  for (const [key, entry] of entries) {
    // Dispose resolved textures immediately; in-flight loads will self-dispose
    // when they resolve (via generation checks in the promise chain).
    entry.texture?.dispose()
    void key
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
export async function loadTextureCached(
  url: string,
  options: LoadTextureCachedOptions = {},
): Promise<CachedTextureHandle> {
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

    newEntry.promise = loader
      .loadAsync(resolvedUrl)
      .then((tex) => {
        // Apply explicit options at the cache boundary so they're consistent
        // across all consumers.
        if (colorSpace !== undefined) tex.colorSpace = colorSpace

        tex.needsUpdate = true

        // If the cache was cleared while this texture was in-flight,
        // dispose it and fail the request so call sites don't reinstall
        // textures after teardown.
        if (newEntry.generation !== cacheGeneration) {
          tex.dispose()
          throw new TextureCacheClearedError()
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

    entryByKey.set(key, newEntry)
    entry = newEntry
  }

  entry.refs += 1
  let texture: THREE.Texture
  try {
    texture = await entry.promise
  } catch (err) {
    const current = entryByKey.get(key)
    if (current) current.refs = Math.max(0, current.refs - 1)
    throw err
  }

  let released = false
  const release = () => {
    if (released) return
    released = true

    const current = entryByKey.get(key)
    // If the cache was cleared, there's nothing to do.
    if (!current) return

    current.refs = Math.max(0, current.refs - 1)
    if (current.refs === 0 && current.texture) {
      disposeEntry(key, current)
    }
  }

  return { texture, release }
}
