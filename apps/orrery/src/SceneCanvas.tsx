import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import { InfoOverlay } from './ui/InfoOverlay.js'
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
import { isEarthAppearanceLayer } from './scene/SceneModel.js'

type AdvancedPaneId = 'time' | 'scale' | 'guides' | 'orbits' | 'performance' | 'rendering'

type AdvancedHelpTopicId =
  | 'zoom'
  | 'cameraFov'
  | 'scalePresets'
  | 'planetScale'
  | 'sunScale'
  | 'orbitLineWidth'
  | 'orbitSamples'
  | 'orbitMaxPoints'
  | 'quantum'
  | 'animatedSky'
  | 'skyTwinkle'
  | 'labelOcclusion'
  | 'bodyFixedAxes'
  | 'renderHud'
  | 'j2000Axes'

const ADVANCED_PANES: Array<{ id: AdvancedPaneId; tabLabel: string; title: string; summary: string }> = [
  {
    id: 'time',
    tabLabel: 'TIME',
    title: 'TIME',
    summary: 'UTC/ET display, scrubber, and playback controls.',
  },
  {
    id: 'scale',
    tabLabel: 'SCALE',
    title: 'SCALE',
    summary: 'Scale presets and zoom range controls.',
  },
  {
    id: 'guides',
    tabLabel: 'GUIDES',
    title: 'GUIDES',
    summary: 'Focus target, labels, axes, and visual overlays.',
  },
  {
    id: 'orbits',
    tabLabel: 'ORBITS',
    title: 'ORBITS',
    summary: 'Orbit line fidelity vs speed. These settings can strongly affect CPU/GPU and memory.',
  },
  {
    id: 'performance',
    tabLabel: 'PERFORMANCE',
    title: 'PERFORMANCE',
    summary: 'Optional effects and overlays that may impact FPS or battery.',
  },
  {
    id: 'rendering',
    tabLabel: 'RENDERING',
    title: 'RENDERING',
    summary: 'Sun postprocessing and lighting/emissive tuning.',
  },
]

const ADVANCED_HELP: Record<AdvancedHelpTopicId, { title: string; short: string; body: string[] }> = {
  zoom: {
    title: 'Zoom',
    short: 'Adjust camera distance (same as wheel/pinch zoom).',
    body: [
      "Zoom controls the camera's distance from the current target.",
      'It is equivalent to using the scroll wheel (desktop) or pinch gesture (touch).',
      'The available zoom range depends on the current scale preset.',
    ],
  },
  cameraFov: {
    title: 'Camera FOV',
    short: 'Wider = more scene, narrower = more zoom.',
    body: [
      'Field-of-view controls how wide the camera sees (like a lens).',
      'Lower values feel more zoomed-in; higher values feel wider/"fisheye".',
      'This does not change body positions—only how the camera projects the scene.',
    ],
  },
  scalePresets: {
    title: 'Scale presets',
    short: 'Quickly switch between common scale + zoom ranges.',
    body: [
      'Planetary: realistic-ish body sizes and a tighter zoom range (good for close-up planet/moon views).',
      'Solar: heavily exaggerated body sizes and a much larger zoom range (good for seeing planets at AU-scale distances).',
      'Presets only affect rendering + camera zoom limits; SPICE data is unchanged.',
    ],
  },
  planetScale: {
    title: 'Planet scale',
    short: 'Makes planets easier to see/click.',
    body: [
      'Boosts the rendered size of planets and moons (everything except the Sun).',
      'Useful when zoomed far out or when focusing the Sun (so nearby planets are still clickable).',
      'This is a visual exaggeration only; orbits/positions remain physically accurate.',
    ],
  },
  sunScale: {
    title: 'Sun scale',
    short: 'Helps keep the Sun visible at long distances.',
    body: [
      'Boosts the rendered radius of the Sun only.',
      'Useful when focusing outer planets so the Sun stays visible and easier to locate.',
      'Visual-only; SPICE positions are unchanged.',
    ],
  },
  orbitLineWidth: {
    title: 'Orbit line width',
    short: 'Thicker lines are easier to see (slightly heavier to draw).',
    body: [
      'Controls the on-screen thickness of orbit paths.',
      'Higher values are more visible but can look busy and may cost a bit of GPU time.',
    ],
  },
  orbitSamples: {
    title: 'Samples per orbit',
    short: 'More samples = smoother orbits, slower updates.',
    body: [
      'Number of points used to approximate each orbit path.',
      'Higher values produce smoother curves but increase CPU work and memory.',
      'If performance drops, lower this first.',
    ],
  },
  orbitMaxPoints: {
    title: 'Max orbit points',
    short: 'Hard cap to keep orbit rendering bounded.',
    body: [
      'Caps the total number of orbit points kept across all bodies.',
      'If you enable many orbits or use high samples-per-orbit, this prevents runaway memory use.',
      'Lower values can improve performance but may reduce orbit detail.',
    ],
  },
  quantum: {
    title: 'Quantum (s)',
    short: 'Minimum time step used by stepping/playback.',
    body: [
      'Sets the smallest time increment used when stepping simulation time.',
      'Smaller values make stepping finer-grained but can increase work per second of playback.',
    ],
  },
  animatedSky: {
    title: 'Milky Way',
    short: 'Toggle the background Milky Way skydome (can cost GPU).',
    body: [
      'Enables the Milky Way skydome shader.',
      'Turn off for maximum performance, to reduce motion, or for deterministic screenshots.',
    ],
  },
  skyTwinkle: {
    title: 'Sky twinkle',
    short: 'Twinkling stars (adds a lightweight RAF loop).',
    body: ['Enables star twinkle in the background sky.', 'Turn off to reduce motion or slightly reduce GPU/CPU work.'],
  },
  labelOcclusion: {
    title: 'Label occlusion',
    short: 'Hide labels behind planets to reduce clutter.',
    body: [
      'When enabled, labels will hide when the body is behind something else in the scene.',
      'This can reduce clutter when many labels overlap, but may hide labels you expect to see.',
    ],
  },
  bodyFixedAxes: {
    title: 'Body-fixed axes',
    short: 'Axes that rotate with the selected body.',
    body: [
      'Shows a local coordinate frame that rotates with the focused body.',
      'Useful for understanding rotation/orientation compared to inertial axes.',
    ],
  },
  renderHud: {
    title: 'Render HUD',
    short: 'FPS + draw calls + camera stats overlay.',
    body: [
      'Shows a small on-screen heads-up display with render performance stats and camera values.',
      'Useful for debugging and performance tuning.',
    ],
  },
  j2000Axes: {
    title: 'J2000 axes',
    short: 'Global inertial reference frame axes.',
    body: [
      'Shows a fixed inertial axes widget (J2000 frame) for orientation reference.',
      'This is separate from body-fixed axes, which rotate with a body.',
    ],
  },
}

