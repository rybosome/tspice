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

const loader = new THREE.TextureLoader()

type TextureCacheEntry = {
  resolvedUrl: string
  colorSpace: THREE.ColorSpace | undefined
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
  entryByKey.delete(key)
}

/**
 * Dispose all cached textures and clear the cache.
 *
 * Call this from scene/runtime teardown to avoid leaked GPU resources.
 */
export function clearTextureCache() {
  const entries = Array.from(entryByKey.entries())
  entryByKey.clear()

  for (const [key, entry] of entries) {
    // If the texture hasn't resolved yet, dispose it once it does.
    if (!entry.texture) {
      entry.promise
        .then((tex) => tex.dispose())
        .catch(() => {
          // ignore
        })
      continue
    }

    // Resolved texture.
    entry.texture.dispose()
    // `key` unused now, but keep it to make future debugging easier.
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
        entryByKey.delete(key)
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
