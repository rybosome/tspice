import * as THREE from 'three'

import { resolveVitePublicUrl } from './resolveVitePublicUrl.js'

export type CreateRingMeshOptions = {
  /** Inner radius in parent-local units (e.g. multiples of planet radius when parent is unit sphere). */
  innerRadius: number
  /** Outer radius in parent-local units (e.g. multiples of planet radius when parent is unit sphere). */
  outerRadius: number
  /** Number of radial segments (default tuned for demo quality). */
  segments?: number

  /**
   * Optional texture URL/path.
   *
   * If relative, it's resolved against Vite's `BASE_URL`.
   */
  textureUrl?: string

  /** Material tint color (useful for grayscale ring textures). */
  color?: THREE.ColorRepresentation
}

export function createRingMesh(options: CreateRingMeshOptions): {
  mesh: THREE.Mesh
  dispose: () => void
  ready: Promise<void>
} {
  const geometry = new THREE.RingGeometry(options.innerRadius, options.outerRadius, options.segments ?? 192)

  let disposed = false

  let map: THREE.Texture | undefined
  const ready: Promise<void> = options.textureUrl
    ? new THREE.TextureLoader()
        .loadAsync(resolveVitePublicUrl(options.textureUrl))
        .then((tex) => {
          if (disposed) {
            tex.dispose()
            return
          }

          tex.colorSpace = THREE.SRGBColorSpace
          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.ClampToEdgeWrapping
          tex.needsUpdate = true
          map = tex
        })
        .catch((err) => {
          console.warn('Failed to load ring texture', options.textureUrl, err)
        })
    : Promise.resolve()

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? '#ffffff'),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0,
    map,
  })

  const mesh = new THREE.Mesh(geometry, material)

  return {
    mesh,
    dispose: () => {
      disposed = true
      geometry.dispose()
      material.dispose()
      map?.dispose()
    },
    ready: ready.then(() => {
      if (disposed) return
      if (!map) return
      material.map = map
      material.needsUpdate = true
    }),
  }
}
