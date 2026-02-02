import * as THREE from 'three'

import { resolveVitePublicUrl } from './resolveVitePublicUrl.js'

export type LoadTextureCachedOptions = {
  colorSpace?: THREE.ColorSpace
  wrapS?: THREE.Wrapping
  wrapT?: THREE.Wrapping
}

const textureLoader = new THREE.TextureLoader()

// Cache by URL + config to avoid conflicting wrap/colorSpace requirements.
const textureCache = new Map<string, Promise<THREE.Texture | undefined>>()

function makeTextureCacheKey(url: string, opts: LoadTextureCachedOptions): string {
  const cs = opts.colorSpace ?? ''
  const wrapS = opts.wrapS ?? ''
  const wrapT = opts.wrapT ?? ''
  return `${url}|cs:${cs}|ws:${wrapS}|wt:${wrapT}`
}

export function loadTextureCached(
  url: string,
  opts: LoadTextureCachedOptions = {}
): Promise<THREE.Texture | undefined> {
  const key = makeTextureCacheKey(url, opts)
  const existing = textureCache.get(key)
  if (existing) return existing

  const p = textureLoader
    .loadAsync(resolveVitePublicUrl(url))
    .then((tex) => {
      tex.colorSpace = opts.colorSpace ?? tex.colorSpace
      tex.wrapS = opts.wrapS ?? tex.wrapS
      tex.wrapT = opts.wrapT ?? tex.wrapT
      tex.needsUpdate = true
      return tex
    })
    .catch((err) => {
      // Keep rendering if a texture fails; surface failures for debugging.
      console.warn('Failed to load texture', url, err)
      textureCache.delete(key)
      return undefined
    })

  textureCache.set(key, p)
  return p
}
