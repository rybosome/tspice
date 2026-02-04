import * as THREE from 'three'

import { isTextureCacheClearedError, loadTextureCached } from './loadTextureCached.js'
import { createRingMesh } from './RingMesh.js'
import { isEarthAppearanceLayer, type BodyAppearanceStyle, type BodyTextureKind } from './SceneModel.js'
import { isDev } from '../utils/isDev.js'

export type CreateBodyMeshOptions = {
  /** Optional stable ID (e.g. `"EARTH"`) for body-specific rendering. */
  bodyId?: string

  appearance: BodyAppearanceStyle
}

export type EarthAppearanceTuning = {
  nightAlbedo: number
  twilight: number
  nightLightsIntensity: number
  atmosphereIntensity: number
  cloudsNightMultiplier: number
}

export type BodyMeshUpdate = (args: {
  sunDirWorld: THREE.Vector3
  etSec: number
  earthTuning?: EarthAppearanceTuning
}) => void

function make1x1TextureRGBA([r, g, b, a]: readonly [number, number, number, number]): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, a])
  const tex = new THREE.DataTexture(data, 1, 1)
  tex.needsUpdate = true
  tex.colorSpace = THREE.NoColorSpace
  return tex
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

type ShaderSourceKey = 'fragmentShader' | 'vertexShader'

type OnBeforeCompile = NonNullable<THREE.Material['onBeforeCompile']>
type BeforeCompileShader = Parameters<OnBeforeCompile>[0]

function composeOnBeforeCompile(material: THREE.Material, patch: OnBeforeCompile): () => void {
  const prev = material.onBeforeCompile

  const composed: OnBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer)
    patch(shader, renderer)
  }

  material.onBeforeCompile = composed

  // Allow callers to restore the previous hook (useful for cleanup / testing).
  // Guard against clobbering if `onBeforeCompile` was overwritten later.
  return () => {
    if (material.onBeforeCompile === composed) {
      material.onBeforeCompile = prev
    }
  }
}

function createWarnOnce() {
  // Avoid spamming end users in production; these warnings are mainly useful
  // for shader-chunk drift during local development.
  if (!isDev()) {
    return (_key: string, ..._args: unknown[]) => {}
  }

  const seen = new Set<string>()
  return (key: string, ...args: unknown[]) => {
    if (seen.has(key)) return
    seen.add(key)
    console.warn(...args)
  }
}

function applyMapAndBump(material: THREE.MeshStandardMaterial, map: THREE.Texture | undefined, bumpScale: number) {
  const EPS = 1e-6

  const nextMap = map ?? null
  const nextUseMap = nextMap != null
  const nextUseBump = nextUseMap && Math.abs(bumpScale) > EPS

  const nextBumpMap = nextUseBump ? nextMap : null
  const nextBumpScale = nextUseBump ? bumpScale : 0

  // `needsUpdate` triggers a shader recompile, so avoid setting it unless we
  // actually toggle a feature define (e.g. USE_MAP / USE_BUMPMAP).
  const prevUseMap = material.map != null
  const prevUseBump = material.bumpMap != null

  // Be conservative when swapping one non-null map for another: Three.js shader
  // compilation and sampling paths can depend on texture internals (color space,
  // video textures, UV transforms, etc). To keep this robust, force a recompile
  // on any map replacement.
  const prevMap = material.map
  const needsUpdate =
    prevUseMap !== nextUseMap || prevUseBump !== nextUseBump || (prevUseMap && nextUseMap && prevMap !== nextMap)

  material.map = nextMap
  material.bumpMap = nextBumpMap
  material.bumpScale = nextBumpScale

  if (needsUpdate) {
    material.needsUpdate = true
  }
}

type ShaderSource = Pick<BeforeCompileShader, ShaderSourceKey>

function getShaderSource(shader: ShaderSource, source: ShaderSourceKey): string | undefined {
  const value = shader[source]
  return typeof value === 'string' ? value : undefined
}

type SafeShaderReplaceFailureReason = 'missingSource' | 'replaceFailed'

