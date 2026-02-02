import * as THREE from 'three'

import { resolveVitePublicUrl } from './resolveVitePublicUrl.js'

export type BodyTextureKind = 'earth' | 'moon' | 'sun'

export type CreateBodyMeshOptions = {
  color: THREE.ColorRepresentation

  /** Optional texture multiplier color (defaults to `options.color`). */
  textureColor?: THREE.ColorRepresentation

  /**
   * Optional texture URL/path.
   *
   * If relative, it's resolved against Vite's `BASE_URL`.
   */
  textureUrl?: string

  /** Optional, lightweight procedural texture (no binary assets). */
  textureKind?: BodyTextureKind
}

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create 2D canvas context for texture')

  draw(ctx, canvas)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function makeProceduralBodyTexture(kind: BodyTextureKind): THREE.Texture {
  return makeCanvasTexture((ctx, canvas) => {
    // Deterministic (no RNG): keep e2e snapshots stable.
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (kind === 'sun') {
      const g = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.height * 0.05,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.height * 0.6,
      )
      g.addColorStop(0, '#fff4b0')
      g.addColorStop(0.45, '#ffb703')
      g.addColorStop(1, '#b45309')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Subtle bands.
      ctx.globalAlpha = 0.18
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 10; i++) {
        const y = (i / 10) * canvas.height
        ctx.fillRect(0, y, canvas.width, 2)
      }
      ctx.globalAlpha = 1
      return
    }

    if (kind === 'earth') {
      ctx.fillStyle = '#0b4aa2'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Latitude-ish bands.
      ctx.globalAlpha = 0.25
      ctx.fillStyle = '#1d7bd1'
      for (let i = 0; i < 8; i++) {
        const y = (i / 8) * canvas.height
        ctx.fillRect(0, y, canvas.width, 6)
      }
      ctx.globalAlpha = 1

      // Simple "continents" blobs.
      ctx.fillStyle = '#1f8a3b'
      ctx.beginPath()
      ctx.ellipse(canvas.width * 0.33, canvas.height * 0.45, 56, 28, 0.2, 0, Math.PI * 2)
      ctx.ellipse(canvas.width * 0.52, canvas.height * 0.62, 42, 22, -0.1, 0, Math.PI * 2)
      ctx.ellipse(canvas.width * 0.75, canvas.height * 0.38, 44, 20, 0.4, 0, Math.PI * 2)
      ctx.fill()

      // Polar caps.
      ctx.globalAlpha = 0.7
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, 10)
      ctx.fillRect(0, canvas.height - 10, canvas.width, 10)
      ctx.globalAlpha = 1

      return
    }

    // moon
    ctx.fillStyle = '#6b7280'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#4b5563'
    const craters = [
      [0.2, 0.3, 18],
      [0.35, 0.55, 26],
      [0.62, 0.42, 22],
      [0.78, 0.65, 30],
      [0.55, 0.25, 16],
    ] as const
    for (const [nx, ny, r] of craters) {
      ctx.beginPath()
      ctx.arc(canvas.width * nx, canvas.height * ny, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Slight lighting gradient.
    const g = ctx.createLinearGradient(0, 0, canvas.width, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.25)')
    g.addColorStop(0.5, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(255,255,255,0.05)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  })
}

/**
 * Creates a body mesh with a unit sphere geometry.
 *
 * Use `mesh.scale.setScalar(radiusWorld)` to set the visual size.
 * This allows updating scale without rebuilding geometry.
 */
export function createBodyMesh(options: CreateBodyMeshOptions): {
  mesh: THREE.Mesh
  dispose: () => void
  ready: Promise<void>
} {
  // Unit sphere geometry - scale is applied via mesh.scale
  const geometry = new THREE.SphereGeometry(1, 48, 24)
  // Three.js spheres have their poles on ±Y, but SPICE IAU_* body-fixed frames use +Z as
  // the north pole. Rotate the geometry so the mesh's local +Z corresponds to geographic north.
  geometry.rotateX(Math.PI / 2)

  let disposed = false

  let map: THREE.Texture | undefined = options.textureKind ? makeProceduralBodyTexture(options.textureKind) : undefined

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
          tex.wrapT = THREE.RepeatWrapping
          tex.needsUpdate = true

          map?.dispose()
          map = tex
        })
        .catch((err) => {
          // Keep rendering if a texture fails; surface failures for debugging.
          console.warn('Failed to load body texture', options.textureUrl, err)
        })
    : Promise.resolve()

  // Note: `MeshStandardMaterial.color` multiplies `map`.
  // For full-color albedo textures (e.g. Earth), tinting the texture by a
  // non-white base color can significantly darken / distort the result.
  // Use `options.color` as a fallback when no texture is present.
  // If a body needs dimming/tinting while textured, use `options.textureColor`.
  const baseColor = map ? new THREE.Color(options.textureColor ?? options.color) : new THREE.Color(options.color)
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: options.textureKind === 'sun' ? 0.2 : 0.9,
    metalness: 0.0,
    map,
    emissive: options.textureKind === 'sun' ? new THREE.Color('#ffcc55') : new THREE.Color('#000000'),
    emissiveIntensity: options.textureKind === 'sun' ? 0.8 : 0.0,
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
      // If the texture loaded after we created the material, apply it now.
      if (disposed) return
      if (!map) return

      material.map = map
      // Note: `material.color` multiplies `material.map`.
      // Only override the default multiplier if `textureColor` is explicitly set.
      material.color.set(options.textureColor ?? options.color)
      material.needsUpdate = true
    }),
  }
}
