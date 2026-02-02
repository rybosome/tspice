import * as THREE from 'three'

import { resolveVitePublicUrl } from './resolveVitePublicUrl.js'

const loader = new THREE.TextureLoader()

// Cache the *base* loaded texture by resolved URL.
// Callers always receive a `clone()` so they can safely `dispose()`.
const baseTextureByUrl = new Map<string, Promise<THREE.Texture>>()

async function loadBaseTexture(resolvedUrl: string): Promise<THREE.Texture> {
  const existing = baseTextureByUrl.get(resolvedUrl)
  if (existing) return existing

  const promise = loader
    .loadAsync(resolvedUrl)
    .then((tex) => {
      // Default assumption: most authored textures are sRGB.
      // Callers can override (e.g. `NoColorSpace` for masks) on the returned clone.
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      return tex
    })
    .catch((err) => {
      // Allow retries if a transient load fails.
      baseTextureByUrl.delete(resolvedUrl)
      throw err
    })

  baseTextureByUrl.set(resolvedUrl, promise)
  return promise
}

/**
 * Load a texture with a shared cache, returning a fresh `Texture` instance per call.
 *
 * Why clone?
 * - Three.js doesn't refcount textures, so sharing a single `Texture` object makes
 *   it unsafe for one mesh to dispose without breaking other users.
 */
export async function loadTextureCached(url: string): Promise<THREE.Texture> {
  const resolvedUrl = resolveVitePublicUrl(url)
  const base = await loadBaseTexture(resolvedUrl)

  const clone = base.clone()
  clone.needsUpdate = true
  return clone
}
