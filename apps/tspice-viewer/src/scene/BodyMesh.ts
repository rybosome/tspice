import * as THREE from 'three'

import { resolveVitePublicUrl } from './resolveVitePublicUrl.js'
import type { EarthAppearanceStyle } from './SceneModel.js'

export type BodyTextureKind = 'earth' | 'moon' | 'sun'

export type CreateBodyMeshOptions = {
  /** Optional stable ID (e.g. `"EARTH"`) for body-specific rendering. */
  bodyId?: string

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

  /** Optional higher-fidelity Earth appearance layers (Earth-only). */
  earthAppearance?: EarthAppearanceStyle
}

export type BodyMeshUpdate = (args: { sunDirWorld: THREE.Vector3; etSec: number }) => void

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

  let map: THREE.Texture | undefined = options.textureKind ? makeProceduralBodyTexture(options.textureKind) : undefined

  let ready: Promise<void> = options.textureUrl
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

  // Earth-only higher-fidelity appearance layers (night lights, clouds, atmosphere, ocean glint).
  // This is kept opt-in via `style.earthAppearance` so other bodies remain unchanged.
  const earth = options.earthAppearance
  const isEarth = options.bodyId === 'EARTH'

  const extraTexturesToDispose: THREE.Texture[] = []
  const extraMaterialsToDispose: THREE.Material[] = []
  const extraGeometriesToDispose: THREE.BufferGeometry[] = []

  // Shared sun direction uniform for Earth shaders (mutated per-frame).
  const uSunDirWorld = new THREE.Vector3(1, 1, 1).normalize()

  // Used when optional maps are missing (prevents shader warnings and avoids showing a full white shell).
  const black1x1 = make1x1TextureRGBA([0, 0, 0, 255])
  extraTexturesToDispose.push(black1x1)

  let update: BodyMeshUpdate | undefined

  let cloudsMesh: THREE.Mesh | undefined
  let cloudsDriftRadPerSec = 0

  const waterMaskUniform = { value: black1x1 as THREE.Texture }
  const useWaterMaskUniform = { value: 0.0 }

  if (isEarth && earth) {
    // Night lights + ocean glint (surface shader patch)
    material.emissive.set('#000000')
    material.emissiveIntensity = 1.0

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirWorld = { value: uSunDirWorld }
      shader.uniforms.uTwilight = { value: earth.nightLightsTwilight ?? 0.12 }
      shader.uniforms.uNightLightsIntensity = { value: earth.nightLightsIntensity ?? 1.25 }
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
          'uniform float uTwilight;',
          'uniform float uNightLightsIntensity;',
          'uniform float uOceanSpecIntensity;',
          'uniform float uOceanRoughness;',
          'uniform sampler2D uWaterMaskMap;',
          'uniform float uUseWaterMask;',
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
        uIntensity: { value: earth.atmosphereIntensity ?? 0.55 },
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
        '  float sunBias = smoothstep( -0.15, 0.45, ndotl );',
        '  float glow = rim * mix( 1.0, sunBias, clamp( uSunBias, 0.0, 1.0 ) );',
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

    const cloudsMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: earth.cloudsOpacity ?? 0.85,
      alphaTest: earth.cloudsAlphaTest ?? 0.02,
      depthWrite: false,
      roughness: 1.0,
      metalness: 0.0,
      alphaMap: black1x1,
    })
    extraMaterialsToDispose.push(cloudsMaterial)

    cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMaterial)
    cloudsMesh.scale.setScalar(earth.cloudsRadiusRatio ?? 1.01)
    cloudsMesh.renderOrder = 1
    mesh.add(cloudsMesh)

    cloudsDriftRadPerSec = earth.cloudsDriftRadPerSec ?? 0.0

    // Load optional textures.
    const loader = new THREE.TextureLoader()
    const extras: Promise<void>[] = []

    if (earth.nightLightsTextureUrl) {
      extras.push(
        loader
          .loadAsync(resolveVitePublicUrl(earth.nightLightsTextureUrl))
          .then((tex) => {
            if (disposed) {
              tex.dispose()
              return
            }
            tex.colorSpace = THREE.SRGBColorSpace
            tex.wrapS = THREE.RepeatWrapping
            tex.wrapT = THREE.RepeatWrapping
            tex.needsUpdate = true
            extraTexturesToDispose.push(tex)

            material.emissive.set('#ffffff')
            material.emissiveMap = tex
            material.needsUpdate = true
          })
          .catch((err) => {
            console.warn('Failed to load Earth night lights texture', earth.nightLightsTextureUrl, err)
          }),
      )
    }

    if (earth.cloudsTextureUrl && cloudsMaterial) {
      extras.push(
        loader
          .loadAsync(resolveVitePublicUrl(earth.cloudsTextureUrl))
          .then((tex) => {
            if (disposed) {
              tex.dispose()
              return
            }
            // Used as alpha map; keep consistent with the source JPG (sRGB).
            // (Shader uses the sampled channel directly; GPU sRGB decode is the only conversion.)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.wrapS = THREE.RepeatWrapping
            tex.wrapT = THREE.RepeatWrapping
            tex.needsUpdate = true
            extraTexturesToDispose.push(tex)

            cloudsMaterial.alphaMap = tex
            cloudsMaterial.needsUpdate = true
          })
          .catch((err) => {
            console.warn('Failed to load Earth clouds texture', earth.cloudsTextureUrl, err)
          }),
      )
    }

    if (earth.waterMaskTextureUrl) {
      extras.push(
        loader
          .loadAsync(resolveVitePublicUrl(earth.waterMaskTextureUrl))
          .then((tex) => {
            if (disposed) {
              tex.dispose()
              return
            }
            tex.colorSpace = THREE.NoColorSpace
            tex.wrapS = THREE.RepeatWrapping
            tex.wrapT = THREE.RepeatWrapping
            tex.needsUpdate = true
            extraTexturesToDispose.push(tex)

            waterMaskUniform.value = tex
            useWaterMaskUniform.value = 1.0
          })
          .catch((err) => {
            console.warn('Failed to load Earth water mask texture', earth.waterMaskTextureUrl, err)
          }),
      )
    }

    // Extend `ready` with extra Earth assets.
    ready = Promise.all([ready, ...extras]).then(() => undefined)

    update = ({ sunDirWorld, etSec }) => {
      uSunDirWorld.copy(sunDirWorld).normalize()

      if (cloudsMesh && cloudsDriftRadPerSec !== 0) {
        const phase = (etSec * cloudsDriftRadPerSec) % (Math.PI * 2)
        cloudsMesh.rotation.z = phase
      }
    }
  }

  return {
    mesh,
    dispose: () => {
      disposed = true
      geometry.dispose()
      material.dispose()
      map?.dispose()

      for (const tex of extraTexturesToDispose) tex.dispose()
      for (const mat of extraMaterialsToDispose) mat.dispose()
      for (const geo of extraGeometriesToDispose) geo.dispose()
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
    update,
  }
}
