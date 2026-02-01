import * as THREE from 'three'

import { J2000_FRAME, type BodyRef, type EtSeconds, type FrameId, type SpiceClient, type Vec3Km } from '../spice/SpiceClient.js'
import { mat3ToMatrix4 } from './FrameAxes.js'

const AU_KM = 149_597_870.7

export type CreateAsteroidBeltOptions = {
  /** Seed for deterministic asteroid placement. */
  seed: number

  /** km -> world scale factor used by the scene. */
  kmToWorld: number

  /** Number of points (asteroids) to generate. */
  count?: number

  /** Main belt inner radius, in AU. */
  innerRadiusAu?: number

  /** Main belt outer radius, in AU. */
  outerRadiusAu?: number

  /** Vertical thickness (1σ) in AU. */
  thicknessSigmaAu?: number

  /** Point size in pixels (sizeAttenuation is disabled). */
  sizePx?: number

  /** Material opacity. */
  opacity?: number
}

export type AsteroidBeltHandle = {
  object: THREE.Points
  update: (input: {
    spiceClient: SpiceClient
    frame: FrameId
    et: EtSeconds
    sceneObserver: BodyRef
    focusPosKm: Vec3Km
  }) => void
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

function sampleGaussian(rng: () => number): number {
  // Box–Muller (deterministic given rng).
  // Clamp away from 0 so log() doesn't blow up.
  const u1 = Math.max(1e-12, rng())
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

let sharedAsteroidSpriteTexture: THREE.Texture | null = null

function createAsteroidSpriteTexture(): THREE.Texture {
  // Deterministic (no RNG): keeps e2e snapshots stable.
  // Prefer CanvasTexture when DOM is available, but fall back to a DataTexture so
  // this module remains importable in non-DOM environments (tests, SSR).
  const size = 16
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to create 2D canvas context for asteroid sprite')

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const r = size / 2
    const g = ctx.createRadialGradient(r, r, 0, r, r, r)
    g.addColorStop(0, 'rgba(210,210,210,1)')
    g.addColorStop(0.35, 'rgba(200,200,200,0.9)')
    g.addColorStop(0.75, 'rgba(160,160,160,0.25)')
    g.addColorStop(1, 'rgba(150,150,150,0)')

    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    return texture
  }

  const data = new Uint8Array(size * size * 4)
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const rMax = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const t = Math.min(1, Math.sqrt(dx * dx + dy * dy) / rMax)

      // A simple smoothstep-ish alpha falloff.
      const alpha01 = Math.pow(1 - t, 2.5)

      const i = (y * size + x) * 4
      data[i + 0] = 200
      data[i + 1] = 200
      data[i + 2] = 200
      data[i + 3] = Math.round(alpha01 * 255)
    }
  }

  const texture = new THREE.DataTexture(data, size, size)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function getAsteroidSpriteTexture(): THREE.Texture {
  sharedAsteroidSpriteTexture ??= createAsteroidSpriteTexture()
  return sharedAsteroidSpriteTexture
}

function sampleRadiusAu(rng: () => number, innerAu: number, outerAu: number): number {
  // Base distribution: uniform surface density in an annulus.
  // r = sqrt(u*(r2^2-r1^2) + r1^2)
  const r1 = innerAu
  const r2 = outerAu
  const u = rng()
  const rBase = Math.sqrt(u * (r2 * r2 - r1 * r1) + r1 * r1)

  // Add a mild, deterministic density bump around the middle of the belt.
  // This isn't intended to be scientifically rigorous, just less "flat".
  const mid = 2.75
  const bump = 0.18 * sampleGaussian(rng)
  const rBumped = clamp(rBase + bump, r1, r2)
  return rBumped
}