function safeShaderReplaceInSource(args: {
  src: string
  source: ShaderSourceKey
  needle: string
  replacement: string
  marker: string
  warnOnce: (key: string, ...args: unknown[]) => void
  warnKey: string
}): { ok: true; next: string } | { ok: false; next: string; reason: 'replaceFailed' } {
  const { src, source, needle, replacement, marker, warnOnce, warnKey } = args

  if (src.includes(marker)) return { ok: true, next: src }

  // Safety: only inject when the needle is *uniquely* present, otherwise a shader
  // chunk rename / refactor can lead to surprising partial patches.
  let occurrences = 0
  for (let i = 0; ; ) {
    const next = src.indexOf(needle, i)
    if (next === -1) break
    occurrences++
    i = next + needle.length
  }

  if (occurrences === 0) {
    warnOnce(warnKey, '[BodyMesh] shader injection skipped (missing chunk)', { source, needle, marker })
    return { ok: false, next: src, reason: 'replaceFailed' }
  }

  if (occurrences > 1) {
    warnOnce(warnKey, '[BodyMesh] shader injection skipped (needle not unique)', {
      source,
      needle,
      occurrences,
      marker,
    })
    return { ok: false, next: src, reason: 'replaceFailed' }
  }

  const next = src.replace(needle, replacement)
  if (next === src || !next.includes(marker)) {
    warnOnce(warnKey, '[BodyMesh] shader injection skipped (replace failed)', { source, needle, marker })
    return { ok: false, next: src, reason: 'replaceFailed' }
  }

  return { ok: true, next }
}

function safeShaderReplaceAll(args: {
  shader: BeforeCompileShader
  source: ShaderSourceKey
  replacements: Array<{
    needle: string
    replacement: string
    marker: string
    warnKey: string
  }>
  warnOnce: (key: string, ...args: unknown[]) => void
  warnKey: string
}): { ok: true; next: string } | { ok: false; next: string; reason: SafeShaderReplaceFailureReason } {
  const { shader, source, replacements, warnOnce, warnKey } = args

  const shaderSources: ShaderSource = shader

  const src0 = getShaderSource(shaderSources, source)
  if (src0 == null) {
    warnOnce(warnKey, '[BodyMesh] shader injection skipped (missing shader source)', { source })
    return { ok: false, next: '', reason: 'missingSource' }
  }

  return safeShaderReplaceAllInSource({ src: src0, source, replacements, warnOnce })
}