function AdvancedHelpButton({
  topic,
  onOpen,
}: {
  topic: AdvancedHelpTopicId
  onOpen: (topic: AdvancedHelpTopicId) => void
}) {
  const h = ADVANCED_HELP[topic]
  return (
    <button
      className="controlHelpButton"
      onClick={() => onOpen(topic)}
      type="button"
      aria-label={`Help: ${h.title}`}
      title={h.short}
    >
      ?
    </button>
  )
}

const HOME_PRESET_RADII = HOME_PRESET_KEYS.map((k) => getHomePresetStateForKey(k).radius)
const HOME_PRESET_RADIUS_MIN = Math.min(...HOME_PRESET_RADII)
const HOME_PRESET_RADIUS_MAX = Math.max(...HOME_PRESET_RADII)

// Shared camera zoom limits used across both the "planetary" and "solar" scale
// presets.
//
// Keeping these consistent avoids partitioning the zoom spectrum (where changing
// presets silently remaps wheel/pinch/slider sensitivity).
const CAMERA_RADIUS_LIMITS = {
  minRadius: HOME_PRESET_RADIUS_MIN * 0.25,
  maxRadius: HOME_PRESET_RADIUS_MAX * 20_000,
} as const

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const controllerRef = useRef<CameraController | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const invalidateRef = useRef<(() => void) | null>(null)
  const renderOnceRef = useRef<((timeMs?: number) => void) | null>(null)
  const skyAnimationActiveRef = useRef(false)
  const cancelFocusTweenRef = useRef<(() => void) | null>(null)

  const rendererRuntimeRef = useRef<ThreeRuntime | null>(null)

  const runtimeConfig = useMemo(() => parseSceneCanvasRuntimeConfigFromLocationSearch(window.location.search), [])

  const {
    searchParams: search,
    isE2e,
    enableLogDepth,
    starSeed,
    animatedSky: animatedSkyDefault,
    skyTwinkle: skyTwinkleDefault,
    initialUtc,
    initialEt,
    sunPostprocessMode,
    sunExposure,
    sunToneMap,
    sunBloomThreshold,
    sunBloomStrength,
    sunBloomRadius,
    sunBloomResolutionScale,
  } = runtimeConfig

  const [focusBody, setFocusBody] = useState<BodyRef>('EARTH')
  const [showJ2000Axes, setShowJ2000Axes] = useState(false)
  const [showBodyFixedAxes, setShowBodyFixedAxes] = useState(false)
  // Selected body (promoted from local closure variable for inspector panel)
  const [selectedBody, setSelectedBody] = useState<BodyRef | null>(null)
  const [spiceClient, setSpiceClient] = useState<SpiceClient | null>(null)

  // Sun postprocess tuning (ephemeral; adjustable live via the RENDERING pane).
  const [sunPostprocessExposure, setSunPostprocessExposure] = useState(sunExposure)
  const [sunPostprocessToneMap, setSunPostprocessToneMap] = useState(sunToneMap)
  const [sunPostprocessBloomThreshold, setSunPostprocessBloomThreshold] = useState(sunBloomThreshold)
  const [sunPostprocessBloomStrength, setSunPostprocessBloomStrength] = useState(sunBloomStrength)
  const [sunPostprocessBloomRadius, setSunPostprocessBloomRadius] = useState(sunBloomRadius)
  const [sunPostprocessBloomResolutionScale, setSunPostprocessBloomResolutionScale] = useState(sunBloomResolutionScale)

  // Advanced tuning sliders (ephemeral, local state only)
  const [advancedPane, setAdvancedPane] = useState<AdvancedPaneId>('time')
  const [advancedHelpTopic, setAdvancedHelpTopic] = useState<AdvancedHelpTopicId | null>(null)

  const controlsTabsId = useId()

  const activeAdvancedPane = useMemo(() => {
    const found = ADVANCED_PANES.find((p) => p.id === advancedPane)
    if (found) return found

    const fallback = ADVANCED_PANES[0]
    if (fallback) return fallback

    // Defensive fallback: keep the UI from crashing if the panes list ever
    // becomes empty/conditional.
    const label = advancedPane.toUpperCase()
    return { id: advancedPane, tabLabel: label, title: label, summary: '' }
  }, [advancedPane])

  const [cameraFovDeg, setCameraFovDeg] = useState(50)

  const earthAppearanceDefaults = useMemo(() => {
    const layers = getBodyRegistryEntry('EARTH').style.appearance?.layers
    return layers?.find(isEarthAppearanceLayer)?.earth
  }, [])

  // Lighting + Sun appearance defaults.
  const AMBIENT_LIGHT_INTENSITY_DEFAULT = 0.45
  const SUN_LIGHT_INTENSITY_DEFAULT = 3.5
  // Sun emissive is in addition to the base texture `kind: 'sun'`.
  const SUN_EMISSIVE_INTENSITY_DEFAULT = 10
  const SUN_EMISSIVE_COLOR_DEFAULT = '#ffcc55'

  const [ambientLightIntensity, setAmbientLightIntensity] = useState(AMBIENT_LIGHT_INTENSITY_DEFAULT)
  const [sunLightIntensity, setSunLightIntensity] = useState(SUN_LIGHT_INTENSITY_DEFAULT)
  const [sunEmissiveIntensity, setSunEmissiveIntensity] = useState(SUN_EMISSIVE_INTENSITY_DEFAULT)
  const [sunEmissiveColor, setSunEmissiveColor] = useState(SUN_EMISSIVE_COLOR_DEFAULT)
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

  // Sky effects.
  const [animatedSky, setAnimatedSky] = useState(animatedSkyDefault)

  // Star twinkle is separate from the Milky Way toggle.
  const [skyTwinkle, setSkyTwinkle] = useState(skyTwinkleDefault)

  const twinkleEnabled = skyTwinkle && !isE2e
  const skyAnimationActive = (animatedSky || twinkleEnabled) && !isE2e

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

  const planetScaleSliderForMultiplier = useCallback(
    (multiplier: number) => {
      if (!Number.isFinite(multiplier) || multiplier <= 1) return 0

      const raw = 20 * Math.log10(multiplier)
      return THREE.MathUtils.clamp(Math.round(raw), 0, PLANET_SCALE_SLIDER_MAX)
    },
    [PLANET_SCALE_SLIDER_MAX],
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
    sunPostprocessMode,
    sunExposure,
    sunToneMap,
    sunBloomThreshold,
    sunBloomStrength,
    sunBloomRadius,
    sunBloomResolutionScale,
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
  const skipAutoZoomForNextFocusBodyRef = useRef<BodyRef | null>(null)
  const initialPlanetaryRadiusRef = useRef<number | null>(null)

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

  // Camera zoom (controller.radius) exposed as a log-scale slider.
  // 0 = closest (zoom in), 100 = farthest (zoom out).
  const [zoomSlider, setZoomSlider] = useState(50)
  const zoomSliderDraggingRef = useRef(false)
  const zoomSliderPendingValueRef = useRef<number | null>(null)
  const zoomSliderRafRef = useRef<number | null>(null)

  const formatZoomSliderPercent = (v: number) => {
    const s = v.toFixed(1).replace(/\.0$/, '')
    return `${s}%`
  }

  const zoomSliderForRadius = useCallback((radius: number, minRadius: number, maxRadius: number) => {
    const r = THREE.MathUtils.clamp(radius, minRadius, maxRadius)
    const minL = Math.log(minRadius)
    const maxL = Math.log(maxRadius)
    const t = (Math.log(r) - minL) / (maxL - minL)
    // Use half-steps for smoother dragging without overloading the controller.
    return THREE.MathUtils.clamp(Math.round(t * 200) / 2, 0, 100)
  }, [])

  const radiusForZoomSlider = useCallback((slider: number, minRadius: number, maxRadius: number) => {
    const minL = Math.log(minRadius)
    const maxL = Math.log(maxRadius)
    const t = THREE.MathUtils.clamp(slider, 0, 100) / 100
    return Math.exp(minL + t * (maxL - minL))
  }, [])

  useEffect(() => {
    if (!overlayOpen) return

    // Poll occasionally so the slider stays in sync with wheel/pinch/keyboard zoom
    // without re-rendering every animation frame.
    const interval = window.setInterval(() => {
      const controller = controllerRef.current
      if (!controller) return

      if (zoomSliderDraggingRef.current) return

      const next = zoomSliderForRadius(controller.radius, controller.minRadius, controller.maxRadius)
      setZoomSlider((prev) => (Math.abs(prev - next) >= 0.5 ? next : prev))
    }, 200)

    return () => {
      window.clearInterval(interval)

      // Ensure we don't apply stale zoom work after close/unmount.
      if (zoomSliderRafRef.current != null) {
        window.cancelAnimationFrame(zoomSliderRafRef.current)
        zoomSliderRafRef.current = null
      }
      zoomSliderPendingValueRef.current = null
      zoomSliderDraggingRef.current = false
    }
  }, [overlayOpen, zoomSliderForRadius])

  const applyZoomSliderValue = useCallback(
    (value: number) => {
      const controller = controllerRef.current
      const camera = cameraRef.current
      if (!controller || !camera) return

      cancelFocusTweenRef.current?.()

      controller.radius = radiusForZoomSlider(value, controller.minRadius, controller.maxRadius)
      controller.applyToCamera(camera)
      invalidateRef.current?.()
    },
    [radiusForZoomSlider],
  )

  const scheduleApplyZoomSliderValue = useCallback(
    (value: number) => {
      zoomSliderPendingValueRef.current = value
      if (zoomSliderRafRef.current != null) return

      zoomSliderRafRef.current = window.requestAnimationFrame(() => {
        zoomSliderRafRef.current = null
        const pending = zoomSliderPendingValueRef.current
        if (pending == null) return
        zoomSliderPendingValueRef.current = null
        applyZoomSliderValue(pending)
      })
    },
    [applyZoomSliderValue],
  )

  const flushZoomSlider = useCallback(() => {
    const pending = zoomSliderPendingValueRef.current
    if (pending == null) return

    zoomSliderPendingValueRef.current = null

    if (zoomSliderRafRef.current != null) {
      window.cancelAnimationFrame(zoomSliderRafRef.current)
      zoomSliderRafRef.current = null
    }
    applyZoomSliderValue(pending)
  }, [applyZoomSliderValue])

  const handleZoomSliderInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value)
      setZoomSlider(value)
      scheduleApplyZoomSliderValue(value)
    },
    [scheduleApplyZoomSliderValue],
  )

  const applyScalePreset = useCallback(
    (preset: 'planetary' | 'solar') => {
      cancelFocusTweenRef.current?.()

      const controller = controllerRef.current
      const camera = cameraRef.current
      if (!controller || !camera) return

      // Cancel any in-flight slider drag/apply so preset changes are immediate.
      zoomSliderDraggingRef.current = false
      zoomSliderPendingValueRef.current = null
      if (zoomSliderRafRef.current != null) {
        window.cancelAnimationFrame(zoomSliderRafRef.current)
        zoomSliderRafRef.current = null
      }

      if (preset === 'planetary') {
        // True-ish scale.
        setPlanetScaleSlider(planetScaleSliderForMultiplier(1))
        setSunScaleMultiplier(1)
      } else {
        // Aggressive exaggeration for AU-scale viewing.
        setPlanetScaleSlider(planetScaleSliderForMultiplier(800))
        setSunScaleMultiplier(12)
      }

      // Keep zoom limits consistent across presets so wheel/pinch/slider mapping
      // stays predictable.
      controller.setRadiusLimits(CAMERA_RADIUS_LIMITS)

      if (preset === 'planetary') {
        // The solar preset intentionally refocuses on the Sun; when switching back
        // to planetary scale, return to the default Earth-centric view.
        setFocusBody('EARTH')

        // Return to the same zoom level as initial page load.
        const initialRadius = initialPlanetaryRadiusRef.current
        if (initialRadius != null) {
          controller.radius = THREE.MathUtils.clamp(initialRadius, controller.minRadius, controller.maxRadius)
        }
      }

      if (preset === 'solar') {
        // Solar scale is intended for AU-scale viewing, so:
        // - focus the Sun (center the scene)
        // - zoom out to a reasonable baseline distance (~80% on the zoom slider)
        if (String(focusBodyRef.current) !== 'SUN') {
          // `initSpiceSceneRuntime.updateScene` will normally auto-zoom (and/or
          // apply a home preset) whenever focus changes. For the Solar scale
          // preset we explicitly choose a zoom baseline, so skip that behavior
          // once for this focus change.
          skipAutoZoomForNextFocusBodyRef.current = 'SUN'
        }
        setFocusBody('SUN')
        controller.radius = THREE.MathUtils.clamp(
          radiusForZoomSlider(80, controller.minRadius, controller.maxRadius),
          controller.minRadius,
          controller.maxRadius,
        )
      }

      // Keep slider UI in-sync immediately (no need to wait for the overlay polling interval).
      setZoomSlider(zoomSliderForRadius(controller.radius, controller.minRadius, controller.maxRadius))

      controller.applyToCamera(camera)
      invalidateRef.current?.()
    },
    [planetScaleSliderForMultiplier, radiusForZoomSlider, zoomSliderForRadius],
  )

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
        sunEmissiveIntensity: number
        sunEmissiveColor: string

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
    sunEmissiveIntensity,
    sunEmissiveColor,
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
    sunEmissiveIntensity,
    sunEmissiveColor,
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
      sunEmissiveIntensity,
      sunEmissiveColor,
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
    sunEmissiveIntensity,
    sunEmissiveColor,
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
      sunPostprocess: {
        mode: initRuntimeConfigRef.current.sunPostprocessMode,
        exposure: initRuntimeConfigRef.current.sunExposure,
        toneMap: initRuntimeConfigRef.current.sunToneMap,
        bloom: {
          threshold: initRuntimeConfigRef.current.sunBloomThreshold,
          strength: initRuntimeConfigRef.current.sunBloomStrength,
          radius: initRuntimeConfigRef.current.sunBloomRadius,
          resolutionScale: initRuntimeConfigRef.current.sunBloomResolutionScale,
        },
      },
      skyAnimationActiveRef,
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

    // Capture the initial radius (planetary default) so switching back to the
    // planetary scale preset can reliably restore the original zoom.
    if (initialPlanetaryRadiusRef.current == null) {
      initialPlanetaryRadiusRef.current = three.controller.radius
    }

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
        selectionOverlay: three.selectionOverlay,
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
          skipAutoZoomForNextFocusBodyRef,
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

        // -------------------------------------------------------------------
        // E2E API: phase 0 guardrails for appearance iteration
        // -------------------------------------------------------------------
        // Note: this runs only in `?e2e=1` mode, and does not affect runtime visuals.
        if (isE2e) {
          type CameraPreset = 'sun-close' | 'sun-medium' | 'sun-far'

          const SUN_CAMERA_PRESETS: Record<CameraPreset, { radius: number; yaw: number; pitch: number }> = {
            // Sun radius is ~0.696 world units with `kmToWorld=1e-6`.
            // These distances keep the sun comfortably within a 50° FOV.
            'sun-close': { radius: 2.0, yaw: 0.85, pitch: 0.35 },
            'sun-medium': { radius: 6.0, yaw: 0.85, pitch: 0.35 },
            'sun-far': { radius: 18.0, yaw: 0.85, pitch: 0.35 },
          }

          let lastPerfSample: {
            cpuFrameMs: number
            drawCalls: number
            triangles: number
            textures: number
          } | null = null

          const samplePerfCounters = () => {
            const t0 = performance.now()
            three.renderOnce()
            const t1 = performance.now()

            const info = three.renderer.info
            lastPerfSample = {
              cpuFrameMs: t1 - t0,
              drawCalls: info.render.calls,
              triangles: info.render.triangles,
              textures: info.memory.textures,
            }

            return lastPerfSample
          }

          const lockDeterministicLighting = () => {
            // Scene lighting is controlled via UI state (even though the UI knobs
            // are currently not exposed). Lock these values explicitly so future
            // tuning does not silently invalidate golden images.
            const etSec = timeStore.getState().etSec
            updateSceneRef.current?.({
              etSec,
              ...latestUiRef.current,
              ambientLightIntensity: 0.2,
              sunLightIntensity: 2.0,
            })
          }

          const setCameraPreset = (preset: CameraPreset) => {
            // Ensure we are rebased around the Sun so the camera target at origin
            // is always the Sun's center.
            const etSec = timeStore.getState().etSec
            updateSceneRef.current?.({
              etSec,
              ...latestUiRef.current,
              focusBody: 'SUN',
            })

            const { radius, yaw, pitch } = SUN_CAMERA_PRESETS[preset]
            three.controller.restore({
              target: new THREE.Vector3(0, 0, 0),
              radius,
              yaw,
              pitch,
              lookYaw: 0,
              lookPitch: 0,
              lookRoll: 0,
            })
            three.controller.applyToCamera(three.camera)

            // Render synchronously so Playwright can capture immediately.
            samplePerfCounters()
          }

          const api = window.__tspice_viewer__e2e
          if (!api) throw new Error('e2e API not initialized: __tspice_viewer__e2e')

          api.setCameraPreset = setCameraPreset
          api.lockDeterministicLighting = lockDeterministicLighting
          api.samplePerfCounters = samplePerfCounters
          api.getLastPerfCounters = () => lastPerfSample
        }

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

  // Swap the background elements in-place when toggled.
  useEffect(() => {
    rendererRuntimeRef.current?.updateSky({ animatedSky, twinkleEnabled, isE2e })
  }, [animatedSky, twinkleEnabled, isE2e])

  // Live-tune Sun postprocessing in-place (no reload / query params).
  useEffect(() => {
    if (isE2e) return

    rendererRuntimeRef.current?.updateSunPostprocess({
      exposure: sunPostprocessExposure,
      toneMap: sunPostprocessToneMap,
      bloom: {
        threshold: sunPostprocessBloomThreshold,
        strength: sunPostprocessBloomStrength,
        radius: sunPostprocessBloomRadius,
        resolutionScale: sunPostprocessBloomResolutionScale,
      },
    })
  }, [
    isE2e,
    sunPostprocessExposure,
    sunPostprocessToneMap,
    sunPostprocessBloomThreshold,
    sunPostprocessBloomStrength,
    sunPostprocessBloomRadius,
    sunPostprocessBloomResolutionScale,
  ])

  // Lightweight RAF loop for sky animation (twinkle and/or skydome shader).
  useEffect(() => {
    skyAnimationActiveRef.current = skyAnimationActive

    if (!skyAnimationActive) return

    let frame: number | null = null
    const tick = (t: number) => {
      if (!skyAnimationActiveRef.current) return
      renderOnceRef.current?.(t)
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame)
    }
  }, [skyAnimationActive])

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
              <div className="advancedPanel">
                <div className="advancedTabs" role="tablist" aria-label="Controls panes">
                  {ADVANCED_PANES.map((pane) => {
                    const tabId = `${controlsTabsId}-tab-${pane.id}`
                    const panelId = `${controlsTabsId}-panel-${pane.id}`

                    return (
                      <button
                        key={pane.id}
                        id={tabId}
                        className={`advancedTab ${advancedPane === pane.id ? 'advancedTabActive' : ''}`}
                        type="button"
                        role="tab"
                        aria-selected={advancedPane === pane.id}
                        aria-controls={panelId}
                        tabIndex={advancedPane === pane.id ? 0 : -1}
                        onClick={() => setAdvancedPane(pane.id)}
                      >
                        {pane.tabLabel}
                      </button>
                    )
                  })}
                </div>

                <div className="advancedPaneHeader">
                  <div className="advancedPaneTitle">{activeAdvancedPane.title}</div>
                  <div className="advancedPaneSummary">{activeAdvancedPane.summary}</div>
                </div>

                {/* Pane: SCALE */}
                {advancedPane === 'scale' ? (
                  <div
                    className="advancedGroup"
                    role="tabpanel"
                    id={`${controlsTabsId}-panel-scale`}
                    aria-labelledby={`${controlsTabsId}-tab-scale`}
                  >
                    <div className="controlsSection">
                      <div className="advancedSlider">
                        <span className="advancedSliderLabel advancedControlLabel">
                          <span>Presets</span>
                          <AdvancedHelpButton topic="scalePresets" onOpen={setAdvancedHelpTopic} />
                        </span>
                        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                          <button
                            className="advancedTab"
                            type="button"
                            onClick={() => applyScalePreset('planetary')}
                            title="Planetary scale preset"
                          >
                            planetary
                          </button>
                          <button
                            className="advancedTab"
                            type="button"
                            onClick={() => applyScalePreset('solar')}
                            title="Solar scale preset"
                          >
                            solar
                          </button>
                        </div>
                        <span className="advancedSliderValue" />
                      </div>
                    </div>

                    <div className="advancedDivider" />

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel advancedControlLabel">
                        <span>Planet Scale</span>
                        <AdvancedHelpButton topic="planetScale" onOpen={setAdvancedHelpTopic} />
                      </span>
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
                      <span className="advancedSliderLabel advancedControlLabel">
                        <span>Sun Scale</span>
                        <AdvancedHelpButton topic="sunScale" onOpen={setAdvancedHelpTopic} />
                      </span>
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

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel advancedControlLabel">
                        <span>Zoom</span>
                        <AdvancedHelpButton topic="zoom" onOpen={setAdvancedHelpTopic} />
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.5}
                        value={zoomSlider}
                        onChange={handleZoomSliderInput}
                        onPointerDown={() => {
                          zoomSliderDraggingRef.current = true
                        }}
                        onPointerUp={() => {
                          zoomSliderDraggingRef.current = false
                          flushZoomSlider()
                        }}
                        onPointerCancel={() => {
                          zoomSliderDraggingRef.current = false
                          flushZoomSlider()
                        }}
                        onBlur={() => {
                          zoomSliderDraggingRef.current = false
                          flushZoomSlider()
                        }}
                        onKeyUp={() => flushZoomSlider()}
                      />
                      <span className="advancedSliderValue">{formatZoomSliderPercent(zoomSlider)}</span>
                    </div>

                    <div className="advancedDivider" />

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel advancedControlLabel">
                        <span>Camera FOV</span>
                        <AdvancedHelpButton topic="cameraFov" onOpen={setAdvancedHelpTopic} />
                      </span>
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
                  </div>
                ) : null}

                {/* Pane: ORBITS */}
                {advancedPane === 'orbits' ? (
                  <div
                    className="advancedGroup"
                    role="tabpanel"
                    id={`${controlsTabsId}-panel-orbits`}
                    aria-labelledby={`${controlsTabsId}-tab-orbits`}
                  >
                    <label className="asciiCheckbox">
                      <input
                        className="asciiCheckboxInput"
                        type="checkbox"
                        checked={orbitPathsEnabled}
                        onChange={(e) => setOrbitPathsEnabled(e.target.checked)}
                      />
                      <span className="asciiCheckboxBox" aria-hidden="true" />
                      <span className="asciiCheckboxLabel">Orbit Paths</span>
                    </label>

                    <fieldset
                      disabled={!orbitPathsEnabled}
                      className={`advancedFieldset ${!orbitPathsEnabled ? 'advancedFieldsetDisabled' : ''}`}
                    >
                      <div className="advancedSlider">
                        <span className="advancedSliderLabel advancedControlLabel">
                          <span>Orbit Line Width</span>
                          <AdvancedHelpButton topic="orbitLineWidth" onOpen={setAdvancedHelpTopic} />
                        </span>
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
                        <span className="advancedSliderLabel advancedControlLabel">
                          <span>Samples / Orbit</span>
                          <AdvancedHelpButton topic="orbitSamples" onOpen={setAdvancedHelpTopic} />
                        </span>
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
                        <span className="advancedSliderLabel advancedControlLabel">
                          <span>Max Orbit Points</span>
                          <AdvancedHelpButton topic="orbitMaxPoints" onOpen={setAdvancedHelpTopic} />
                        </span>
                        <input
                          type="number"
                          min={256}
                          step={256}
                          value={orbitMaxTotalPoints}
                          onChange={(e) => setOrbitMaxTotalPoints(Number(e.target.value))}
                        />
                      </div>
                    </fieldset>
                  </div>
                ) : null}

                {/* Pane: TIME */}
                {advancedPane === 'time' ? (
                  <div
                    className="advancedGroup"
                    role="tabpanel"
                    id={`${controlsTabsId}-panel-time`}
                    aria-labelledby={`${controlsTabsId}-tab-time`}
                  >
                    {/* Playback controls: UTC/ET display, scrubber, buttons, rate */}
                    <PlaybackControls spiceClient={spiceClient} />

                    <div className="advancedDivider" />

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel advancedControlLabel">
                        <span>Quantum (s)</span>
                        <AdvancedHelpButton topic="quantum" onOpen={setAdvancedHelpTopic} />
                      </span>
                      <input type="number" min={0.001} step={0.01} value={quantumSec} onChange={handleQuantumChange} />
                      <span className="advancedSliderValue" />
                    </div>
                  </div>
                ) : null}

                {/* Pane: GUIDES */}
                {advancedPane === 'guides' ? (
                  <div
                    className="advancedGroup"
                    role="tabpanel"
                    id={`${controlsTabsId}-panel-guides`}
                    aria-labelledby={`${controlsTabsId}-tab-guides`}
                  >
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
                        <span className="asciiBtnContent">
                          {String(focusBody) === 'SUN' ? 'focus sun' : 'Focus Sun'}
                        </span>
                        <span className="asciiBtnBracket">]</span>
                      </button>
                    </div>

                    <div className="advancedDivider" />

                    <label className="asciiCheckbox">
                      <input
                        className="asciiCheckboxInput"
                        type="checkbox"
                        checked={labelsEnabled}
                        onChange={(e) => setLabelsEnabled(e.target.checked)}
                      />
                      <span className="asciiCheckboxBox" aria-hidden="true" />
                      <span className="asciiCheckboxLabel">Labels</span>
                    </label>

                    <div className="advancedCheckboxWithHelp">
                      <label className="asciiCheckbox">
                        <input
                          className="asciiCheckboxInput"
                          type="checkbox"
                          checked={labelOcclusionEnabled}
                          onChange={(e) => setLabelOcclusionEnabled(e.target.checked)}
                        />
                        <span className="asciiCheckboxBox" aria-hidden="true" />
                        <span className="asciiCheckboxLabel">Label Occlusion</span>
                      </label>
                      <AdvancedHelpButton topic="labelOcclusion" onOpen={setAdvancedHelpTopic} />
                    </div>

                    <div className="advancedCheckboxWithHelp">
                      <label className="asciiCheckbox">
                        <input
                          className="asciiCheckboxInput"
                          type="checkbox"
                          checked={showBodyFixedAxes}
                          onChange={(e) => setShowBodyFixedAxes(e.target.checked)}
                        />
                        <span className="asciiCheckboxBox" aria-hidden="true" />
                        <span className="asciiCheckboxLabel">Body-fixed Axes</span>
                      </label>
                      <AdvancedHelpButton topic="bodyFixedAxes" onOpen={setAdvancedHelpTopic} />
                    </div>

                    <div className="advancedCheckboxWithHelp">
                      <label className="asciiCheckbox">
                        <input
                          className="asciiCheckboxInput"
                          type="checkbox"
                          checked={showJ2000Axes}
                          onChange={(e) => setShowJ2000Axes(e.target.checked)}
                        />
                        <span className="asciiCheckboxBox" aria-hidden="true" />
                        <span className="asciiCheckboxLabel">J2000 Axes</span>
                      </label>
                      <AdvancedHelpButton topic="j2000Axes" onOpen={setAdvancedHelpTopic} />
                    </div>
                  </div>
                ) : null}

                {/* Pane: PERFORMANCE */}
                {advancedPane === 'performance' ? (
                  <div
                    className="advancedGroup"
                    role="tabpanel"
                    id={`${controlsTabsId}-panel-performance`}
                    aria-labelledby={`${controlsTabsId}-tab-performance`}
                  >
                    <div className="advancedCheckboxWithHelp">
                      <label className="asciiCheckbox">
                        <input
                          className="asciiCheckboxInput"
                          type="checkbox"
                          checked={animatedSky}
                          onChange={(e) => setAnimatedSky(e.target.checked)}
                        />
                        <span className="asciiCheckboxBox" aria-hidden="true" />
                        <span className="asciiCheckboxLabel">Milky Way</span>
                      </label>
                      <AdvancedHelpButton topic="animatedSky" onOpen={setAdvancedHelpTopic} />
                    </div>

                    <div className="advancedCheckboxWithHelp">
                      <label className="asciiCheckbox">
                        <input
                          className="asciiCheckboxInput"
                          type="checkbox"
                          checked={skyTwinkle}
                          onChange={(e) => setSkyTwinkle(e.target.checked)}
                        />
                        <span className="asciiCheckboxBox" aria-hidden="true" />
                        <span className="asciiCheckboxLabel">Sky Twinkle</span>
                      </label>
                      <AdvancedHelpButton topic="skyTwinkle" onOpen={setAdvancedHelpTopic} />
                    </div>

                    <div className="advancedDivider" />

                    <div className="advancedCheckboxWithHelp">
                      <label className="asciiCheckbox">
                        <input
                          className="asciiCheckboxInput"
                          type="checkbox"
                          checked={showRenderHud}
                          onChange={(e) => setShowRenderHud(e.target.checked)}
                        />
                        <span className="asciiCheckboxBox" aria-hidden="true" />
                        <span className="asciiCheckboxLabel">Render HUD</span>
                      </label>
                      <AdvancedHelpButton topic="renderHud" onOpen={setAdvancedHelpTopic} />
                    </div>
                  </div>
                ) : null}

                {/* Pane: RENDERING */}
                {advancedPane === 'rendering' ? (
                  <div
                    className="advancedGroup"
                    role="tabpanel"
                    id={`${controlsTabsId}-panel-rendering`}
                    aria-labelledby={`${controlsTabsId}-tab-rendering`}
                  >
                    <div className="controlsSection">
                      <button
                        className="asciiBtn asciiBtnWide"
                        type="button"
                        onClick={() => {
                          setSunPostprocessExposure(sunExposure)
                          setSunPostprocessToneMap(sunToneMap)
                          setSunPostprocessBloomThreshold(sunBloomThreshold)
                          setSunPostprocessBloomStrength(sunBloomStrength)
                          setSunPostprocessBloomRadius(sunBloomRadius)
                          setSunPostprocessBloomResolutionScale(sunBloomResolutionScale)
                          setAmbientLightIntensity(AMBIENT_LIGHT_INTENSITY_DEFAULT)
                          setSunLightIntensity(SUN_LIGHT_INTENSITY_DEFAULT)
                          setSunEmissiveIntensity(SUN_EMISSIVE_INTENSITY_DEFAULT)
                          setSunEmissiveColor(SUN_EMISSIVE_COLOR_DEFAULT)
                        }}
                        title="Reset rendering settings"
                      >
                        <span className="asciiBtnBracket">[</span>
                        <span className="asciiBtnContent">Reset</span>
                        <span className="asciiBtnBracket">]</span>
                      </button>
                    </div>

                    <div className="advancedDivider" />

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Exposure</span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={0.01}
                        value={sunPostprocessExposure}
                        onChange={(e) => setSunPostprocessExposure(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunPostprocessExposure.toFixed(2)}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Tone map</span>
                      <select
                        className="focusSelect"
                        value={sunPostprocessToneMap}
                        onChange={(e) => setSunPostprocessToneMap(e.target.value as typeof sunToneMap)}
                      >
                        <option value="none">none</option>
                        <option value="filmic">filmic</option>
                        <option value="acesLike">acesLike</option>
                      </select>
                      <span className="advancedSliderValue" />
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Bloom threshold</span>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.01}
                        value={sunPostprocessBloomThreshold}
                        onChange={(e) => setSunPostprocessBloomThreshold(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunPostprocessBloomThreshold.toFixed(2)}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Bloom strength</span>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
                        value={sunPostprocessBloomStrength}
                        onChange={(e) => setSunPostprocessBloomStrength(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunPostprocessBloomStrength.toFixed(2)}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Bloom radius</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={sunPostprocessBloomRadius}
                        onChange={(e) => setSunPostprocessBloomRadius(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunPostprocessBloomRadius.toFixed(2)}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Bloom res scale</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={sunPostprocessBloomResolutionScale}
                        onChange={(e) => setSunPostprocessBloomResolutionScale(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunPostprocessBloomResolutionScale.toFixed(2)}</span>
                    </div>

                    <div className="advancedDivider" />

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Ambient light</span>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
                        value={ambientLightIntensity}
                        onChange={(e) => setAmbientLightIntensity(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{ambientLightIntensity.toFixed(2)}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Sun light</span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={0.1}
                        value={sunLightIntensity}
                        onChange={(e) => setSunLightIntensity(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunLightIntensity.toFixed(1)}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Sun emissive</span>
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={0.1}
                        value={sunEmissiveIntensity}
                        onChange={(e) => setSunEmissiveIntensity(Number(e.target.value))}
                      />
                      <span className="advancedSliderValue">{sunEmissiveIntensity.toFixed(1)}</span>
                    </div>

                    <div className="advancedSlider">
                      <span className="advancedSliderLabel">Emissive color</span>
                      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="color"
                          value={sunEmissiveColor}
                          onChange={(e) => setSunEmissiveColor(e.target.value)}
                          aria-label="Sun emissive color"
                        />
                        <input
                          className="advancedTextInput"
                          type="text"
                          value={sunEmissiveColor}
                          onChange={(e) => setSunEmissiveColor(e.target.value)}
                        />
                      </div>
                      <span className="advancedSliderValue" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Selection Inspector - shows when a body is selected */}
      {!isE2e && selectedBody && spiceClient ? (
        <SelectionInspector
          selectedBody={selectedBody}
          focusBody={focusBody}
          spiceClient={spiceClient}
          observer="SUN"
          frame={J2000_FRAME}
        />
      ) : null}

      <canvas ref={canvasRef} className="sceneCanvas" />

      {/* Render HUD overlays */}
      {showRenderHud && <RenderHud stats={hudStats} />}

      <InfoOverlay
        isOpen={advancedHelpTopic != null}
        title={advancedHelpTopic ? ADVANCED_HELP[advancedHelpTopic].title : ''}
        onClose={() => setAdvancedHelpTopic(null)}
      >
        {advancedHelpTopic ? (
          <>
            {ADVANCED_HELP[advancedHelpTopic].body.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </>
        ) : null}
      </InfoOverlay>

      <HelpOverlay isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
