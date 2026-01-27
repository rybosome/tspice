import * as THREE from 'three'

export type CreateStarfieldOptions = {
  /** Seed for deterministic star placement. */
  seed: number

  /** Number of stars/points. */
  count?: number

  /** Radius (world units) of the star shell around the camera. */
  radiusWorld?: number

  /** Star size in pixels (because sizeAttenuation is disabled). */
  sizePx?: number
}

// Tiny deterministic PRNG (mulberry32).
function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeStarSpriteTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create 2D canvas context for star sprite')

  // Deterministic (no RNG): keep e2e snapshots stable.
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')

  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function sampleUnitSphere(rng: () => number): [number, number, number] {
  // Uniform sphere sampling.
  const u = rng()
  const v = rng()
  const theta = 2 * Math.PI * u
  const z = 2 * v - 1
  const r = Math.sqrt(Math.max(0, 1 - z * z))
  return [r * Math.cos(theta), r * Math.sin(theta), z]
}

export function createStarfield(options: CreateStarfieldOptions): {
  object: THREE.Points
  syncToCamera: (camera: THREE.Camera) => void
  dispose: () => void
} {
  const count = options.count ?? 6000
  const radiusWorld = options.radiusWorld ?? 900
  const sizePx = options.sizePx ?? 1.6

  const rng = createRng(options.seed)

  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const [x, y, z] = sampleUnitSphere(rng)
    const radius = radiusWorld * (0.86 + 0.14 * rng())

    const j = i * 3
    positions[j + 0] = x * radius
    positions[j + 1] = y * radius
    positions[j + 2] = z * radius

    // Slight color temperature variation + brightness.
    const warm = rng() < 0.45
    const brightness = 0.65 + 0.35 * rng()

    const rCol = (warm ? 1.0 : 0.78) * brightness
    const gCol = (warm ? 0.93 : 0.88) * brightness
    const bCol = (warm ? 0.78 : 1.0) * brightness

    colors[j + 0] = rCol
    colors[j + 1] = gCol
    colors[j + 2] = bCol
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  // Keep visible even though we move the object around each render.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), radiusWorld * 1.1)

  const sprite = makeStarSpriteTexture()

  const material = new THREE.PointsMaterial({
    size: sizePx,
    sizeAttenuation: false,
    vertexColors: true,
    map: sprite,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  })

  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false
  // Never allow the starfield to be picked.
  object.raycast = () => {}

  return {
    object,

    syncToCamera: (camera) => {
      object.position.copy(camera.position)
    },

    dispose: () => {
      geometry.dispose()
      material.dispose()
      sprite.dispose()
    },
  }
}
