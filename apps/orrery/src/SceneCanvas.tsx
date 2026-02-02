import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import * as THREE from 'three'
import type { CameraController, CameraControllerState } from './controls/CameraController.js'
import { useKeyboardControls } from './controls/useKeyboardControls.js'
import { J2000_FRAME, type BodyRef, type EtSeconds, type SpiceClient } from './spice/SpiceClient.js'
import { getBodyRegistryEntry, listDefaultVisibleBodies, type BodyId } from './scene/BodyRegistry.js'
import { computeBodyRadiusWorld } from './scene/bodyScaling.js'
import { timeStore, useTimeStoreSelector } from './time/timeStore.js'
import { usePlaybackTicker } from './time/usePlaybackTicker.js'
import { PlaybackControls } from './ui/PlaybackControls.js'
import { computeOrbitAnglesToKeepPointInView, isDirectionWithinFov } from './controls/sunFocus.js'

import { HelpOverlay } from './ui/HelpOverlay.js'
import { SelectionInspector } from './ui/SelectionInspector.js'
import { markTspiceViewerRenderedScene } from './e2eHooks/index.js'
import { installSceneInteractions, type SceneInteractions } from './interaction/installSceneInteractions.js'
import {
  getHomePresetState,
  getHomePresetStateForKey,
  listHomePresetAliasesForKey,
  HOME_PRESET_KEYS,
  type HomePresetKey,
} from './interaction/homePresets.js'
import { RenderHud, type RenderHudStats } from './renderer/RenderHud.js'
import { createThreeRuntime, type ThreeRuntime } from './renderer/createThreeRuntime.js'
import { parseSceneCanvasRuntimeConfigFromLocationSearch } from './runtimeConfig/sceneCanvasRuntimeConfig.js'
import { initSpiceSceneRuntime, type SpiceSceneRuntime } from './scene/runtime/initSpiceSceneRuntime.js'

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const controllerRef = useRef<CameraController | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const invalidateRef = useRef<(() => void) | null>(null)
  const renderOnceRef = useRef<((timeMs?: number) => void) | null>(null)
  const twinkleActiveRef = useRef(false)
  const cancelFocusTweenRef = useRef<(() => void) | null>(null)

  const rendererRuntimeRef = useRef<ThreeRuntime | null>(null)

  const runtimeConfig = useMemo(() => parseSceneCanvasRuntimeConfigFromLocationSearch(window.location.search), [])

  const { searchParams: search, isE2e, enableLogDepth, starSeed, initialUtc, initialEt } = runtimeConfig

  const [focusBody, setFocusBody] = useState<BodyRef>('EARTH')
  const [showJ2000Axes, setShowJ2000Axes] = useState(false)
  const [showBodyFixedAxes, setShowBodyFixedAxes] = useState(false)
  // Selected body (promoted from local closure variable for inspector panel)
  const [selectedBody, setSelectedBody] = useState<BodyRef | null>(null)
  const [spiceClient, setSpiceClient] = useState<SpiceClient | null>(null)

  // Advanced tuning sliders (ephemeral, local state only)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [cameraFovDeg, setCameraFovDeg] = useState(50)

  const earthAppearanceDefaults = useMemo(() => getBodyRegistryEntry('EARTH').style.earthAppearance, [])

  // Earth appearance tuning (kept configurable in code; no longer exposed as debug sliders).
  const ambientLightIntensity = 0.2
  const sunLightIntensity = 2.0
  const earthNightAlbedo = 0.004
  const earthTwilight = earthAppearanceDefaults?.nightLightsTwilight ?? 0.12
  const earthNightLightsIntensity = earthAppearanceDefaults?.nightLightsIntensity ?? 1.25
  const earthAtmosphereIntensity = earthAppearanceDefaults?.atmosphereIntensity ?? 0.55
  const earthCloudsNightMultiplier = 0.0

  // Render HUD toggle (ephemeral, not persisted)
  const [showRenderHud, setShowRenderHud] = useState(false)

  // Orbit path tuning (ephemeral)
  const [orbitLineWidthPx, setOrbitLineWidthPx] = useState(1.5)
  const [orbitSamplesPerOrbit, setOrbitSamplesPerOrbit] = useState(512)
  const [orbitMaxTotalPoints, setOrbitMaxTotalPoints] = useState(10_000)
  // Top-level orbit paths toggle (non-advanced, default off)
  const [orbitPathsEnabled, setOrbitPathsEnabled] = useState(false)
  // Sun visual scale multiplier: 1 = true size, >1 = enlarged for visibility.
  // This is ephemeral (not persisted) and only affects the Sun's rendered radius.
  const [sunScaleMultiplier, setSunScaleMultiplier] = useState(1)
  // Labels toggle (non-advanced, default off)
  const [labelsEnabled, setLabelsEnabled] = useState(false)
  // Occlusion toggle for labels (advanced, default off)
  const [labelOcclusionEnabled, setLabelOcclusionEnabled] = useState(false)

  // Single toggle for animated sky effects (skydome shader + starfield twinkle).
  // Disabled by default for e2e tests to keep snapshots deterministic.
  const [animatedSky, setAnimatedSky] = useState(() => !isE2e)

  const twinkleEnabled = animatedSky && !isE2e

  // Planet visual scale multiplier (applies to all non-Sun bodies, including the Moon).
  // Uses a log-scale slider so the range can go "absurdly" large without being fiddly.
  // This is ephemeral (not persisted) and only affects rendered radii.
  const [planetScaleSlider, setPlanetScaleSlider] = useState(0)

  const PLANET_SCALE_MAX = 800
  const PLANET_SCALE_SLIDER_MAX = Math.round(20 * Math.log10(PLANET_SCALE_MAX))

  const planetScaleMultiplier = useMemo(
    () => Math.min(PLANET_SCALE_MAX, Math.pow(10, planetScaleSlider / 20)),
    [planetScaleSlider],
  )

  // HUD stats state - updated on render frames when HUD is enabled
  const [hudStats, setHudStats] = useState<RenderHudStats | null>(null)

  const formatScaleMultiplier = (m: number) => {
    if (!Number.isFinite(m)) return String(m)
    if (m < 10) return m.toFixed(2).replace(/\.00$/, '')
    if (m < 1000) return String(Math.round(m))
    return m.toExponential(1)
  }

  const quantumSec = useTimeStoreSelector((s) => s.quantumSec)
  // Current ET for inspector panel (subscribes to time store changes)
  const etSec = useTimeStoreSelector((s) => s.etSec)

  // Keep these baked-in for now (no user-facing tuning).
  const focusDistanceMultiplier = 4
  const sunOcclusionMarginRad = 0

  const focusOptions = useMemo(() => {
    // TODO(#119): Once moons are fully integrated into default visibility rules,
    // this should probably become a dedicated helper (e.g. listFocusableBodies).
    const base = listDefaultVisibleBodies()
    const moon = getBodyRegistryEntry('MOON')
    return base.some((b) => b.id === moon.id) ? base : [...base, moon]
  }, [])

  // Keep renderer units consistent across the app. This matches the value used
  // inside the renderer effect.
  const kmToWorld = 1 / 1_000_000

  // The renderer/bootstrap `useEffect` is mounted once, so capture the initial
  // runtime config it needs without having to re-run on UI toggles.
  const initRuntimeConfigRef = useRef({
    search,
    isE2e,
    enableLogDepth,
    starSeed,
    initialUtc,
    initialEt,
    kmToWorld,
    animatedSky,
    twinkleEnabled,
  })

  // Control pane collapsed state: starts collapsed on all screen sizes
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [panModeEnabled, setPanModeEnabled] = useState(false)
  // New: Look mode toggle for touch - when enabled, 1-finger drag does free-look instead of orbit
  const [lookModeEnabled, setLookModeEnabled] = useState(false)

  const [helpOpen, setHelpOpen] = useState(false)
  const panModeEnabledRef = useRef(panModeEnabled)
  const lookModeEnabledRef = useRef(lookModeEnabled)
  const focusOnOriginRef = useRef<(() => void) | null>(null)
  const selectedBodyIdRef = useRef<BodyId | undefined>(undefined)
  const initialControllerStateRef = useRef<CameraControllerState | null>(null)

  // Track current focus body for keyboard reset logic.
  const focusBodyRef = useRef<BodyRef | null>(focusBody)
  focusBodyRef.current = focusBody

  // Per-body reset presets (used by keyboard Reset / R).
  const resetControllerStateByBodyRef = useRef<Map<string, CameraControllerState> | null>(null)
  if (!resetControllerStateByBodyRef.current) {
    const next = new Map<string, CameraControllerState>()

    const register = (key: HomePresetKey) => {
      const preset = getHomePresetStateForKey(key)
      for (const alias of listHomePresetAliasesForKey(key)) {
        next.set(alias, preset)
      }
    }

    for (const key of HOME_PRESET_KEYS) {
      register(key)
    }

    resetControllerStateByBodyRef.current = next
  }
  // Ref for resetting look offset (used by keyboard Escape and focus changes)
  const resetLookOffsetRef = useRef<(() => void) | null>(null)
  panModeEnabledRef.current = panModeEnabled
  lookModeEnabledRef.current = lookModeEnabled

  const handleQuantumChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    if (value > 0) {
      timeStore.setQuantumSec(value)
    }
  }, [])

  // Enable keyboard controls (disabled in e2e mode)
  useKeyboardControls({
    controllerRef,
    cameraRef,
    canvasRef,
    invalidate: () => invalidateRef.current?.(),
    cancelFocusTween: () => cancelFocusTweenRef.current?.(),
    focusOnOrigin: () => focusOnOriginRef.current?.(),
    toggleHelp: () => setHelpOpen((open) => !open),
    resetLookOffset: () => resetLookOffsetRef.current?.(),
    initialControllerStateRef,
    resetControllerStateByBodyRef,
    focusBodyRef,
    toggleLabels: () => setLabelsEnabled((v) => !v),
    enabled: !isE2e,
  })

  const zoomBy = (factor: number) => {
    const controller = controllerRef.current
    const camera = cameraRef.current
    if (!controller || !camera) return

    cancelFocusTweenRef.current?.()

    controller.radius *= factor
    controller.applyToCamera(camera)
    invalidateRef.current?.()
  }

  const refocusSun = () => {
    const controller = controllerRef.current
    const camera = cameraRef.current
    if (!controller || !camera || !spiceClient) return

    // If a focus animation is in-flight, stop it so our manual camera move
    // isn't immediately overwritten.
    cancelFocusTweenRef.current?.()

    // If the current focus IS the sun, this button shouldn't do anything.
    if (String(focusBody) === 'SUN') return

    const etSec = timeStore.getState().etSec
    const focusState = spiceClient.getBodyState({
      target: focusBody,
      observer: 'SUN',
      frame: J2000_FRAME,
      et: etSec,
    })

    const focusPosKm = focusState.positionKm
    const sunPosWorld = new THREE.Vector3(
      -focusPosKm[0] * kmToWorld,
      -focusPosKm[1] * kmToWorld,
      -focusPosKm[2] * kmToWorld,
    )

    if (sunPosWorld.lengthSq() < 1e-12) return

    const sunDir = sunPosWorld.clone().normalize()

    // Compute current forward direction (camera -> target) derived from yaw/pitch.
    const cosPitch = Math.cos(controller.pitch)
    const currentOffsetDir = new THREE.Vector3(
      cosPitch * Math.cos(controller.yaw),
      cosPitch * Math.sin(controller.yaw),
      Math.sin(controller.pitch),
    )
    const currentForwardDir = currentOffsetDir.multiplyScalar(-1).normalize()

    // No additional Sun margin: just ensure the Sun isn't hidden directly
    // behind the focused body.
    const marginRad = sunOcclusionMarginRad

    // Ensure the Sun's center is offset from screen center by more than the
    // focused body's angular radius, so it can't be fully occluded.
    const focusMeta = focusOptions.find((b) => String(b.body) === String(focusBody))
    const radiusWorld = (() => {
      if (!focusMeta) return undefined

      const base = computeBodyRadiusWorld({
        radiusKm: focusMeta.style.radiusKm,
        kmToWorld,
        mode: 'true',
      })

      // Keep occlusion math consistent with the rendered body size.
      return String(focusBody) === 'SUN' ? base * sunScaleMultiplier : base * planetScaleMultiplier
    })()

    const bodyAngRad =
      radiusWorld && controller.radius > 1e-12
        ? Math.asin(THREE.MathUtils.clamp(radiusWorld / controller.radius, 0, 1))
        : 0
    const minSeparationRad = bodyAngRad + marginRad

    // If we're zoomed in too far, it may be geometrically impossible to place
    // the Sun outside the body's projected disk while still staying in-frame.
    // In that case, zoom out just enough to make it possible.
    const halfV = THREE.MathUtils.degToRad(cameraFovDeg) / 2
    const halfH = Math.atan(Math.tan(halfV) * (camera.aspect || 1))
    const half = Math.min(halfV, halfH)
    const maxOffAxis = Math.max(0, half - marginRad)
    const maxDesiredOffAxis = maxOffAxis * 0.8

    if (radiusWorld != null && minSeparationRad > maxDesiredOffAxis && maxDesiredOffAxis > marginRad + 1e-6) {
      const maxBodyAng = maxDesiredOffAxis - marginRad
      const minRadiusForBodyAng = radiusWorld / Math.sin(maxBodyAng)
      controller.radius = Math.max(controller.radius, minRadiusForBodyAng)
    }

    const sunAngle = currentForwardDir.angleTo(sunDir)
    const sunInFov = isDirectionWithinFov({
      cameraForwardDir: currentForwardDir,
      dirToPoint: sunDir,
      cameraFovDeg,
      cameraAspect: camera.aspect,
      marginRad,
    })
    const sunNotOccluded = sunAngle >= minSeparationRad

    if (!sunInFov || !sunNotOccluded) {
      const angles = computeOrbitAnglesToKeepPointInView({
        pointWorld: sunPosWorld,
        cameraFovDeg,
        cameraAspect: camera.aspect,
        desiredOffAxisRad: minSeparationRad,
        marginRad,
      })

      if (angles) {
        controller.yaw = angles.yaw
        controller.pitch = angles.pitch
      }
    }

    controller.applyToCamera(camera)
    invalidateRef.current?.()
  }

  // Start the playback ticker (handles time advancement)
  usePlaybackTicker()

  const updateSceneRef = useRef<
    | ((next: {
        etSec: EtSeconds
        focusBody: BodyRef
        showJ2000Axes: boolean
        showBodyFixedAxes: boolean
        cameraFovDeg: number
        sunScaleMultiplier: number
        planetScaleMultiplier: number

        orbitLineWidthPx: number
        orbitSamplesPerOrbit: number
        orbitMaxTotalPoints: number
        orbitPathsEnabled: boolean
        labelsEnabled: boolean
        labelOcclusionEnabled: boolean

        ambientLightIntensity: number
        sunLightIntensity: number
        earthNightAlbedo: number
        earthTwilight: number
        earthNightLightsIntensity: number
        earthAtmosphereIntensity: number
        earthCloudsNightMultiplier: number
      }) => void)
    | null
  >(null)

  // The renderer/bootstrap `useEffect` is mounted once, so it needs a ref to
  // read the latest UI state when async init completes.
  const latestUiRef = useRef({
    focusBody,
    showJ2000Axes,
    showBodyFixedAxes,
    cameraFovDeg,
    sunScaleMultiplier,
    planetScaleMultiplier,
    showRenderHud,

    orbitLineWidthPx,
    orbitSamplesPerOrbit,
    orbitMaxTotalPoints,
    orbitPathsEnabled,
    labelsEnabled,
    labelOcclusionEnabled,

    ambientLightIntensity,
    sunLightIntensity,
    earthNightAlbedo,
    earthTwilight,
    earthNightLightsIntensity,
    earthAtmosphereIntensity,
    earthCloudsNightMultiplier,
  })
  latestUiRef.current = {
    focusBody,
    showJ2000Axes,
    showBodyFixedAxes,
    cameraFovDeg,
    sunScaleMultiplier,
    planetScaleMultiplier,
    showRenderHud,

    orbitLineWidthPx,
    orbitSamplesPerOrbit,
    orbitMaxTotalPoints,
    orbitPathsEnabled,
    labelsEnabled,
    labelOcclusionEnabled,

    ambientLightIntensity,
    sunLightIntensity,
    earthNightAlbedo,
    earthTwilight,
    earthNightLightsIntensity,
    earthAtmosphereIntensity,
    earthCloudsNightMultiplier,
  }

  // Subscribe to time store changes and update the scene (without React rerenders)
  useEffect(() => {
    const unsubscribe = timeStore.subscribe(() => {
      const etSec = timeStore.getState().etSec
      updateSceneRef.current?.({ etSec, ...latestUiRef.current })
    })
    return unsubscribe
  }, [])

  // Update scene when UI state changes (focus, axes toggles, camera options)
  useEffect(() => {
    const etSec = timeStore.getState().etSec
    updateSceneRef.current?.({
      etSec,
      focusBody,
      showJ2000Axes,
      showBodyFixedAxes,
      cameraFovDeg,
      sunScaleMultiplier,
      planetScaleMultiplier,

      orbitLineWidthPx,
      orbitSamplesPerOrbit,
      orbitMaxTotalPoints,
      orbitPathsEnabled,
      labelsEnabled,
      labelOcclusionEnabled,

      ambientLightIntensity,
      sunLightIntensity,
      earthNightAlbedo,
      earthTwilight,
      earthNightLightsIntensity,
      earthAtmosphereIntensity,
      earthCloudsNightMultiplier,
    })
  }, [
    focusBody,
    showJ2000Axes,
    showBodyFixedAxes,
    cameraFovDeg,
    sunScaleMultiplier,
    planetScaleMultiplier,
    orbitLineWidthPx,
    orbitSamplesPerOrbit,
    orbitMaxTotalPoints,
    orbitPathsEnabled,
    labelsEnabled,
    labelOcclusionEnabled,

    ambientLightIntensity,
    sunLightIntensity,
    earthNightAlbedo,
    earthTwilight,
    earthNightLightsIntensity,
    earthAtmosphereIntensity,
    earthCloudsNightMultiplier,
  ])

  // Imperatively update camera FOV when the slider changes
  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.fov = cameraFovDeg
    camera.updateProjectionMatrix()
    invalidateRef.current?.()
  }, [cameraFovDeg])

  // Intentionally runs once (renderer/bootstrap):
  // - Uses refs / module singletons for anything that changes over time.
  // - Do not capture React state in this closure; plumb dynamic changes through
  //   `latestUiRef` + the dedicated update effects below.
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const { search, isE2e, enableLogDepth, starSeed, animatedSky, twinkleEnabled, initialUtc, initialEt, kmToWorld } =
      initRuntimeConfigRef.current

    let disposed = false

    const pickables: THREE.Mesh[] = []

    // Focus helpers are only enabled in interactive mode, but we keep the
    // variables in outer scope so scene updates can cancel tweens / adjust zoom.
    let cancelFocusTween: (() => void) | undefined
    let focusOn: ((nextTarget: THREE.Vector3, opts?: { radius?: number; immediate?: boolean }) => void) | undefined

    let interactions: SceneInteractions | null = null
    let spiceSceneRuntime: SpiceSceneRuntime | null = null

    const hudApi = {
      enabled: () => latestUiRef.current.showRenderHud,
      getFocusBodyLabel: () => String(latestUiRef.current.focusBody),
      setStats: (next: RenderHudStats) => setHudStats(next),
    }

    const three = createThreeRuntime({
      canvas,
      container,
      isE2e,
      enableLogDepth,
      starSeed,
      animatedSky,
      twinkleEnabled,
      twinkleActiveRef,
      initialFocusBody: latestUiRef.current.focusBody,
      initialCameraFovDeg: latestUiRef.current.cameraFovDeg,
      getHomePresetState,
      hud: () => hudApi,
    })

    rendererRuntimeRef.current = three
    rendererRef.current = three.renderer
    sceneRef.current = three.scene
    cameraRef.current = three.camera
    controllerRef.current = three.controller
    invalidateRef.current = three.invalidate
    renderOnceRef.current = three.renderOnce

    // Expose resetLookOffset to keyboard controls
    resetLookOffsetRef.current = () => {
      three.controller.resetLookOffset()
      three.controller.applyToCamera(three.camera)
      three.invalidate()
    }

    // Auto-zoom target radius when focusing bodies.
    // Clamp to the controller's zoom limits so focus animations and manual zoom
    // behavior always agree.
    const computeFocusRadius = (radiusWorld: number) =>
      THREE.MathUtils.clamp(
        radiusWorld * focusDistanceMultiplier,
        three.controller.minRadius,
        three.controller.maxRadius,
      )

    if (!isE2e) {
      interactions = installSceneInteractions({
        canvas,
        camera: three.camera,
        controller: three.controller,
        pickables,
        invalidate: three.invalidate,
        renderOnce: three.renderOnce,
        computeFocusRadius,
        setFocusBody: (body) => setFocusBody(body),
        setSelectedBody: (body) => setSelectedBody(body),
        selectedBodyIdRef,
        selectionRing: three.selectionRing,
        panModeEnabledRef,
        lookModeEnabledRef,
        isDisposed: () => disposed,
      })

      cancelFocusTween = interactions.cancelFocusTween
      focusOn = interactions.focusOn

      cancelFocusTweenRef.current = cancelFocusTween

      // Expose focusOn to the keyboard controls via ref
      focusOnOriginRef.current = () => {
        // Focus on the origin (the currently focused body's position in the scene)
        // Since we rebase positions around the focus body, origin is always (0,0,0)
        const originTarget = new THREE.Vector3(0, 0, 0)
        focusOn?.(originTarget, {
          radius: three.controller.radius, // Keep current zoom level
        })
      }
    }

    void (async () => {
      try {
        const runtime = await initSpiceSceneRuntime({
          isE2e,
          searchParams: search,
          initialUtc,
          initialEt,
          scene: three.scene,
          camera: three.camera,
          controller: three.controller,
          container,
          pickables,
          onSpiceClientLoaded: (client) => {
            if (!disposed) setSpiceClient(client)
          },
          kmToWorld,
          sunOcclusionMarginRad,
          computeFocusRadius,
          cancelFocusTween,
          focusOn,
          resetLookOffset: () => three.controller.resetLookOffset(),
          getHomePresetState,
          initialControllerStateRef,
          selectedBodyIdRef,
          invalidate: three.invalidate,
          isDisposed: () => disposed,
        })

        if (disposed) {
          runtime.dispose()
          return
        }

        spiceSceneRuntime = runtime

        three.setAfterRender(() => {
          spiceSceneRuntime?.afterRender()
        })
        three.setOnDrawingBufferResize(runtime.onDrawingBufferResize)

        updateSceneRef.current = runtime.updateScene

        // Initial render with current time store state
        const initialEtSec = timeStore.getState().etSec
        runtime.updateScene({ etSec: initialEtSec, ...latestUiRef.current })

        three.resize()
        three.controller.applyToCamera(three.camera)
        three.renderOnce()

        // Signals to Playwright tests that the WebGL scene has been rendered.
        markTspiceViewerRenderedScene({ isE2e })
      } catch (err) {
        // Surface initialization failures to the console so e2e tests can catch them.
        if (!disposed) console.error(err)
      }
    })()

    return () => {
      disposed = true

      spiceSceneRuntime?.dispose()
      spiceSceneRuntime = null

      interactions?.dispose()
      interactions = null

      three.dispose()
      rendererRuntimeRef.current = null

      controllerRef.current = null
      cameraRef.current = null
      sceneRef.current = null
      rendererRef.current = null
      invalidateRef.current = null
      renderOnceRef.current = null
      cancelFocusTweenRef.current = null
      focusOnOriginRef.current = null
      resetLookOffsetRef.current = null

      updateSceneRef.current = null
    }
  }, [])

  // Swap the starfield and skydome in-place when animatedSky toggled.
  useEffect(() => {
    rendererRuntimeRef.current?.updateSky({ animatedSky, twinkleEnabled, isE2e })
  }, [animatedSky, twinkleEnabled, isE2e])

  // Lightweight RAF loop for twinkle animation.
  useEffect(() => {
    twinkleActiveRef.current = twinkleEnabled

    if (!twinkleEnabled) return

    let frame: number | null = null
    const tick = (t: number) => {
      if (!twinkleActiveRef.current) return
      renderOnceRef.current?.(t)
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame)
    }
  }, [twinkleEnabled])

  return (
    <div ref={containerRef} className="scene">
      {!isE2e && spiceClient ? (
        <div className={`sceneOverlay ${overlayOpen ? 'sceneOverlayOpen' : 'sceneOverlayCollapsed'}`}>
          {/* Header: Collapse toggle on left, title, help + mobile-only Look/Pan on right */}
          <div className="sceneOverlayHeader">
            <button
              className="sceneOverlayToggle"
              onClick={() => setOverlayOpen((v) => !v)}
              type="button"
              aria-expanded={overlayOpen}
              aria-controls="scene-overlay-body"
              aria-label={overlayOpen ? 'Collapse controls' : 'Expand controls'}
            >
              {overlayOpen ? '▲' : '▼'}
            </button>

            <div className="sceneOverlayHeaderTitle">CONTROLS</div>

            <div className="sceneOverlayHeaderActions">
              <button
                className="helpButton"
                onClick={() => setHelpOpen(true)}
                type="button"
                aria-label="What is this?"
                title="What is this?"
              >
                ?
              </button>
              {/* Mobile-only look/pan lock buttons */}
              <button
                className={`sceneOverlayButton mobileOnly ${lookModeEnabled ? 'sceneOverlayButtonActive' : ''}`}
                aria-pressed={lookModeEnabled}
                onClick={() => setLookModeEnabled((v) => !v)}
                type="button"
                title="When enabled, 1-finger drag does free-look instead of orbit"
              >
                Look
              </button>
              <button
                className={`sceneOverlayButton mobileOnly ${panModeEnabled ? 'sceneOverlayButtonActive' : ''}`}
                aria-pressed={panModeEnabled}
                onClick={() => setPanModeEnabled((v) => !v)}
                type="button"
                title="When enabled, 1-finger drag pans instead of orbiting"
              >
                Pan
              </button>
            </div>
          </div>

          {overlayOpen ? (
            <div id="scene-overlay-body" className="sceneOverlayBody">
              {/* Playback controls: UTC/ET display, scrubber, buttons, rate */}
              <PlaybackControls spiceClient={spiceClient} />

              <div className="controlsDivider" />

              {/* Focus Section */}
              <div className="controlsSection">
                <div className="focusRow">
                  <span className="focusLabel">Focus:</span>
                  <select
                    className="focusSelect"
                    value={String(focusBody)}
                    onChange={(e) => {
                      setFocusBody(e.target.value)
                    }}
                  >
                    {focusOptions.map((b) => (
                      <option key={b.id} value={String(b.body)}>
                        {b.style.label ?? b.id}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className={`asciiBtn asciiBtnWide ${String(focusBody) === 'SUN' ? 'asciiBtnDisabled' : ''}`}
                  type="button"
                  onClick={refocusSun}
                  disabled={String(focusBody) === 'SUN'}
                  title="Quickly refocus the scene on the Sun"
                >
                  <span className="asciiBtnBracket">[</span>
                  <span className="asciiBtnContent">{String(focusBody) === 'SUN' ? 'focus sun' : 'Focus Sun'}</span>
                  <span className="asciiBtnBracket">]</span>
                </button>
              </div>

              {/* Checkbox grid: 2 columns */}
              <div className="checkboxGrid">
                <label className="asciiCheckbox">
                  <span className="asciiCheckboxBox" onClick={() => setLabelsEnabled((v) => !v)}>
                    [{labelsEnabled ? '✓' : '\u00A0'}]
                  </span>
                  <span className="asciiCheckboxLabel" onClick={() => setLabelsEnabled((v) => !v)}>
                    Labels
                  </span>
                </label>

                <label className="asciiCheckbox">
                  <span className="asciiCheckboxBox" onClick={() => setOrbitPathsEnabled((v) => !v)}>
                    [{orbitPathsEnabled ? '✓' : '\u00A0'}]
                  </span>
                  <span className="asciiCheckboxLabel" onClick={() => setOrbitPathsEnabled((v) => !v)}>
                    Orbits
                  </span>
                </label>

                <label className="asciiCheckbox">
                  <span className="asciiCheckboxBox" onClick={() => setShowJ2000Axes((v) => !v)}>
                    [{showJ2000Axes ? '✓' : '\u00A0'}]
                  </span>
                  <span className="asciiCheckboxLabel" onClick={() => setShowJ2000Axes((v) => !v)}>
                    Axes
                  </span>
                </label>

                <label className="asciiCheckbox">
                  <span className="asciiCheckboxBox" onClick={() => setShowRenderHud((v) => !v)}>
                    [{showRenderHud ? '✓' : '\u00A0'}]
                  </span>
                  <span className="asciiCheckboxLabel" onClick={() => setShowRenderHud((v) => !v)}>
                    HUD
                  </span>
                </label>
              </div>

              <div className="controlsDivider" />

              {/* Advanced disclosure row */}
              <button className="advancedToggle" onClick={() => setShowAdvanced(!showAdvanced)} type="button">
                {showAdvanced ? '▼' : '▶'} ADVANCED
              </button>

              {showAdvanced && (
                <div className="advancedPanel">
                  <div className="advancedHeader">ADVANCED CONTROLS</div>

                  {/* Group 1: Camera FOV, Planet Scale, Sun Scale */}
                  <div className="advancedGroup">
                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Camera FOV</span>
                      <input
                        type="range"
                        min={30}
                        max={90}
                        step={1}
                        value={cameraFovDeg}
                        onChange={(e) => setCameraFovDeg(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{cameraFovDeg}°</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Planet Scale</span>
                      <input
                        type="range"
                        min={0}
                        max={PLANET_SCALE_SLIDER_MAX}
                        step={1}
                        value={planetScaleSlider}
                        onChange={(e) => setPlanetScaleSlider(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{formatScaleMultiplier(planetScaleMultiplier)}×</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Sun Scale</span>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={sunScaleMultiplier}
                        onChange={(e) => setSunScaleMultiplier(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunScaleMultiplier}×</span>
                    </div>
                  </div>

                  <div className="advancedDivider" />

                  {/* Group 2: Orbit Line Width, Samples/Orbit, Max Orbit Points, Quantum */}
                  <div className="advancedGroup">
                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Orbit Line Width</span>
                      <input
                        type="range"
                        min={0.5}
                        max={10}
                        step={0.1}
                        value={orbitLineWidthPx}
                        onChange={(e) => setOrbitLineWidthPx(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{orbitLineWidthPx.toFixed(1)}px</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Samples / Orbit</span>
                      <input
                        type="range"
                        min={32}
                        max={2048}
                        step={32}
                        value={orbitSamplesPerOrbit}
                        onChange={(e) => setOrbitSamplesPerOrbit(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{orbitSamplesPerOrbit}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Max Orbit Points</span>
                      <input
                        type="number"
                        min={256}
                        step={256}
                        value={orbitMaxTotalPoints}
                        onChange={(e) => setOrbitMaxTotalPoints(Number(e.target.value))}
                      />
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Quantum (s)</span>
                      <input type="number" min={0.001} step={0.01} value={quantumSec} onChange={handleQuantumChange} />
                    </div>
                  </div>

                  <div className="advancedDivider" />

                  {/* Group 3: Animated Sky, Label Occlusion */}
                  <div className="advancedCheckboxRow">
                    <label className="asciiCheckbox">
                      <span className="asciiCheckboxBox" onClick={() => setAnimatedSky((v) => !v)}>
                        [{animatedSky ? '✓' : '\u00A0'}]
                      </span>
                      <span className="asciiCheckboxLabel" onClick={() => setAnimatedSky((v) => !v)}>
                        Animated Sky
                      </span>
                    </label>

                    <label className="asciiCheckbox">
                      <span className="asciiCheckboxBox" onClick={() => setLabelOcclusionEnabled((v) => !v)}>
                        [{labelOcclusionEnabled ? '✓' : '\u00A0'}]
                      </span>
                      <span className="asciiCheckboxLabel" onClick={() => setLabelOcclusionEnabled((v) => !v)}>
                        Label Occlusion
                      </span>
                    </label>
                  </div>

                  {/* Body-fixed axes - keep in advanced */}
                  <div className="advancedCheckboxRow" style={{ marginTop: '6px' }}>
                    <label className="asciiCheckbox">
                      <span className="asciiCheckboxBox" onClick={() => setShowBodyFixedAxes((v) => !v)}>
                        [{showBodyFixedAxes ? '✓' : '\u00A0'}]
                      </span>
                      <span className="asciiCheckboxLabel" onClick={() => setShowBodyFixedAxes((v) => !v)}>
                        Body-fixed Axes
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isE2e ? (
        <div className="sceneZoomButtons">
          <button className="sceneZoomButton" type="button" onClick={() => zoomBy(1 / 1.15)} aria-label="Zoom in">
            +
          </button>
          <button className="sceneZoomButton" type="button" onClick={() => zoomBy(1.15)} aria-label="Zoom out">
            −
          </button>
        </div>
      ) : null}

      {/* Selection Inspector - shows when a body is selected */}
      {!isE2e && selectedBody && spiceClient ? (
        <SelectionInspector
          selectedBody={selectedBody}
          focusBody={focusBody}
          spiceClient={spiceClient}
          etSec={etSec}
          observer="SUN"
          frame={J2000_FRAME}
        />
      ) : null}
      <canvas ref={canvasRef} className="sceneCanvas" />

      {/* Render HUD overlays */}
      {showRenderHud && <RenderHud stats={hudStats} />}

      <HelpOverlay isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
