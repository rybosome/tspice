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

function composeOnBeforeCompile(material: THREE.Material, patch: OnBeforeCompile) {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer)
    patch(shader, renderer)
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

type ShaderSource = Pick<BeforeCompileShader, ShaderSourceKey>

function getShaderSource(shader: ShaderSource, source: ShaderSourceKey): string | undefined {
  const value = shader[source]
  return typeof value === 'string' ? value : undefined
}

function safeShaderReplace(args: {
  shader: BeforeCompileShader
  source: ShaderSourceKey
  needle: string
  replacement: string
  marker: string
  warnOnce: (key: string, ...args: unknown[]) => void
  warnKey: string
}): boolean {
  const { shader, source, needle, replacement, marker, warnOnce, warnKey } = args

  const shaderSources: ShaderSource = shader

  const src = getShaderSource(shaderSources, source)
  if (src == null) {
    warnOnce(warnKey, '[BodyMesh] shader injection skipped (missing shader source)', { source, marker })
    return false
  }
  if (src.includes(marker)) return true

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
    return false
  }

  if (occurrences > 1) {
    warnOnce(warnKey, '[BodyMesh] shader injection skipped (needle not unique)', {
      source,
      needle,
      occurrences,
      marker,
    })
    return false
  }

  const next = src.replace(needle, replacement)
  if (next === src || !next.includes(marker)) {
    warnOnce(warnKey, '[BodyMesh] shader injection skipped (replace failed)', { source, needle, marker })
    return false
  }

  // `onBeforeCompile` expects us to mutate the shader in-place.
  shaderSources[source] = next
  return true
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

  // Collect async assets so `ready` consistently represents "all appearance assets are ready".
  const readyExtras: Promise<void>[] = []

  const surface = options.appearance.surface
  const surfaceTexture = surface.texture
  const textureKind = surfaceTexture?.kind
  const textureUrl = surfaceTexture?.url
  const textureColor = surfaceTexture?.color

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
    roughness: textureKind === 'sun' ? 0.2 : 0.9,
    metalness: 0.0,
    map,
    emissive: textureKind === 'sun' ? new THREE.Color('#ffcc55') : new THREE.Color('#000000'),
    emissiveIntensity: textureKind === 'sun' ? 0.8 : 0.0,
  })

  // We patch `material.onBeforeCompile` to inject shader modifications.
  // Capture the original value and whether it was an own-prop so `dispose()` can
  // correctly restore or clear it.
  const onBeforeCompileWasOwn = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')
  const initialOnBeforeCompile = material.onBeforeCompile

  function disposeMap(mat: THREE.MeshStandardMaterial) {
    const release = mapRelease
    const tex = map

    // Clear references first so disposal is idempotent and re-entrancy safe.
    map = undefined
    mapRelease = undefined

    // Ensure the material no longer references the texture.
    mat.map = null
    mat.needsUpdate = true

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
  const isEarth = options.bodyId === 'EARTH'
  const isMoon = options.bodyId === 'MOON'

  const extraTexturesToDispose: THREE.Texture[] = []
  const extraTextureReleases: Array<() => void> = []
  const extraMaterialsToDispose: THREE.Material[] = []
  const extraGeometriesToDispose: THREE.BufferGeometry[] = []

  const warnOnce = createWarnOnce()

  // Moon-only bump uses a clone of `map` (same image data; different colorSpace).
  let moonBumpTexture: THREE.Texture | undefined

  // Shared sun direction uniform for Earth shaders (mutated per-frame).
  const uSunDirWorld = new THREE.Vector3(1, 1, 1).normalize()

  // Used when optional maps are missing (prevents shader warnings and avoids showing a full white shell).
  const black1x1 = make1x1TextureRGBA([0, 0, 0, 255])
  extraTexturesToDispose.push(black1x1)

  let update: BodyMeshUpdate | undefined

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

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirWorld = { value: uSunDirWorld }
      shader.uniforms.uNightAlbedo = uNightAlbedo
      shader.uniforms.uTwilight = uTwilight
      shader.uniforms.uNightLightsIntensity = uNightLightsIntensity
      shader.uniforms.uOceanSpecIntensity = { value: earth.oceanSpecularIntensity ?? 0.35 }
      shader.uniforms.uOceanRoughness = { value: earth.oceanRoughness ?? 0.06 }
      shader.uniforms.uWaterMaskMap = waterMaskUniform
      shader.uniforms.uUseWaterMask = useWaterMaskUniform

      // Insert uniform declarations.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        [
          '#include <common>',
          'uniform vec3 uSunDirWorld;',
          'uniform float uNightAlbedo;',
          'uniform float uTwilight;',
          'uniform float uNightLightsIntensity;',
          'uniform float uOceanSpecIntensity;',
          'uniform float uOceanRoughness;',
          'uniform sampler2D uWaterMaskMap;',
          'uniform float uUseWaterMask;',
        ].join('\n'),
      )

      // Darken the night side so the scene ambient light doesn't wash out Earth.
      // (Emissive city lights remain visible via the emissive map.)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_begin>',
        [
          '\t// Earth-only: suppress ambient-lit albedo on the night side.',
          '\t{',
          '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
          '\t\tfloat ndotl = dot( normal, sunDirView );',
          '\t\tfloat dayFactor = smoothstep( 0.0, uTwilight, ndotl );',
          '',
          '\t\t// Keep a tiny floor so Earth is not totally invisible at night.',
          '\t\tfloat nightAlbedo = uNightAlbedo;',
          '\t\tdiffuseColor.rgb *= mix( nightAlbedo, 1.0, dayFactor );',
          '\t}',
          '',
          '#include <lights_fragment_begin>',
        ].join('\n'),
      )

      // Keep an Earth-local water factor around for later glint.
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        ['vec3 totalEmissiveRadiance = emissive;', 'float earthWaterFactor = 0.0;'].join('\n'),
      )

      // Ocean roughness modulation (mask or heuristic).
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        [
          '#include <roughnessmap_fragment>',
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
      )

      // Night lights gating (terminator mask driven by N·L).
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        [
          '#include <emissivemap_fragment>',
          '',
          '\t// Earth-only: gate night lights to the night side (soft terminator).',
          '\t{',
          '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
          '\t\tfloat ndotl = dot( normal, sunDirView );',
          '\t\tfloat nightMask = 1.0 - smoothstep( -uTwilight, uTwilight, ndotl );',
          '\t\ttotalEmissiveRadiance *= nightMask * uNightLightsIntensity;',
          '\t}',
        ].join('\n'),
      )

      // Cheap ocean glint (adds a sharp highlight on water pixels).
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        [
          '#include <lights_fragment_end>',
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
      )
    }

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
    newCloudsMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirWorld = { value: uSunDirWorld }
      shader.uniforms.uTwilight = uTwilight
      shader.uniforms.uCloudsNightMultiplier = uCloudsNightMultiplier

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        [
          '#include <common>',
          'uniform vec3 uSunDirWorld;',
          'uniform float uTwilight;',
          'uniform float uCloudsNightMultiplier;',
        ].join('\n'),
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_begin>',
        [
          '\t// Earth-only: suppress ambient-lit clouds on the night side.',
          '\t{',
          '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
          '\t\tfloat ndotl = dot( normal, sunDirView );',
          '\t\tfloat dayFactor = smoothstep( 0.0, uTwilight, ndotl );',
          '\t\tdiffuseColor.rgb *= mix( uCloudsNightMultiplier, 1.0, dayFactor );',
          '\t}',
          '',
          '#include <lights_fragment_begin>',
        ].join('\n'),
      )
    }

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

  if (isMoon) {
    // Moon readability tweaks:
    // - Add subtle bump relief by re-using the albedo map as a bump map.
    // - Darken the night side so ambient doesn't wash out the unlit hemisphere.

    material.roughness = 0.95

    const uNightAlbedo = { value: 0.01 }
    const uTwilight = { value: 0.05 }

    composeOnBeforeCompile(material, (shader) => {
      shader.uniforms.uSunDirWorld = { value: uSunDirWorld }
      shader.uniforms.uNightAlbedo = uNightAlbedo
      shader.uniforms.uTwilight = uTwilight

      const markerCommon = '// [BodyMesh] moon: common uniforms'
      safeShaderReplace({
        shader,
        source: 'fragmentShader',
        needle: '#include <common>',
        replacement: [
          '#include <common>',
          markerCommon,
          'uniform vec3 uSunDirWorld;',
          'uniform float uNightAlbedo;',
          'uniform float uTwilight;',
        ].join('\n'),
        marker: markerCommon,
        warnOnce,
        warnKey: 'moon.common',
      })

      const markerLights = '// [BodyMesh] moon: night-side ambient clamp'
      safeShaderReplace({
        shader,
        source: 'fragmentShader',
        needle: '#include <lights_fragment_begin>',
        replacement: [
          markerLights,
          '\t// Moon-only: suppress ambient-lit albedo on the night side.',
          '\t{',
          '\t\tvec3 sunDirView = normalize( ( viewMatrix * vec4( uSunDirWorld, 0.0 ) ).xyz );',
          '\t\tfloat ndotl = dot( normal, sunDirView );',
          '\t\tfloat dayFactor = smoothstep( 0.0, uTwilight, ndotl );',
          '\t\tdiffuseColor.rgb *= mix( uNightAlbedo, 1.0, dayFactor );',
          '\t}',
          '',
          '#include <lights_fragment_begin>',
        ].join('\n'),
        marker: markerLights,
        warnOnce,
        warnKey: 'moon.lights',
      })
    })

    const prevUpdate = update
    update = (args) => {
      prevUpdate?.(args)
      uSunDirWorld.copy(args.sunDirWorld).normalize()
    }
  }

  const ready = Promise.all(readyExtras).then(() => undefined)

  return {
    mesh,
    dispose: () => {
      disposed = true

      // Detach texture references before releasing/disposing them.
      disposeMap(material)

      material.emissiveMap = null
      material.bumpMap = null

      if (onBeforeCompileWasOwn) {
        material.onBeforeCompile = initialOnBeforeCompile
      } else {
        // If we introduced `onBeforeCompile` as an own-prop during patching,
        // clean it up so the material falls back to the prototype behavior.
        // (Avoid leaving a no-op handler installed.)
        delete (material as THREE.Material & { onBeforeCompile?: unknown }).onBeforeCompile
      }
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

      material.map = map

      if (isMoon) {
        if (!moonBumpTexture) {
          const bump = map.clone()
          bump.colorSpace = THREE.NoColorSpace
          bump.needsUpdate = true
          moonBumpTexture = bump
          extraTexturesToDispose.push(bump)
        }

        material.bumpMap = moonBumpTexture
        material.bumpScale = 0.018
      }

      // Note: `material.color` multiplies `material.map`.
      // Only override the default multiplier if `textureColor` is explicitly set.
      material.color.set(textureColor ?? surface.color)
      material.needsUpdate = true
    }),
    update,
  }
}