export function createAsteroidBelt(options: CreateAsteroidBeltOptions): AsteroidBeltHandle {
  const count = options.count ?? 20_000
  const innerRadiusAu = options.innerRadiusAu ?? 2.1
  const outerRadiusAu = options.outerRadiusAu ?? 3.3
  const thicknessSigmaAu = options.thicknessSigmaAu ?? 0.05
  const sizePx = options.sizePx ?? 1.4
  const opacity = options.opacity ?? 0.85

  const rng = createRng(options.seed)

  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * rng()
    const rAu = sampleRadiusAu(rng, innerRadiusAu, outerRadiusAu)

    const zAu = sampleGaussian(rng) * thicknessSigmaAu

    const xKm = rAu * AU_KM * Math.cos(theta)
    const yKm = rAu * AU_KM * Math.sin(theta)
    const zKm = zAu * AU_KM

    const j = i * 3
    positions[j + 0] = xKm * options.kmToWorld
    positions[j + 1] = yKm * options.kmToWorld
    positions[j + 2] = zKm * options.kmToWorld

    // Mild brightness variation.
    const r01 = (rAu - innerRadiusAu) / (outerRadiusAu - innerRadiusAu)
    const centerBoost = Math.exp(-Math.pow((rAu - 2.75) / 0.35, 2))
    const base = 0.55 + 0.35 * rng()
    const brightness = base * (0.85 + 0.25 * centerBoost) * (0.92 + 0.08 * (1 - Math.abs(r01 - 0.5) * 2))

    const c = THREE.MathUtils.clamp(brightness, 0, 1)
    colors[j + 0] = c
    colors[j + 1] = c
    colors[j + 2] = c
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const outerWorld = outerRadiusAu * AU_KM * options.kmToWorld
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), outerWorld * 1.15)

  const sprite = getAsteroidSpriteTexture()

  const material = new THREE.PointsMaterial({
    size: sizePx,
    sizeAttenuation: false,
    vertexColors: true,
    map: sprite,
    transparent: true,
    opacity,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
  })

  const points = new THREE.Points(geometry, material)
  points.name = 'AsteroidBelt'
  points.raycast = () => {}

  const kmToWorld = options.kmToWorld

  // Cache matrices to minimize allocations and reduce SPICE calls.
  const rotMat = new THREE.Matrix4()
  const j2fMat = new THREE.Matrix4()
  let eclToJ2000Mat: THREE.Matrix4 | null = null

  let lastJ2000ToFrame: FrameId | null = null
  let lastJ2000ToFrameEt: EtSeconds | null = null

  const getEclToJ2000 = (spiceClient: SpiceClient, et: EtSeconds): THREE.Matrix4 => {
    if (!eclToJ2000Mat) {
      const eclToJ2k = spiceClient.getFrameTransform({
        from: 'ECLIPJ2000',
        to: J2000_FRAME,
        et,
      })
      eclToJ2000Mat = new THREE.Matrix4().copy(mat3ToMatrix4(eclToJ2k))
    }
    return eclToJ2000Mat
  }

  const update: AsteroidBeltHandle['update'] = (input) => {
    // Place the belt at the Sun's position in the current rebased scene.
    const sunState = input.spiceClient.getBodyState({
      target: 'SUN',
      observer: input.sceneObserver,
      frame: input.frame,
      et: input.et,
    })
    const sunPosKm = sunState.positionKm
    const focusPosKm = input.focusPosKm
    points.position.set(
      (sunPosKm[0] - focusPosKm[0]) * kmToWorld,
      (sunPosKm[1] - focusPosKm[1]) * kmToWorld,
      (sunPosKm[2] - focusPosKm[2]) * kmToWorld,
    )

    // Orient the belt into the scene frame.
    // We treat the belt's intrinsic coordinates as ecliptic (ECLIPJ2000).
    // Cache ECLIPJ2000 -> J2000 (time-invariant), and per-update compute only
    // J2000 -> frame when needed.
    const eclToJ2000 = getEclToJ2000(input.spiceClient, input.et)
    if (input.frame === J2000_FRAME) {
      rotMat.copy(eclToJ2000)
    } else {
      if (lastJ2000ToFrame !== input.frame || lastJ2000ToFrameEt !== input.et) {
        const j2000ToFrame = input.spiceClient.getFrameTransform({
          from: J2000_FRAME,
          to: input.frame,
          et: input.et,
        })
        j2fMat.copy(mat3ToMatrix4(j2000ToFrame))
        lastJ2000ToFrame = input.frame
        lastJ2000ToFrameEt = input.et
      }

      rotMat.copy(j2fMat).multiply(eclToJ2000)
    }

    points.setRotationFromMatrix(rotMat)
  }

  const dispose = () => {
    geometry.dispose()
    material.dispose()
  }

  return { object: points, update, dispose }
}
