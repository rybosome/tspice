import * as THREE from 'three'
import { CameraController, type CameraControllerState } from '../controls/CameraController.js'
import { createSelectionRing, type SelectionRing } from '../scene/SelectionRing.js'
import { createSkydome, type CreateSkydomeOptions } from '../scene/Skydome.js'
import { createStarfield, type StarfieldHandle } from '../scene/Starfield.js'
import type { BodyRef } from '../spice/SpiceClient.js'
import type { RenderHudStats } from './RenderHud.js'

export type ThreeRuntime = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controller: CameraController

  selectionRing?: SelectionRing

  renderOnce: (timeMs?: number) => void
  invalidate: () => void
  resize: () => void

  setAfterRender: (fn: ((args: { nowMs: number }) => void) | null) => void
  setOnDrawingBufferResize: (fn: ((bufferSize: { width: number; height: number }) => void) | null) => void

  updateSky: (opts: { animatedSky: boolean; twinkleEnabled: boolean; isE2e: boolean }) => void
  dispose: () => void
}

export function createThreeRuntime(args: {
  canvas: HTMLCanvasElement
  container: HTMLDivElement
  isE2e: boolean
  enableLogDepth: boolean

  starSeed: number
  animatedSky: boolean
  twinkleEnabled: boolean

  /** Keep invalidate behavior in sync with the twinkle RAF loop. */
  twinkleActiveRef: { current: boolean }

  initialFocusBody: BodyRef
  initialCameraFovDeg: number
  getHomePresetState: (focusBody: BodyRef) => CameraControllerState | null

  hud?: {
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
    twinkleActiveRef,
    initialFocusBody,
    initialCameraFovDeg,
    getHomePresetState,
  } = args

  let disposed = false

  let scheduledFrame: number | null = null

  const drawingBufferSize = new THREE.Vector2()

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isE2e,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: enableLogDepth,
  })

  // Keep e2e snapshots stable by not depending on deviceScaleFactor.
  renderer.setPixelRatio(isE2e ? 1 : Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0f131a')

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
    const desiredNear = Math.min(
      DEFAULT_NEAR,
      Math.max(MIN_NEAR, controller.radius * NEAR_RADIUS_FRACTION),
    )

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

  // Subtle selection ring (interactive-only)
  const selectionRing = !isE2e ? createSelectionRing() : undefined
  if (selectionRing) {
    scene.add(selectionRing.object)
  }

  const ensureSky = (opts: { animatedSky: boolean; twinkleEnabled: boolean; isE2e: boolean }) => {
    if (starfield) {
      scene.remove(starfield.object)
      starfield.dispose()
      starfield = null
    }

    starfield = createStarfield({ seed: starSeed, twinkle: opts.twinkleEnabled })
    scene.add(starfield.object)
    starfield.syncToCamera(camera)

    const shouldHaveSkydome = opts.animatedSky && !opts.isE2e

    if (skydome && !shouldHaveSkydome) {
      scene.remove(skydome.object)
      skydome.dispose()
      skydome = null
    } else if (!skydome && shouldHaveSkydome) {
      const skydomeOpts: CreateSkydomeOptions = { seed: starSeed }
      skydome = createSkydome(skydomeOpts)
      scene.add(skydome.object)
      skydome.syncToCamera(camera)
    }
  }

  ensureSky({ animatedSky: args.animatedSky, twinkleEnabled: args.twinkleEnabled, isE2e })

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

    selectionRing?.syncToCamera({ camera, nowMs })

    skydome?.syncToCamera(camera)
    skydome?.setTimeSeconds(timeSec)

    renderer.render(scene, camera)

    afterRender?.({ nowMs })

    // Update HUD stats after render (only when HUD is enabled)
    if (args.hud?.enabled()) {
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
        args.hud.setStats({
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
          focusBody: args.hud.getFocusBodyLabel(),
        })
      }
    }
  }

  const invalidate = () => {
    if (disposed) return

    // When twinkling is enabled, we have a dedicated RAF loop.
    if (twinkleActiveRef.current) return
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

    renderer.setPixelRatio(isE2e ? 1 : Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)

    camera.aspect = width / height
    camera.updateProjectionMatrix()

    const buffer = renderer.getDrawingBufferSize(drawingBufferSize)
    onDrawingBufferResize?.({ width: buffer.x, height: buffer.y })
  }

  const onResize = () => {
    if (disposed) return
    resize()
    invalidate()
  }

  const resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(container)

  const dispose = () => {
    disposed = true

    if (scheduledFrame != null) {
      window.cancelAnimationFrame(scheduledFrame)
      scheduledFrame = null
    }

    resizeObserver.disconnect()

    if (starfield) {
      scene.remove(starfield.object)
      starfield.dispose()
      starfield = null
    }

    if (skydome) {
      scene.remove(skydome.object)
      skydome.dispose()
      skydome = null
    }

    if (selectionRing) {
      scene.remove(selectionRing.object)
      selectionRing.dispose()
    }

    afterRender = null
    onDrawingBufferResize = null

    renderer.dispose()
  }

  return {
    renderer,
    scene,
    camera,
    controller,
    selectionRing,

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

    dispose,
  }
}
