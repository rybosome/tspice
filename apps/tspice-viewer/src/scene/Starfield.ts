import * as THREE from 'three'

export type CreateStarfieldOptions = {
  /** Seed for deterministic star placement. */
  seed: number

  /**
   * Opt-in enhanced deterministic starfield.
   *
   * Defaults to `false` to preserve existing visuals.
   */
  enhanced?: boolean

  /**
   * Enable subtle twinkling animation.
   *
   * Defaults:
   * - enhanced: `true`
   * - legacy: `false`
   */
  twinkle?: boolean

  /** Number of stars/points. */
  count?: number

  /** Radius (world units) of the star shell around the camera. */
  radiusWorld?: number

  /** Star size in pixels (because sizeAttenuation is disabled). */
  sizePx?: number
}

export type StarfieldHandle = {
  object: THREE.Object3D
  syncToCamera: (camera: THREE.Camera) => void
  /** Optional per-frame update hook (used for twinkle). */
  update?: (timeSec: number) => void
  dispose: () => void
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

function mix32(x: number): number {
  // Tiny 32-bit mixing function for stable, deterministic hashes.
  x |= 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

function hash01(seed: number, i: number, salt: number): number {
  // Stable float in [0, 1) derived from (seed, i, salt).
  const x = mix32(((seed ^ salt) + Math.imul(i, 0x9e3779b9)) | 0)
  return x / 4294967296
}

function fibonacciUnitSphere(i: number, n: number, seed: number): [number, number, number] {
  // Low-discrepancy-ish sphere sampling (Fibonacci sphere), but *scrambled*
  // within each stratum to avoid visible concentric ring artifacts in the
  // near layers.
  //
  // Based on: https://stackoverflow.com/a/26127012
  const u = (i + hash01(seed, i, 0xa511e9b3)) / n
  const y = 1 - 2 * u
  const r = Math.sqrt(Math.max(0, 1 - y * y))

  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const theta = goldenAngle * (i + hash01(seed, i, 0x63d83595))

  return [r * Math.cos(theta), r * Math.sin(theta), y]
}

function randomQuaternion(rng: () => number): THREE.Quaternion {
  // Deterministic quaternion from 3 randoms.
  const u1 = rng()
  const u2 = rng()
  const u3 = rng()

  const sqrt1MinusU1 = Math.sqrt(1 - u1)
  const sqrtU1 = Math.sqrt(u1)
  return new THREE.Quaternion(
    sqrt1MinusU1 * Math.sin(2 * Math.PI * u2),
    sqrt1MinusU1 * Math.cos(2 * Math.PI * u2),
    sqrtU1 * Math.sin(2 * Math.PI * u3),
    sqrtU1 * Math.cos(2 * Math.PI * u3),
  )
}

function createStarLayer(opts: {
  seed: number
  count: number
  radiusWorld: number
  sizePx: number
  baseBrightness: number
  bandNormal: THREE.Vector3
  bandWidth: number
  bandBoost: number
  warmChance: number
  distribution?: 'fibonacci' | 'random'
  twinkle?: boolean
}): {
  object: THREE.Points
  update?: (timeSec: number) => void
  dispose: () => void
} {
  const rng = createRng(opts.seed)
  const rotation = randomQuaternion(rng)

  const positions = new Float32Array(opts.count * 3)
  const colors = new Float32Array(opts.count * 3)

  const twinkleEnabled = opts.twinkle === true
  const twinklePhase = twinkleEnabled ? new Float32Array(opts.count) : undefined
  const twinkleSpeed = twinkleEnabled ? new Float32Array(opts.count) : undefined
  const twinkleAmp = twinkleEnabled ? new Float32Array(opts.count) : undefined

  const distribution = opts.distribution ?? 'fibonacci'

  for (let i = 0; i < opts.count; i++) {
    const [x0, y0, z0] =
      distribution === 'random' ? sampleUnitSphere(rng) : fibonacciUnitSphere(i, opts.count, opts.seed)
    const dir = new THREE.Vector3(x0, y0, z0).applyQuaternion(rotation)

    const radius = opts.radiusWorld * (0.86 + 0.14 * rng())

    const j = i * 3
    positions[j + 0] = dir.x * radius
    positions[j + 1] = dir.y * radius
    positions[j + 2] = dir.z * radius

    // Milky Way band bias: brighten stars that lie close to a deterministic plane.
    const bandAmount = Math.abs(dir.dot(opts.bandNormal))
    const bandFactor = Math.exp(-Math.pow(bandAmount / opts.bandWidth, 2))

    const warm = rng() < opts.warmChance
    const brightness = opts.baseBrightness * (0.65 + 0.35 * rng()) * (1 + opts.bandBoost * bandFactor)

    const rCol = (warm ? 1.0 : 0.78) * brightness
    const gCol = (warm ? 0.93 : 0.88) * brightness
    const bCol = (warm ? 0.78 : 1.0) * brightness

    colors[j + 0] = rCol
    colors[j + 1] = gCol
    colors[j + 2] = bCol

    if (twinkleEnabled && twinklePhase && twinkleSpeed && twinkleAmp) {
      // Only a subtle effect, and bias it towards brighter stars.
      // Brightness can exceed 1 due to band boosts, so clamp.
      const bright01 = THREE.MathUtils.clamp((brightness - 0.85) / 0.85, 0, 1)
      twinkleAmp[i] = 0.18 * bright01
      twinkleSpeed[i] = 0.7 + 1.6 * rng()
      twinklePhase[i] = 2 * Math.PI * rng()
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  if (twinkleEnabled && twinklePhase && twinkleSpeed && twinkleAmp) {
    geometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(twinklePhase, 1))
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeed, 1))
    geometry.setAttribute('aTwinkleAmp', new THREE.BufferAttribute(twinkleAmp, 1))
  }
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), opts.radiusWorld * 1.1)

  const sprite = makeStarSpriteTexture()

  const material = new THREE.PointsMaterial({
    size: opts.sizePx,
    sizeAttenuation: false,
    vertexColors: true,
    map: sprite,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  })

  let uTime: { value: number } | null = null
  let lastTimeSec = 0
  if (twinkleEnabled) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: lastTimeSec }
      uTime = shader.uniforms.uTime as { value: number }

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'attribute float aTwinklePhase;',
            'attribute float aTwinkleSpeed;',
            'attribute float aTwinkleAmp;',
            'uniform float uTime;',
            'varying float vTwinkle;',
          ].join('\n'),
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'vTwinkle = aTwinkleAmp * sin(uTime * aTwinkleSpeed + aTwinklePhase);',
          ].join('\n'),
        )

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', ['#include <common>', 'varying float vTwinkle;'].join('\n'))
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          [
            'vec4 diffuseColor = vec4( diffuse, opacity );',
            // Keep this subtle: amp is already <= 0.18.
            'diffuseColor.rgb *= (1.0 + vTwinkle);',
          ].join('\n'),
        )
    }

    // Ensure we actually rebuild the program to include the new shader chunks.
    material.needsUpdate = true
  }

  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false
  object.raycast = () => {}

  return {
    object,
    update: twinkleEnabled
      ? (timeSec) => {
          lastTimeSec = timeSec
          if (uTime) uTime.value = timeSec
        }
      : undefined,
    dispose: () => {
      geometry.dispose()
      material.dispose()
      sprite.dispose()
    },
  }
}

