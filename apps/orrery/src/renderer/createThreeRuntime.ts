import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SavePass } from 'three/examples/jsm/postprocessing/SavePass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SUN_BLOOM_LAYER } from '../renderLayers.js'
import { CameraController, type CameraControllerState } from '../controls/CameraController.js'
import { createSelectionOverlay, type SelectionOverlay } from '../scene/SelectionOverlay.js'
import { createSkydome, type CreateSkydomeOptions } from '../scene/Skydome.js'
import { createStarfield, type StarfieldHandle } from '../scene/Starfield.js'
import type { BodyRef } from '../spice/SpiceClient.js'
import type { RenderHudStats } from './RenderHud.js'

export type ThreeRuntime = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controller: CameraController

  selectionOverlay?: SelectionOverlay

  renderOnce: (timeMs?: number) => void
  invalidate: () => void
  resize: () => void

  setAfterRender: (fn: ((args: { nowMs: number }) => void) | null) => void
  setOnDrawingBufferResize: (fn: ((bufferSize: { width: number; height: number }) => void) | null) => void

  updateSky: (opts: { animatedSky: boolean; twinkleEnabled: boolean; isE2e: boolean }) => void
  updateSunPostprocess: (next: SunPostprocessUpdate) => void
  dispose: () => void
}

export type SunPostprocessMode = 'off' | 'wholeFrame' | 'sunIsolated'

export type SunToneMap = 'none' | 'filmic' | 'acesLike'

export type SunPostprocessConfig = {
  mode: SunPostprocessMode
  exposure: number
  toneMap: SunToneMap
  bloom: {
    threshold: number
    strength: number
    radius: number
    resolutionScale: number
  }
}

export type SunPostprocessUpdate = {
  exposure?: number
  toneMap?: SunToneMap
  bloom?: Partial<SunPostprocessConfig['bloom']>
}

