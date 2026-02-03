import * as THREE from 'three'

import { isTextureCacheClearedError, loadTextureCached } from './loadTextureCached.js'

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

  /** Optional alpha test threshold (0..1). */
  alphaTest?: number

  /**
   * Baseline opacity applied across the entire ring (0..1).
   *
   * Some ring textures (e.g. Uranus) only provide alpha for a narrow band near
   * the inner radius, which can make the ring read like a single ultra-thin
   * strip. `baseOpacity` clamps the final alpha so the annulus remains faintly
   * visible without affecting ring textures that rely on alpha for gaps.
   */
  baseOpacity?: number
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
  let mapRelease: (() => void) | undefined
  const ready: Promise<void> = options.textureUrl
    ? loadTextureCached(options.textureUrl, { colorSpace: THREE.SRGBColorSpace })
        .then(({ texture: tex, release }) => {
          if (disposed) {
            release()
            return
          }

          // U (radius) should clamp; V (angle) should repeat.
          tex.wrapS = THREE.ClampToEdgeWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.needsUpdate = true

          map = tex
          mapRelease = release
        })
        .catch((err) => {
          if (isTextureCacheClearedError(err)) return
          console.warn('Failed to load ring texture', options.textureUrl, err)
        })
    : Promise.resolve()

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? '#ffffff'),
    transparent: true,
    alphaTest: options.alphaTest,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0,
    map,
  })

  const disposeMap = () => {
    const release = mapRelease
    const tex = map

    // Clear references first so disposal is idempotent and re-entrancy safe.
    map = undefined
    mapRelease = undefined

    // Ensure the material no longer references the texture.
    material.map = null
    material.needsUpdate = true

    if (release) {
      release()
      return
    }

    tex?.dispose()
  }

  // If `baseOpacity` is provided, enable a shader-side alpha clamp.
  const baseOpacityEnabled = options.baseOpacity !== undefined
  const baseOpacity = THREE.MathUtils.clamp(options.baseOpacity ?? 0, 0, 1)

  if (baseOpacityEnabled) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.baseOpacity = { value: baseOpacity }

      // NOTE: `output_fragment` was deprecated in r154; newer builds use
      // `opaque_fragment`. Patch whichever include is present.
      const outputInclude = shader.fragmentShader.includes('#include <opaque_fragment>')
        ? '#include <opaque_fragment>'
        : '#include <output_fragment>'

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float baseOpacity;')
        .replace(outputInclude, `diffuseColor.a = max(diffuseColor.a, baseOpacity);\n${outputInclude}`)
    }

    // Ensure shader program cache differs when this feature is enabled.
    // The baseOpacity value itself is a uniform (so it doesn't need to affect the cache key).
    material.customProgramCacheKey = () => 'ring-baseOpacity-enabled'
  }

  const mesh = new THREE.Mesh(geometry, material)

  return {
    mesh,
    dispose: () => {
      disposed = true
      disposeMap()
      geometry.dispose()
      material.dispose()
    },
    ready: ready.then(() => {
      if (disposed) return
      if (!map) return
      material.map = map
      material.needsUpdate = true
    }),
  }
}