function createEnhancedStarfield(options: CreateStarfieldOptions): StarfieldHandle {
  const seed = options.seed
  const twinkle = options.twinkle ?? true
  const group = new THREE.Group()
  group.frustumCulled = false
  group.raycast = () => {}

  const rng = createRng(seed ^ 0x9e3779b9)
  const bandNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(randomQuaternion(rng)).normalize()

  // Layer tuning: simple + deterministic.
  const layers = [
    // Far dust: lots of very small, faint stars.
    {
      count: 14_000,
      radiusWorld: 1050,
      sizePx: 1.0,
      baseBrightness: 0.45,
      bandWidth: 0.22,
      bandBoost: 0.9,
      warmChance: 0.35,
    },
    // Mid layer.
    {
      count: 6000,
      radiusWorld: 900,
      sizePx: 1.6,
      baseBrightness: 0.75,
      bandWidth: 0.18,
      bandBoost: 1.2,
      warmChance: 0.45,
    },
    // Bright accents.
    {
      count: 900,
      radiusWorld: 820,
      sizePx: 2.6,
      baseBrightness: 1.15,
      bandWidth: 0.16,
      bandBoost: 1.6,
      warmChance: 0.55,
      // The accent layer is intentionally less regular to avoid visible
      // low-discrepancy “grid” patterns.
      distribution: 'random' as const,
      twinkle,
    },
  ]

  const created = layers.map((layer, idx) =>
    createStarLayer({
      seed: seed + 1013 * (idx + 1),
      ...layer,
      bandNormal,
    }),
  )

  for (const { object } of created) group.add(object)

  return {
    object: group,
    syncToCamera: (camera) => {
      group.position.copy(camera.position)
    },
    update: twinkle
      ? (timeSec) => {
          for (const c of created) c.update?.(timeSec)
        }
      : undefined,
    dispose: () => {
      for (const c of created) c.dispose()
    },
  }
}

export function createStarfield(options: CreateStarfieldOptions): StarfieldHandle {
  if (options.enhanced) {
    return createEnhancedStarfield(options)
  }

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