function safeShaderReplaceAllInSource(args: {
  src: string
  source: ShaderSourceKey
  replacements: Array<{
    needle: string
    replacement: string
    marker: string
    warnKey: string
  }>
  warnOnce: (key: string, ...args: unknown[]) => void
}): { ok: true; next: string } | { ok: false; next: string; reason: 'replaceFailed' } {
  const { src: src0, source, replacements, warnOnce } = args

  let src = src0
  for (const r of replacements) {
    const res = safeShaderReplaceInSource({
      src,
      source,
      needle: r.needle,
      replacement: r.replacement,
      marker: r.marker,
      warnOnce,
      warnKey: r.warnKey,
    })
    if (!res.ok) return { ok: false, next: src0, reason: 'replaceFailed' }
    src = res.next
  }

  return { ok: true, next: src }
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
  update?: BodyMeshUpdate
} {
  // Unit sphere geometry - scale is applied via mesh.scale
  const geometry = new THREE.SphereGeometry(1, 48, 24)
  // Three.js spheres have their poles on ±Y, but SPICE IAU_* body-fixed frames use +Z as
  // the north pole. Rotate the geometry so the mesh's local +Z corresponds to geographic north.
  geometry.rotateX(Math.PI / 2)

  let disposed = false

  const warnOnce = createWarnOnce()

  const isEarth = options.bodyId === 'EARTH'

  // Collect async assets so `ready` consistently represents "all appearance assets are ready".
  const readyExtras: Promise<void>[] = []

  const surface = options.appearance.surface
  const surfaceTexture = surface.texture
  const textureKind = surfaceTexture?.kind
  const textureUrl = surfaceTexture?.url
  const textureColor = surfaceTexture?.color

  const surfaceRoughness = THREE.MathUtils.clamp(surface.roughness ?? (textureKind === 'sun' ? 0.2 : 0.9), 0.0, 1.0)
  const surfaceMetalness = THREE.MathUtils.clamp(surface.metalness ?? 0.0, 0.0, 1.0)

  // Three.js' bumpScale is unbounded but large values can cause extreme artifacts.
  // In practice our configs expect small values (~0.0–0.1). Clamp to a tighter,
  // still-safe range.
  const bumpScale = THREE.MathUtils.clamp(surface.bumpScale ?? 0.0, 0.0, 0.25)

  const nightAlbedo = surface.nightAlbedo == null ? undefined : THREE.MathUtils.clamp(surface.nightAlbedo, 0.0, 1.0)
  const terminatorTwilight = THREE.MathUtils.clamp(surface.terminatorTwilight ?? 0.08, 0.0, 1.0)

  let map: THREE.Texture | undefined = textureKind ? makeProceduralBodyTexture(textureKind) : undefined
  let mapRelease: (() => void) | undefined

  // Note: `MeshStandardMaterial.color` multiplies `map`.
  // For full-color albedo textures (e.g. Earth), tinting the texture by a
  // non-white base color can significantly darken / distort the result.
  // Use `surface.color` as a fallback when no texture is present.
  // If a body needs dimming/tinting while textured, use `surface.texture.color`.
  // NOTE: URL-backed textures load async, so `map` is initially unset.
  // Initialize `material.color` as if the texture is present to avoid a tinted
  // flash before the texture finishes loading.
  const baseColor = textureUrl
    ? new THREE.Color(textureColor ?? '#ffffff')
    : map
      ? new THREE.Color(textureColor ?? surface.color)
      : new THREE.Color(surface.color)
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: surfaceRoughness,
    metalness: surfaceMetalness,
    map,
    emissive: textureKind === 'sun' ? new THREE.Color('#ffcc55') : new THREE.Color('#000000'),
    emissiveIntensity: textureKind === 'sun' ? 5 : 0.0,
  })

  const onBeforeCompileRestores: Array<() => void> = []

  // Centralize map + bump setup so sync/async paths match.
  applyMapAndBump(material, map, bumpScale)

  function disposeMap(mat: THREE.MeshStandardMaterial) {
    const release = mapRelease
    const tex = map

    // Clear references first so disposal is idempotent and re-entrancy safe.
    map = undefined
    mapRelease = undefined

    // Ensure the material no longer references the texture.
    applyMapAndBump(mat, undefined, 0)

    if (release) {
      release()
      return
    }

    tex?.dispose()
  }

  if (textureUrl) {
    readyExtras.push(
      loadTextureCached(textureUrl, { colorSpace: THREE.SRGBColorSpace })
        .then(({ texture: tex, release }) => {
          let installed = false
          try {
            if (disposed) return

            tex.wrapS = THREE.RepeatWrapping
            tex.wrapT = THREE.RepeatWrapping
            tex.needsUpdate = true

            disposeMap(material)
            map = tex
            mapRelease = release
            installed = true
          } finally {
            // If we didn't take ownership via `mapRelease`, release immediately.
            if (!installed) release()
          }
        })
        .catch((err) => {
          if (isTextureCacheClearedError(err)) return
          // Keep rendering if a texture fails; surface failures for debugging.
          console.warn('Failed to load body texture', textureUrl, err)
        }),
    )
  }

  const mesh = new THREE.Mesh(geometry, material)

  const ringResult = options.appearance.rings
    ? createRingMesh({
        // Parent body is a unit sphere scaled by radius, so rings are specified
        // in planet-radius units.
        innerRadius: options.appearance.rings.innerRadiusRatio,
        outerRadius: options.appearance.rings.outerRadiusRatio,
        textureUrl: options.appearance.rings.textureUrl,
        color: options.appearance.rings.color,
        baseOpacity: options.appearance.rings.baseOpacity,
      })
    : undefined

  if (ringResult) {
    // Attach as a child so it inherits the body's pose and scale.
    mesh.add(ringResult.mesh)
    readyExtras.push(ringResult.ready)
  }

  // Earth-only higher-fidelity appearance layers (night lights, clouds, atmosphere, ocean glint).
  // This is kept opt-in via `appearance.layers` so other bodies remain unchanged.
  const earth = options.appearance.layers?.find(isEarthAppearanceLayer)?.earth

  const extraTexturesToDispose: THREE.Texture[] = []
  const extraTextureReleases: Array<() => void> = []
  const extraMaterialsToDispose: THREE.Material[] = []
  const extraGeometriesToDispose: THREE.BufferGeometry[] = []

  // Shared sun direction uniform for body shaders (mutated per-frame).
  const uSunDirWorld = new THREE.Vector3(1, 1, 1).normalize()

  // Used when optional maps are missing (prevents shader warnings and avoids showing a full white shell).
  const black1x1 = make1x1TextureRGBA([0, 0, 0, 255])
  extraTexturesToDispose.push(black1x1)

  let update: BodyMeshUpdate | undefined

  // Optional terminator/night-side albedo suppression.
  // This avoids ambient light washing out airless bodies on the night side.
  const useTerminatorDarkening = !isEarth && nightAlbedo != null && nightAlbedo < 1.0

  if (useTerminatorDarkening) {
    const uNightAlbedo = { value: nightAlbedo }
    const uTerminatorTwilight = { value: terminatorTwilight }

    const restoreTerminatorDarkening = composeOnBeforeCompile(material, (shader) => {
      shader.uniforms.uSunDirWorld = { value: uSunDirWorld }
      shader.uniforms.uNightAlbedo = uNightAlbedo
      shader.uniforms.uTerminatorTwilight = uTerminatorTwilight

      const markerCommon = '// tspice:terminator-darkening:uniforms'
      const markerNormal = '// tspice:terminator-darkening:geometry-normal'
      const markerLights = '// tspice:terminator-darkening:lights'

      const res = safeShaderReplaceAll({
        shader,
        source: 'fragmentShader',
        warnOnce,
        warnKey: 'terminator-darkening:patch',
        replacements: [
          {
            needle: '#include <common>',
            marker: markerCommon,
            replacement: [
              '#include <common>',
              markerCommon,
              'uniform vec3 uSunDirWorld;',
              'uniform float uNightAlbedo;',
              'uniform float uTerminatorTwilight;',
            ].join('\n'),
            warnKey: 'terminator-darkening:uniforms',
          },
          {
            needle: '#include <normal_fragment_begin>',
            marker: markerNormal,
            replacement: [
              '#include <normal_fragment_begin>',
              markerNormal,
              '\t// Stable geometric normal (view space) before any normal map perturbations.',
              '\tvec3 tspiceGeometryNormal = nonPerturbedNormal;',
            ].join('\n'),
            warnKey: 'terminator-darkening:geometry-normal',
          },
          {
            needle: '#include <lights_fragment_begin>',
            marker: markerLights,
            replacement: [
              markerLights,
              '\t// Terminator darkening: suppress ambient-lit albedo on the night side.',
              '\t{',
              '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
              '\t\t// Use the unperturbed geometric normal (view space) so the terminator mask',
              '\t\t// is stable and not affected by bump/normal maps.',
              '\t\t// `nonPerturbedNormal` is provided by <normal_fragment_begin> (and also handles FLAT_SHADED).',
              '\t\tfloat ndotl = dot( tspiceGeometryNormal, sunDirView );',
              '\t\tfloat dayFactor = smoothstep( 0.0, uTerminatorTwilight, ndotl );',
              '\t\tdiffuseColor.rgb *= mix( uNightAlbedo, 1.0, dayFactor );',
              '\t}',
              '',
              '#include <lights_fragment_begin>',
            ].join('\n'),
            warnKey: 'terminator-darkening:lights',
          },
        ],
      })

      if (!res.ok) return

      const shaderSources: ShaderSource = shader
      shaderSources.fragmentShader = res.next
    })
    onBeforeCompileRestores.push(restoreTerminatorDarkening)

    update = ({ sunDirWorld }) => {
      uSunDirWorld.copy(sunDirWorld)
    }
  }

  let cloudsMesh: THREE.Mesh | undefined
  let cloudsMaterial: THREE.MeshStandardMaterial | undefined
  let cloudsDriftRadPerSec = 0

  const waterMaskUniform = { value: black1x1 as THREE.Texture }
  const useWaterMaskUniform = { value: 0.0 }

  if (isEarth && earth) {
    // Night lights + ocean glint (surface shader patch)
    material.emissive.set('#000000')
    material.emissiveIntensity = 1.0

    // Runtime-tunable Earth appearance knobs (wired to debug sliders).
    const uNightAlbedo = { value: 0.004 }
    const uTwilight = { value: earth.nightLightsTwilight ?? 0.12 }
    const uNightLightsIntensity = { value: earth.nightLightsIntensity ?? 1.25 }
    const uAtmosphereIntensity = { value: earth.atmosphereIntensity ?? 0.55 }
    const uCloudsNightMultiplier = { value: 0.0 }

    const restoreEarthSurface = composeOnBeforeCompile(material, (shader) => {
      shader.uniforms.uSunDirWorld = { value: uSunDirWorld }
      shader.uniforms.uNightAlbedo = uNightAlbedo
      shader.uniforms.uTwilight = uTwilight
      shader.uniforms.uNightLightsIntensity = uNightLightsIntensity
      shader.uniforms.uOceanSpecIntensity = { value: earth.oceanSpecularIntensity ?? 0.35 }
      shader.uniforms.uOceanRoughness = { value: earth.oceanRoughness ?? 0.06 }
      shader.uniforms.uWaterMaskMap = waterMaskUniform
      shader.uniforms.uUseWaterMask = useWaterMaskUniform

      // Apply shader injections atomically (all-or-nothing) so we don't end up
      // with partial patches if a future Three.js chunk changes.
      const markerCommon = '// tspice:earth:uniforms'
      const markerNormal = '// tspice:earth:geometry-normal'
      const markerDarken = '// tspice:earth:night-side-darken'
      const markerNightLights = '// tspice:earth:night-lights'

      const required = safeShaderReplaceAll({
        shader,
        source: 'fragmentShader',
        warnOnce,
        warnKey: 'earth:required:patch',
        replacements: [
          {
            needle: '#include <common>',
            marker: markerCommon,
            replacement: [
              '#include <common>',
              markerCommon,
              'uniform vec3 uSunDirWorld;',
              'uniform float uNightAlbedo;',
              'uniform float uTwilight;',
              'uniform float uNightLightsIntensity;',
              'uniform float uOceanSpecIntensity;',
              'uniform float uOceanRoughness;',
              'uniform sampler2D uWaterMaskMap;',
              'uniform float uUseWaterMask;',
            ].join('\n'),
            warnKey: 'earth:uniforms',
          },
          {
            needle: '#include <normal_fragment_begin>',
            marker: markerNormal,
            replacement: [
              '#include <normal_fragment_begin>',
              markerNormal,
              '\t// Stable geometric normal (view space) before any normal map perturbations.',
              '\tvec3 tspiceGeometryNormal = nonPerturbedNormal;',
            ].join('\n'),
            warnKey: 'earth:geometry-normal',
          },
          {
            needle: '#include <lights_fragment_begin>',
            marker: markerDarken,
            replacement: [
              markerDarken,
              '\t// Earth-only: suppress ambient-lit albedo on the night side.',
              '\t{',
              '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
              '\t\t// Use the unperturbed geometric normal so the terminator mask is stable',
              '\t\t// (and not affected by bump/normal maps).',
              '\t\tfloat ndotl = dot( tspiceGeometryNormal, sunDirView );',
              '\t\tfloat dayFactor = smoothstep( 0.0, uTwilight, ndotl );',
              '',
              '\t\t// Keep a tiny floor so Earth is not totally invisible at night.',
              '\t\tfloat nightAlbedo = uNightAlbedo;',
              '\t\tdiffuseColor.rgb *= mix( nightAlbedo, 1.0, dayFactor );',
              '\t}',
              '',
              '#include <lights_fragment_begin>',
            ].join('\n'),
            warnKey: 'earth:night-side-darken',
          },
          {
            needle: '#include <emissivemap_fragment>',
            marker: markerNightLights,
            replacement: [
              '#include <emissivemap_fragment>',
              markerNightLights,
              '',
              '\t// Earth-only: gate night lights to the night side (soft terminator).',
              '\t{',
              '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
              '\t\tfloat ndotl = dot( tspiceGeometryNormal, sunDirView );',
              '\t\tfloat nightMask = 1.0 - smoothstep( -uTwilight, uTwilight, ndotl );',
              '\t\ttotalEmissiveRadiance *= nightMask * uNightLightsIntensity;',
              '\t}',
            ].join('\n'),
            warnKey: 'earth:night-lights',
          },
        ],
      })

      if (!required.ok) return

      let nextFrag = required.next

      const markerWaterFactor = '// tspice:earth:water-factor'
      const markerRoughness = '// tspice:earth:ocean-roughness'
      const markerGlint = '// tspice:earth:ocean-glint'
      const water = safeShaderReplaceAllInSource({
        src: nextFrag,
        source: 'fragmentShader',
        warnOnce,
        replacements: [
          {
            needle: 'vec3 totalEmissiveRadiance = emissive;',
            marker: markerWaterFactor,
            replacement: [
              'vec3 totalEmissiveRadiance = emissive;',
              markerWaterFactor,
              'float earthWaterFactor = 0.0;',
            ].join('\n'),
            warnKey: 'earth:water-factor',
          },
          {
            needle: '#include <roughnessmap_fragment>',
            marker: markerRoughness,
            replacement: [
              '#include <roughnessmap_fragment>',
              markerRoughness,
              '',
              '\t// Earth-only: ocean roughness heuristic / optional mask.',
              '\t{',
              '\t\tvec2 earthUv = vec2( 0.0 );',
              '\t\t#ifdef USE_MAP',
              '\t\t\tearthUv = vMapUv;',
              '\t\t#elif defined( USE_UV )',
              '\t\t\tearthUv = vUv;',
              '\t\t#endif',
              '',
              '\t\tfloat waterMask = 0.0;',
              '\t\tif ( uUseWaterMask > 0.5 ) {',
              '\t\t\twaterMask = texture2D( uWaterMaskMap, earthUv ).r;',
              '\t\t} else {',
              '\t\t\tvec3 c = diffuseColor.rgb;',
              '\t\t\tfloat blueDom = c.b - max( c.r, c.g );',
              '\t\t\twaterMask = smoothstep( 0.02, 0.18, blueDom ) * smoothstep( 0.05, 0.65, c.b );',
              '\t\t}',
              '',
              '\t\tearthWaterFactor = clamp( waterMask, 0.0, 1.0 );',
              '\t\troughnessFactor = mix( roughnessFactor, uOceanRoughness, earthWaterFactor );',
              '\t}',
            ].join('\n'),
            warnKey: 'earth:ocean-roughness',
          },
          {
            needle: '#include <lights_fragment_end>',
            marker: markerGlint,
            replacement: [
              '#include <lights_fragment_end>',
              markerGlint,
              '',
              '\t// Earth-only: cheap ocean glint (fallback when a proper water mask is unavailable).',
              '\t{',
              '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
              '\t\tvec3 viewDir = normalize( vViewPosition );',
              '\t\tfloat ndotl = max( dot( normal, sunDirView ), 0.0 );',
              '\t\tvec3 h = normalize( sunDirView + viewDir );',
              '\t\tfloat ndoth = max( dot( normal, h ), 0.0 );',
              '\t\tfloat glint = pow( ndoth, 420.0 ) * ndotl * earthWaterFactor * uOceanSpecIntensity;',
              '\t\treflectedLight.directSpecular += vec3( glint );',
              '\t}',
            ].join('\n'),
            warnKey: 'earth:ocean-glint',
          },
        ],
      })

      if (water.ok) {
        nextFrag = water.next
      }

      const shaderSources: ShaderSource = shader
      shaderSources.fragmentShader = nextFrag
    })
    onBeforeCompileRestores.push(restoreEarthSurface)

    // Atmosphere shell
    const atmosphereGeo = new THREE.SphereGeometry(1, 48, 24)
    atmosphereGeo.rotateX(Math.PI / 2)
    extraGeometriesToDispose.push(atmosphereGeo)

    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunDirWorld: { value: uSunDirWorld },
        uColor: { value: new THREE.Color(earth.atmosphereColor ?? '#79b8ff') },
        uIntensity: uAtmosphereIntensity,
        uRimPower: { value: earth.atmosphereRimPower ?? 2.2 },
        uSunBias: { value: earth.atmosphereSunBias ?? 0.65 },
      },
      vertexShader: [
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        '',
        'void main() {',
        '  vec4 worldPos = modelMatrix * vec4( position, 1.0 );',
        '  vWorldPos = worldPos.xyz;',
        '  vWorldNormal = normalize( mat3( modelMatrix ) * normal );',
        '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uSunDirWorld;',
        'uniform vec3 uColor;',
        'uniform float uIntensity;',
        'uniform float uRimPower;',
        'uniform float uSunBias;',
        '',
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        '',
        'void main() {',
        '  vec3 N = normalize( vWorldNormal );',
        '  vec3 V = normalize( cameraPosition - vWorldPos );',
        '  vec3 L = normalize( uSunDirWorld );',
        '',
        '  float rim = 1.0 - max( dot( N, V ), 0.0 );',
        '  rim = pow( rim, uRimPower );',
        '',
        '  float ndotl = dot( N, L );',
        '  // Bias the glow towards the sun-lit hemisphere so the night side stays dark.',
        '  float k = clamp( uSunBias, 0.0, 1.0 );',
        '  float start = mix( -0.15, 0.0, k );',
        '  float end = mix( 0.45, 0.2, k );',
        '  float dayFactor = smoothstep( start, end, ndotl );',
        '  float glow = rim * dayFactor;',
        '',
        '  float alpha = glow * uIntensity;',
        '  gl_FragColor = vec4( uColor, alpha );',
        '}',
      ].join('\n'),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.BackSide,
    })
    extraMaterialsToDispose.push(atmosphereMaterial)

    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMaterial)
    atmosphereMesh.scale.setScalar(earth.atmosphereRadiusRatio ?? 1.015)
    atmosphereMesh.renderOrder = 2
    mesh.add(atmosphereMesh)

    // Clouds shell
    const cloudsGeo = new THREE.SphereGeometry(1, 48, 24)
    cloudsGeo.rotateX(Math.PI / 2)
    extraGeometriesToDispose.push(cloudsGeo)
    const newCloudsMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: earth.cloudsOpacity ?? 0.85,
      alphaTest: earth.cloudsAlphaTest ?? 0.02,
      depthWrite: false,
      roughness: 1.0,
      metalness: 0.0,
      alphaMap: black1x1,
    })
    cloudsMaterial = newCloudsMaterial
    extraMaterialsToDispose.push(newCloudsMaterial)

    // Darken clouds on the night side as well (otherwise the global ambient light
    // makes clouds show up nearly as brightly at night as during day).
    const restoreEarthClouds = composeOnBeforeCompile(newCloudsMaterial, (shader) => {
      shader.uniforms.uSunDirWorld = { value: uSunDirWorld }
      shader.uniforms.uTwilight = uTwilight
      shader.uniforms.uCloudsNightMultiplier = uCloudsNightMultiplier

      const markerCommon = '// tspice:earth-clouds:uniforms'
      const markerNormal = '// tspice:earth-clouds:geometry-normal'
      const markerLights = '// tspice:earth-clouds:night-side'

      const res = safeShaderReplaceAll({
        shader,
        source: 'fragmentShader',
        warnOnce,
        warnKey: 'earth-clouds:patch',
        replacements: [
          {
            needle: '#include <common>',
            marker: markerCommon,
            replacement: [
              '#include <common>',
              markerCommon,
              'uniform vec3 uSunDirWorld;',
              'uniform float uTwilight;',
              'uniform float uCloudsNightMultiplier;',
            ].join('\n'),
            warnKey: 'earth-clouds:uniforms',
          },
          {
            needle: '#include <normal_fragment_begin>',
            marker: markerNormal,
            replacement: [
              '#include <normal_fragment_begin>',
              markerNormal,
              '\t// Stable geometric normal (view space) before any normal map perturbations.',
              '\tvec3 tspiceGeometryNormal = nonPerturbedNormal;',
            ].join('\n'),
            warnKey: 'earth-clouds:geometry-normal',
          },
          {
            needle: '#include <lights_fragment_begin>',
            marker: markerLights,
            replacement: [
              markerLights,
              '\t// Earth-only: suppress ambient-lit clouds on the night side.',
              '\t{',
              '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
              '\t\tfloat ndotl = dot( tspiceGeometryNormal, sunDirView );',
              '\t\tfloat dayFactor = smoothstep( 0.0, uTwilight, ndotl );',
              '\t\tdiffuseColor.rgb *= mix( uCloudsNightMultiplier, 1.0, dayFactor );',
              '\t}',
              '',
              '#include <lights_fragment_begin>',
            ].join('\n'),
            warnKey: 'earth-clouds:night-side',
          },
        ],
      })

      if (!res.ok) return

      const shaderSources: ShaderSource = shader
      shaderSources.fragmentShader = res.next
    })
    onBeforeCompileRestores.push(restoreEarthClouds)

    cloudsMesh = new THREE.Mesh(cloudsGeo, newCloudsMaterial)
    cloudsMesh.scale.setScalar(earth.cloudsRadiusRatio ?? 1.01)
    cloudsMesh.renderOrder = 1
    mesh.add(cloudsMesh)

    cloudsDriftRadPerSec = earth.cloudsDriftRadPerSec ?? 0.0

    // Load optional textures.
    const extras: Promise<void>[] = []

    if (earth.nightLightsTextureUrl) {
      extras.push(
        loadTextureCached(earth.nightLightsTextureUrl, { colorSpace: THREE.SRGBColorSpace })
          .then(({ texture: tex, release }) => {
            let installed = false
            try {
              if (disposed) return

              tex.wrapS = THREE.RepeatWrapping
              tex.wrapT = THREE.RepeatWrapping
              tex.needsUpdate = true

              material.emissive.set('#ffffff')
              material.emissiveMap = tex
              material.needsUpdate = true

              extraTextureReleases.push(release)
              installed = true
            } finally {
              if (!installed) release()
            }
          })
          .catch((err) => {
            if (isTextureCacheClearedError(err)) return
            console.warn('Failed to load Earth night lights texture', earth.nightLightsTextureUrl, err)
          }),
      )
    }

    if (earth.cloudsTextureUrl) {
      extras.push(
        loadTextureCached(earth.cloudsTextureUrl, { colorSpace: THREE.SRGBColorSpace })
          .then(({ texture: tex, release }) => {
            let installed = false
            try {
              if (disposed) return

              tex.wrapS = THREE.RepeatWrapping
              tex.wrapT = THREE.RepeatWrapping
              tex.needsUpdate = true

              newCloudsMaterial.alphaMap = tex
              newCloudsMaterial.needsUpdate = true

              extraTextureReleases.push(release)
              installed = true
            } finally {
              if (!installed) release()
            }
          })
          .catch((err) => {
            if (isTextureCacheClearedError(err)) return
            console.warn('Failed to load Earth clouds texture', earth.cloudsTextureUrl, err)
          }),
      )
    }

    if (earth.waterMaskTextureUrl) {
      extras.push(
        loadTextureCached(earth.waterMaskTextureUrl, { colorSpace: THREE.NoColorSpace })
          .then(({ texture: tex, release }) => {
            let installed = false
            try {
              if (disposed) return

              tex.wrapS = THREE.RepeatWrapping
              tex.wrapT = THREE.RepeatWrapping
              tex.needsUpdate = true

              waterMaskUniform.value = tex
              useWaterMaskUniform.value = 1.0

              extraTextureReleases.push(release)
              installed = true
            } finally {
              if (!installed) release()
            }
          })
          .catch((err) => {
            if (isTextureCacheClearedError(err)) return
            console.warn('Failed to load Earth water mask texture', earth.waterMaskTextureUrl, err)
          }),
      )
    }

    readyExtras.push(...extras)

    update = ({ sunDirWorld, etSec, earthTuning }) => {
      uSunDirWorld.copy(sunDirWorld).normalize()

      if (earthTuning) {
        uNightAlbedo.value = earthTuning.nightAlbedo
        uTwilight.value = earthTuning.twilight
        uNightLightsIntensity.value = earthTuning.nightLightsIntensity
        uAtmosphereIntensity.value = earthTuning.atmosphereIntensity
        uCloudsNightMultiplier.value = earthTuning.cloudsNightMultiplier
      }

      if (cloudsMesh && cloudsDriftRadPerSec !== 0) {
        const phase = (etSec * cloudsDriftRadPerSec) % (Math.PI * 2)
        cloudsMesh.rotation.z = phase
      }
    }
  }

  const ready = Promise.all(readyExtras).then(() => undefined)

  return {
    mesh,
    dispose: () => {
      disposed = true

      for (const restore of onBeforeCompileRestores) restore()
      onBeforeCompileRestores.length = 0

      // Detach texture references before releasing/disposing them.
      disposeMap(material)

      material.emissiveMap = null
      material.needsUpdate = true

      if (cloudsMaterial) {
        cloudsMaterial.alphaMap = null
        cloudsMaterial.needsUpdate = true
      }

      waterMaskUniform.value = black1x1
      useWaterMaskUniform.value = 0.0

      ringResult?.dispose()

      for (const release of extraTextureReleases) release()

      geometry.dispose()
      material.dispose()

      // Dispose materials/geometries before placeholder textures (e.g. black1x1)
      // so we don't leave a disposed texture referenced by a still-live material.
      for (const mat of extraMaterialsToDispose) mat.dispose()
      for (const geo of extraGeometriesToDispose) geo.dispose()
      for (const tex of extraTexturesToDispose) tex.dispose()
    },
    ready: ready.then(() => {
      // If the texture loaded after we created the material, apply it now.
      if (disposed) return
      if (!map) return

      applyMapAndBump(material, map, bumpScale)

      // Note: `material.color` multiplies `material.map`.
      // Only override the default multiplier if `textureColor` is explicitly set.
      material.color.set(textureColor ?? surface.color)
      material.needsUpdate = true
    }),
    update,
  }
}
