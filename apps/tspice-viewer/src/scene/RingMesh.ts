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

  // `THREE.RingGeometry` ships with planar UVs (x/y mapped into [0, 1]).
  // Our ring textures are authored as a radial strip (U = radius) that should wrap
  // around the ring (V = angle), so we override UVs to be polar.
  //
  // u: radial fraction (inner -> outer)
  // v: angular fraction (atan2)
  const position = geometry.attributes.position
  const uvs = new Float32Array(position.count * 2)
  const radiusRange = options.outerRadius - options.innerRadius
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const r = Math.sqrt(x * x + y * y)

    // Clamp for numeric stability (and to handle any future geometry changes).
    const u = radiusRange === 0 ? 0 : THREE.MathUtils.clamp((r - options.innerRadius) / radiusRange, 0, 1)

    // Map angle to [0, 1].
    const v = (Math.atan2(y, x) + Math.PI) / (2 * Math.PI)

    uvs[i * 2 + 0] = u
    uvs[i * 2 + 1] = v
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

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
          // U (radius) should clamp; V (angle) should repeat.
          tex.wrapS = THREE.ClampToEdgeWrapping
          tex.wrapT = THREE.RepeatWrapping
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