export function createThreeRuntime(args: {
  canvas: HTMLCanvasElement
  container: HTMLDivElement
  isE2e: boolean
  enableLogDepth: boolean

  starSeed: number
  animatedSky: boolean
  twinkleEnabled: boolean

  sunPostprocess: SunPostprocessConfig

  /** Keep invalidate behavior in sync with the sky animation RAF loop. */
  skyAnimationActiveRef: { current: boolean }

  initialFocusBody: BodyRef
  initialCameraFovDeg: number
  getHomePresetState: (focusBody: BodyRef) => CameraControllerState | null

  /**
   * HUD accessors are read during render, so expose them via a getter to avoid
   * accidentally capturing stale values in closures.
   */
  hud?: () => {
    /** Read latest HUD enabled state. */
    enabled: () => boolean

    /** Used for HUD display only. */
    getFocusBodyLabel: () => string

    setStats: (next: RenderHudStats) => void
  }
}): ThreeRuntime {
  const {
    canvas,
    container,
    isE2e,
    enableLogDepth,
    starSeed,
    skyAnimationActiveRef,
    initialFocusBody,
    initialCameraFovDeg,
    getHomePresetState,
  } = args

  let disposed = false

  let scheduledFrame: number | null = null
  let scheduledResizeFrame: number | null = null
  let scheduledPrimeResizeFrame: number | null = null

  let lastResizeKey: string | null = null

  const drawingBufferSize = new THREE.Vector2()

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isE2e,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: enableLogDepth,
  })

  // We render the background first, then draw the postprocessed foreground
  // over it. Disable implicit clears so nothing can accidentally wipe the
  // background when the composer renders to screen.
  renderer.autoClear = false

  // Keep e2e snapshots stable by not depending on deviceScaleFactor.
  renderer.setPixelRatio(isE2e ? 1 : Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping

  const CLEAR_COLOR = new THREE.Color('#0f131a')

  // Foreground scene: planets, Sun, orbits, interactions, etc.
  const scene = new THREE.Scene()
  // Keep background fully owned by `bgScene`.
  scene.background = null

  // Background scene: starfield + skydome (must be outside the post chain).
  const bgScene = new THREE.Scene()
  bgScene.background = null

  // NOTE: With `kmToWorld = 1e-6`, outer planets can be several thousand
  // world units away. Keep the far plane large enough so we can render the
  // full default scene (through Neptune).
  const DEFAULT_NEAR = 0.01
  // Avoid ridiculous near/far ratios that can destroy depth precision.
  // This only matters when users zoom extremely close.
  const MIN_NEAR = 1e-5
  // Keep the near plane well in front of the camera, but small enough that
  // small-body auto-focus (e.g. the Moon) doesn't clip.
  const NEAR_RADIUS_FRACTION = 0.1 // radius / 10

  const camera = new THREE.PerspectiveCamera(initialCameraFovDeg, 1, DEFAULT_NEAR, 10_000)

  // Z-up to match SPICE/IAU north (+Z) and keep orbit controls consistent.
  camera.up.set(0, 0, 1)
  camera.position.set(2.2, 1.4, 2.2)
  camera.lookAt(0, 0, 0)

  // If we have a home preset for the initial focus body, start there.
  const initialHomePreset = getHomePresetState(initialFocusBody)
  const controller = initialHomePreset ? new CameraController(initialHomePreset) : CameraController.fromCamera(camera)

  if (initialHomePreset) {
    controller.applyToCamera(camera)
  }

  const syncCameraNear = () => {
    // When zooming/focusing on very small bodies, the orbit radius can dip
    // below the default near plane. If `near > (cameraDistance - bodyRadius)`
    // the body will clip and it feels like we "zoomed inside".
    const desiredNear = Math.min(DEFAULT_NEAR, Math.max(MIN_NEAR, controller.radius * NEAR_RADIUS_FRACTION))

    // Only touch the projection matrix when the effective near plane changes.
    if (Math.abs(camera.near - desiredNear) > 1e-9) {
      camera.near = desiredNear
      camera.updateProjectionMatrix()
    }
  }

  let afterRender: ((args: { nowMs: number }) => void) | null = null
  let onDrawingBufferResize: ((bufferSize: { width: number; height: number }) => void) | null = null

  // Sky / background elements (owned by this runtime)
  let starfield: StarfieldHandle | null = null
  let skydome: ReturnType<typeof createSkydome> | null = null
  let skyState: { animatedSky: boolean; twinkleEnabled: boolean; isE2e: boolean } | null = null

  // Selection overlay (interactive-only)
  const selectionOverlay =
    !isE2e
      ? createSelectionOverlay({
          // ResizeObserver work is throttled to RAF; prime a best-effort
          // initial resolution so the overlay's first paint has correct line
          // widths.
          initialResolution: (() => {
            const width = container.clientWidth
            const height = container.clientHeight
            if (width <= 0 || height <= 0) return undefined

            const pixelRatio = Math.min(window.devicePixelRatio, 2)
            return {
              widthPx: Math.max(1, Math.floor(width * pixelRatio)),
              heightPx: Math.max(1, Math.floor(height * pixelRatio)),
            }
          })(),
        })
      : undefined
  if (selectionOverlay) scene.add(selectionOverlay.object)

  const ensureSky = (opts: { animatedSky: boolean; twinkleEnabled: boolean; isE2e: boolean }) => {
    if (
      skyState &&
      skyState.animatedSky === opts.animatedSky &&
      skyState.twinkleEnabled === opts.twinkleEnabled &&
      skyState.isE2e === opts.isE2e
    ) {
      return
    }

    // Keep e2e snapshots stable: no starfield / skydome at all.
    const shouldHaveStarfield = !opts.isE2e
    const shouldHaveSkydome = opts.animatedSky && !opts.isE2e

    // Starfield is present in interactive mode; only recreate when twinkle toggles.
    if (!shouldHaveStarfield) {
      if (starfield) {
        bgScene.remove(starfield.object)
        starfield.dispose()
        starfield = null
      }
    } else if (!starfield || !skyState || skyState.twinkleEnabled !== opts.twinkleEnabled) {
      if (starfield) {
        bgScene.remove(starfield.object)
        starfield.dispose()
      }

      starfield = createStarfield({ seed: starSeed, twinkle: opts.twinkleEnabled })
      bgScene.add(starfield.object)
      starfield.syncToCamera(camera)
    }

    if (skydome && !shouldHaveSkydome) {
      bgScene.remove(skydome.object)
      skydome.dispose()
      skydome = null
    } else if (!skydome && shouldHaveSkydome) {
      const skydomeOpts: CreateSkydomeOptions = { seed: starSeed }
      skydome = createSkydome(skydomeOpts)
      bgScene.add(skydome.object)
      skydome.syncToCamera(camera)
    }

    skyState = opts
  }

  ensureSky({ animatedSky: args.animatedSky, twinkleEnabled: args.twinkleEnabled, isE2e })

  // Copy so TEMP debug controls can mutate without changing caller refs.
  const sunPostprocess: SunPostprocessConfig = {
    ...args.sunPostprocess,
    bloom: { ...args.sunPostprocess.bloom },
  }

  const applyTonemapConfig = (pass: ShaderPass, cfg: { exposure: number; toneMap: SunToneMap }) => {
    const u = pass.material.uniforms as unknown as {
      exposure: { value: number }
      toneMapMode: { value: number }
    }
    u.exposure.value = cfg.exposure
    // Map string mode to numeric for GLSL switch (stable across minifiers).
    u.toneMapMode.value = cfg.toneMap === 'none' ? 0 : cfg.toneMap === 'filmic' ? 1 : 2
  }

  const createTonemapPass = (cfg: { exposure: number; toneMap: SunToneMap }) => {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        exposure: { value: cfg.exposure },
        toneMapMode: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float exposure;
        uniform int toneMapMode;
        varying vec2 vUv;

        vec3 filmicToneMap(vec3 x) {
          x = max(vec3(0.0), x - 0.004);
          return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
        }

        vec3 acesLikeToneMap(vec3 x) {
          // Narkowicz 2015, "ACES Filmic Tone Mapping Curve" (approx).
          const float a = 2.51;
          const float b = 0.03;
          const float c = 2.43;
          const float d = 0.59;
          const float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;
          color *= exposure;

          if (toneMapMode == 1) {
            color = filmicToneMap(color);
          } else if (toneMapMode == 2) {
            color = acesLikeToneMap(color);
          }

          gl_FragColor = vec4(color, texel.a);
        }
      `,
    }

    const pass = new ShaderPass(shader)
    applyTonemapConfig(pass, cfg)
    return pass
  }

  const createBloomPass = (cfg: SunPostprocessConfig['bloom']) => {
    const pass = new UnrealBloomPass(new THREE.Vector2(1, 1), cfg.strength, cfg.radius, cfg.threshold)
    pass.threshold = cfg.threshold
    pass.strength = cfg.strength
    pass.radius = cfg.radius
    return pass
  }

  const createMixBloomPass = (bloomTexture: THREE.Texture) => {
    // NOTE: `ShaderPass` will clone uniforms when given a "shader" object.
    // Render-target textures (e.g. `WebGLRenderTarget.texture`) cannot be
    // cloned via `UniformsUtils.clone()`, so construct a `ShaderMaterial`
    // directly and pass it to `ShaderPass` to keep uniforms intact.
    const material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        bloomTexture: { value: bloomTexture },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;

        void main() {
          vec4 baseTex = texture2D(tDiffuse, vUv);
          vec3 base = baseTex.rgb;
          vec3 bloom = texture2D(bloomTexture, vUv).rgb;
          gl_FragColor = vec4(base + bloom, baseTex.a);
        }
      `,
    })

    return new ShaderPass(material)
  }

  const createRestoreAlphaPass = (alphaTexture: THREE.Texture) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        alphaTexture: { value: alphaTexture },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D alphaTexture;
        varying vec2 vUv;

        void main() {
          vec4 col = texture2D(tDiffuse, vUv);
          float a = texture2D(alphaTexture, vUv).a;
          gl_FragColor = vec4(col.rgb, a);
        }
      `,
    })

    return new ShaderPass(material)
  }

  const createBloomOverlayPass = (args: {
    bloomTexture: THREE.Texture
    alphaTexture: THREE.Texture
    exposure: number
    toneMap: SunToneMap
  }) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        // `ShaderPass` will set this if present. This pass doesn't use it, but
        // include it as a no-op to avoid any surprises.
        tDiffuse: { value: null },
        bloomTexture: { value: args.bloomTexture },
        alphaTexture: { value: args.alphaTexture },
        exposure: { value: args.exposure },
        toneMapMode: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D bloomTexture;
        uniform sampler2D alphaTexture;
        uniform float exposure;
        uniform int toneMapMode;
        varying vec2 vUv;

        vec3 filmicToneMap(vec3 x) {
          x = max(vec3(0.0), x - 0.004);
          return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
        }

        vec3 acesLikeToneMap(vec3 x) {
          const float a = 2.51;
          const float b = 0.03;
          const float c = 2.43;
          const float d = 0.59;
          const float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          // Only apply bloom where no foreground coverage exists.
          // (The base post chain already includes bloom where objects render.)
          float fgA = texture2D(alphaTexture, vUv).a;
          float w = 1.0 - fgA;

          vec3 color = texture2D(bloomTexture, vUv).rgb;
          color *= exposure;

          if (toneMapMode == 1) {
            color = filmicToneMap(color);
          } else if (toneMapMode == 2) {
            color = acesLikeToneMap(color);
          }

          gl_FragColor = vec4(color * w, 1.0);
        }
      `,
    })

    const pass = new ShaderPass(material)
    // Reuse the same string->int mapping as the main tonemap pass.
    const u = pass.material.uniforms as unknown as { toneMapMode: { value: number } }
    u.toneMapMode.value = args.toneMap === 'none' ? 0 : args.toneMap === 'filmic' ? 1 : 2
    return pass
  }

  const getBloomOnlyTexture = (bloomPass: UnrealBloomPass): THREE.Texture | null => {
    // three@0.160's `UnrealBloomPass` renders the bloom-only composite into
    // `renderTargetsHorizontal[0]`, then *additively blends* that over the input
    // buffer. For selective bloom we want the bloom-only texture (otherwise we
    // double-add the Sun/background when compositing).
    const unsafe = bloomPass as unknown as { renderTargetsHorizontal?: Array<{ texture: THREE.Texture }> }
    return unsafe.renderTargetsHorizontal?.[0]?.texture ?? null
  }

  type PostprocessRuntime =
    | { mode: 'off' }
    | {
        mode: 'wholeFrame'
        bloomComposer: EffectComposer
        bloomPass: UnrealBloomPass
        finalComposer: EffectComposer
        alphaSavePass: SavePass
        bloomOverlayComposer: EffectComposer
        bloomOverlayPass: ShaderPass
        outputPass: OutputPass
        bloomOverlayOutputPass: OutputPass
      }
    | {
        mode: 'sunIsolated'
        bloomComposer: EffectComposer
        bloomPass: UnrealBloomPass
        finalComposer: EffectComposer
        alphaSavePass: SavePass
        bloomOverlayComposer: EffectComposer
        bloomOverlayPass: ShaderPass
        outputPass: OutputPass
        bloomOverlayOutputPass: OutputPass
      }

  let tonemapPassRef: ShaderPass | null = null

  const postprocessRuntime: PostprocessRuntime = (() => {
    if (sunPostprocess.mode === 'off') return { mode: 'off' }

    if (sunPostprocess.mode === 'wholeFrame') {
      const bloomComposer = new EffectComposer(renderer)
      bloomComposer.renderToScreen = false
      const bloomRenderPass = new RenderPass(scene, camera, null, new THREE.Color(0x000000), 0)
      const bloomPass = createBloomPass(sunPostprocess.bloom)

      bloomComposer.addPass(bloomRenderPass)
      bloomComposer.addPass(bloomPass)

      const finalComposer = new EffectComposer(renderer)
      const finalRenderPass = new RenderPass(scene, camera, null, new THREE.Color(0x000000), 0)
      const alphaSavePass = new SavePass()
      const bloomTexture = getBloomOnlyTexture(bloomPass) ?? bloomComposer.readBuffer.texture
      const mixPass = createMixBloomPass(bloomTexture)
      const tonemapPass = createTonemapPass({ exposure: sunPostprocess.exposure, toneMap: sunPostprocess.toneMap })
      const restoreAlphaPass = createRestoreAlphaPass(alphaSavePass.renderTarget.texture)
      const outputPass = new OutputPass()

      // Output should blend over the already-rendered background.
      outputPass.material.transparent = true
      outputPass.material.blending = THREE.NormalBlending
      outputPass.material.depthTest = false
      outputPass.material.depthWrite = false

      tonemapPassRef = tonemapPass

      finalComposer.addPass(finalRenderPass)
      finalComposer.addPass(alphaSavePass)
      finalComposer.addPass(mixPass)
      finalComposer.addPass(tonemapPass)
      finalComposer.addPass(restoreAlphaPass)
      finalComposer.addPass(outputPass)

      // Separate additive bloom overlay for pixels not covered by the base pass.
      const bloomOverlayComposer = new EffectComposer(renderer)
      const bloomOverlayPass = createBloomOverlayPass({
        bloomTexture,
        alphaTexture: alphaSavePass.renderTarget.texture,
        exposure: sunPostprocess.exposure,
        toneMap: sunPostprocess.toneMap,
      })
      const bloomOverlayOutputPass = new OutputPass()
      bloomOverlayOutputPass.material.transparent = true
      bloomOverlayOutputPass.material.blending = THREE.AdditiveBlending
      bloomOverlayOutputPass.material.depthTest = false
      bloomOverlayOutputPass.material.depthWrite = false

      bloomOverlayComposer.addPass(bloomOverlayPass)
      bloomOverlayComposer.addPass(bloomOverlayOutputPass)

      return {
        mode: 'wholeFrame',
        bloomComposer,
        bloomPass,
        finalComposer,
        alphaSavePass,
        bloomOverlayComposer,
        bloomOverlayPass,
        outputPass,
        bloomOverlayOutputPass,
      }
    }

    // sunIsolated
    const bloomComposer = new EffectComposer(renderer)
    bloomComposer.renderToScreen = false
    const bloomRenderPass = new RenderPass(scene, camera, null, new THREE.Color(0x000000), 0)
    const bloomPass = createBloomPass(sunPostprocess.bloom)
    bloomComposer.addPass(bloomRenderPass)
    bloomComposer.addPass(bloomPass)

    const finalComposer = new EffectComposer(renderer)
    const finalRenderPass = new RenderPass(scene, camera, null, new THREE.Color(0x000000), 0)
    const alphaSavePass = new SavePass()
    const bloomTexture = getBloomOnlyTexture(bloomPass) ?? bloomComposer.readBuffer.texture
    const mixPass = createMixBloomPass(bloomTexture)
    const tonemapPass = createTonemapPass({ exposure: sunPostprocess.exposure, toneMap: sunPostprocess.toneMap })
    const restoreAlphaPass = createRestoreAlphaPass(alphaSavePass.renderTarget.texture)
    const outputPass = new OutputPass()

    // Output should blend over the already-rendered background.
    outputPass.material.transparent = true
    outputPass.material.blending = THREE.NormalBlending
    outputPass.material.depthTest = false
    outputPass.material.depthWrite = false

    tonemapPassRef = tonemapPass

    finalComposer.addPass(finalRenderPass)
    finalComposer.addPass(alphaSavePass)
    finalComposer.addPass(mixPass)
    finalComposer.addPass(tonemapPass)
    finalComposer.addPass(restoreAlphaPass)
    finalComposer.addPass(outputPass)

    const bloomOverlayComposer = new EffectComposer(renderer)
    const bloomOverlayPass = createBloomOverlayPass({
      bloomTexture,
      alphaTexture: alphaSavePass.renderTarget.texture,
      exposure: sunPostprocess.exposure,
      toneMap: sunPostprocess.toneMap,
    })
    const bloomOverlayOutputPass = new OutputPass()
    bloomOverlayOutputPass.material.transparent = true
    bloomOverlayOutputPass.material.blending = THREE.AdditiveBlending
    bloomOverlayOutputPass.material.depthTest = false
    bloomOverlayOutputPass.material.depthWrite = false

    bloomOverlayComposer.addPass(bloomOverlayPass)
    bloomOverlayComposer.addPass(bloomOverlayOutputPass)

    return {
      mode: 'sunIsolated',
      bloomComposer,
      bloomPass,
      finalComposer,
      alphaSavePass,
      bloomOverlayComposer,
      bloomOverlayPass,
      outputPass,
      bloomOverlayOutputPass,
    }
  })()

  // For FPS calculation
  let lastFrameTimeMs = performance.now()
  let lastHudUpdateMs = 0
  const hudUpdateIntervalMs = 150 // ~6-7 Hz
  const fpsBuffer: number[] = []

  const renderOnce = (timeMs?: number) => {
    if (disposed) return

    syncCameraNear()

    const nowMs = timeMs ?? performance.now()
    const timeSec = nowMs * 0.001

    starfield?.update?.(timeSec)
    starfield?.syncToCamera(camera)

    selectionOverlay?.syncToCamera({ camera, nowMs, viewportHeightPx: container.clientHeight })

    skydome?.syncToCamera(camera)
    skydome?.setTimeSeconds(timeSec)

    // Clear once per frame (then draw bg + fg). We intentionally clear to an
    // opaque color even though the post chain uses alpha for compositing.
    renderer.setRenderTarget(null)
    renderer.setClearColor(CLEAR_COLOR, 1)
    renderer.clear(true, true, true)

    // Background first (outside postprocessing).
    if (starfield || skydome) {
      renderer.render(bgScene, camera)
    }

    // Foreground should not be depth-tested against the background.
    renderer.clearDepth()

    if (postprocessRuntime.mode === 'off') {
      renderer.render(scene, camera)
    } else if (postprocessRuntime.mode === 'wholeFrame') {
      postprocessRuntime.bloomComposer.render()
      postprocessRuntime.finalComposer.render()
      postprocessRuntime.bloomOverlayComposer.render()
    } else {
      // Render bloom only for Sun layer, then composite over the full scene.
      const prevMask = camera.layers.mask
      const prevBackground = scene.background
      camera.layers.set(SUN_BLOOM_LAYER)
      scene.background = null
      try {
        postprocessRuntime.bloomComposer.render()
      } finally {
        scene.background = prevBackground
        camera.layers.mask = prevMask
      }

      postprocessRuntime.finalComposer.render()
      postprocessRuntime.bloomOverlayComposer.render()
    }

    afterRender?.({ nowMs })

    const hud = args.hud?.()

    // Update HUD stats after render (only when HUD is enabled)
    if (hud?.enabled()) {
      const deltaMs = nowMs - lastFrameTimeMs
      if (deltaMs > 0) {
        const instantFps = 1000 / deltaMs
        fpsBuffer.push(instantFps)
        if (fpsBuffer.length > 20) fpsBuffer.shift()
      }
      lastFrameTimeMs = nowMs

      // Throttle React state updates
      if (nowMs - lastHudUpdateMs >= hudUpdateIntervalMs) {
        lastHudUpdateMs = nowMs

        const smoothedFps = fpsBuffer.length > 0 ? fpsBuffer.reduce((a, b) => a + b, 0) / fpsBuffer.length : 0

        let meshCount = 0
        let lineCount = 0
        let pointsCount = 0
        scene.traverseVisible((obj) => {
          if (obj instanceof THREE.Mesh) meshCount++
          else if (obj instanceof THREE.Line) lineCount++
          else if (obj instanceof THREE.Points) pointsCount++
        })

        const info = renderer.info
        hud.setStats({
          fps: smoothedFps,
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          lines: info.render.lines,
          points: info.render.points,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          meshCount,
          lineCount,
          pointsCount,
          cameraPosition: camera.position.clone(),
          cameraQuaternion: camera.quaternion.clone(),
          cameraEuler: new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ'),
          targetDistance: controller.radius,
          focusBody: hud.getFocusBodyLabel(),
        })
      }
    }
  }

  const invalidate = () => {
    if (disposed) return

    // When sky animation is enabled, we have a dedicated RAF loop.
    if (skyAnimationActiveRef.current) return
    if (scheduledFrame != null) return

    scheduledFrame = window.requestAnimationFrame((t) => {
      scheduledFrame = null
      renderOnce(t)
    })
  }

  const resize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return

    const nextPixelRatio = isE2e ? 1 : Math.min(window.devicePixelRatio, 2)

    // Avoid repeating expensive resize work when the observable inputs haven't
    // changed (e.g. init-time prime + ResizeObserver fire in the same layout).
    //
    // Contract: if you change resize logic, ensure `resizeKey` includes *all*
    // inputs that affect resize work.
    // - container size (`clientWidth`/`clientHeight`)
    // - effective pixel ratio (incl `isE2e` clamping)
    // - postprocess mode (affects which composers exist)
    // - bloom resolution scale (affects `bloomPass.setSize`)
    const resizeKey = `${width}x${height}@${nextPixelRatio}|${postprocessRuntime.mode}|${sunPostprocess.bloom.resolutionScale}`
    if (resizeKey === lastResizeKey) return
    lastResizeKey = resizeKey

    renderer.setPixelRatio(nextPixelRatio)
    renderer.setSize(width, height, false)

    const pixelRatio = renderer.getPixelRatio()

    if (postprocessRuntime.mode === 'wholeFrame' || postprocessRuntime.mode === 'sunIsolated') {
      postprocessRuntime.bloomComposer.setPixelRatio(pixelRatio)
      postprocessRuntime.bloomComposer.setSize(width, height)
      postprocessRuntime.finalComposer.setPixelRatio(pixelRatio)
      postprocessRuntime.finalComposer.setSize(width, height)
      postprocessRuntime.bloomOverlayComposer.setPixelRatio(pixelRatio)
      postprocessRuntime.bloomOverlayComposer.setSize(width, height)
    }

    camera.aspect = width / height
    camera.updateProjectionMatrix()

    const buffer = renderer.getDrawingBufferSize(drawingBufferSize)

    selectionOverlay?.setResolution(buffer.x, buffer.y)

    if (postprocessRuntime.mode === 'wholeFrame' || postprocessRuntime.mode === 'sunIsolated') {
      const scale = THREE.MathUtils.clamp(sunPostprocess.bloom.resolutionScale, 0.1, 1)
      const scaledW = Math.max(1, Math.floor(buffer.x * scale))
      const scaledH = Math.max(1, Math.floor(buffer.y * scale))
      postprocessRuntime.bloomPass.setSize(scaledW, scaledH)
    }

    onDrawingBufferResize?.({ width: buffer.x, height: buffer.y })
  }

  const updateSunPostprocess = (next: SunPostprocessUpdate) => {
    if (disposed) return

    // Allow live tuning of postprocessing parameters (via UI).
    const prevResolutionScale = sunPostprocess.bloom.resolutionScale

    if (next.exposure != null && Number.isFinite(next.exposure)) {
      sunPostprocess.exposure = next.exposure
    }

    if (next.toneMap) {
      sunPostprocess.toneMap = next.toneMap
    }

    if (next.bloom) {
      sunPostprocess.bloom = { ...sunPostprocess.bloom, ...next.bloom }
    }

    if (postprocessRuntime.mode === 'wholeFrame' || postprocessRuntime.mode === 'sunIsolated') {
      postprocessRuntime.bloomPass.threshold = sunPostprocess.bloom.threshold
      postprocessRuntime.bloomPass.strength = sunPostprocess.bloom.strength
      postprocessRuntime.bloomPass.radius = sunPostprocess.bloom.radius
    }

    if (tonemapPassRef) {
      applyTonemapConfig(tonemapPassRef, {
        exposure: sunPostprocess.exposure,
        toneMap: sunPostprocess.toneMap,
      })
    }

    // Keep bloom overlay in sync with the main tonemap params.
    if (postprocessRuntime.mode === 'wholeFrame' || postprocessRuntime.mode === 'sunIsolated') {
      const u = postprocessRuntime.bloomOverlayPass.material.uniforms as unknown as {
        exposure: { value: number }
        toneMapMode: { value: number }
      }
      u.exposure.value = sunPostprocess.exposure
      u.toneMapMode.value = sunPostprocess.toneMap === 'none' ? 0 : sunPostprocess.toneMap === 'filmic' ? 1 : 2
    }

    // Resolution scale is applied via `bloomPass.setSize` inside `resize()`.
    if (sunPostprocess.bloom.resolutionScale !== prevResolutionScale) {
      resize()
    }

    invalidate()
  }

  const onResize = () => {
    if (disposed) return

    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return

    resize()
    invalidate()
  }

  // Throttle ResizeObserver events to at most one resize per frame.
  const onResizeObserved = () => {
    if (disposed) return
    if (scheduledResizeFrame != null) return

    scheduledResizeFrame = window.requestAnimationFrame(() => {
      scheduledResizeFrame = null
      onResize()
    })
  }

  const resizeObserver = new ResizeObserver(onResizeObserved)
  resizeObserver.observe(container)

  // Prime drawing-buffer-dependent state so the first render has correct
  // sizes (camera aspect, SelectionOverlay line material resolution, bloom
  // render targets, etc.).
  scheduledPrimeResizeFrame = window.requestAnimationFrame(() => {
    scheduledPrimeResizeFrame = null
    onResize()
  })

  const dispose = () => {
    disposed = true

    if (scheduledFrame != null) {
      window.cancelAnimationFrame(scheduledFrame)
      scheduledFrame = null
    }

    if (scheduledResizeFrame != null) {
      window.cancelAnimationFrame(scheduledResizeFrame)
      scheduledResizeFrame = null
    }

    if (scheduledPrimeResizeFrame != null) {
      window.cancelAnimationFrame(scheduledPrimeResizeFrame)
      scheduledPrimeResizeFrame = null
    }

    resizeObserver.disconnect()

    if (starfield) {
      bgScene.remove(starfield.object)
      starfield.dispose()
      starfield = null
    }

    if (skydome) {
      bgScene.remove(skydome.object)
      skydome.dispose()
      skydome = null
    }

    if (selectionOverlay) {
      scene.remove(selectionOverlay.object)
      selectionOverlay.dispose()
    }

    afterRender = null
    onDrawingBufferResize = null

    if (postprocessRuntime.mode === 'wholeFrame' || postprocessRuntime.mode === 'sunIsolated') {
      postprocessRuntime.bloomComposer.dispose()
      postprocessRuntime.finalComposer.dispose()
      postprocessRuntime.alphaSavePass.dispose()
      postprocessRuntime.bloomOverlayComposer.dispose()
    }

    renderer.dispose()
  }

  return {
    renderer,
    scene,
    camera,
    controller,
    selectionOverlay,

    renderOnce,
    invalidate,
    resize,

    setAfterRender: (fn) => {
      afterRender = fn
    },

    setOnDrawingBufferResize: (fn) => {
      onDrawingBufferResize = fn
    },

    updateSky: (opts) => {
      ensureSky(opts)
      invalidate()
    },

    updateSunPostprocess,

    dispose,
  }
}
