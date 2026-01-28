import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import type { CameraController, CameraControllerState } from './CameraController.js'
import { timeStore } from '../time/timeStore.js'

/** Orbit step equivalent in radians (used to derive speed) */
const ORBIT_STEP = 0.05
/** Orbit speed for continuous arrow-key orbit (roughly matches key-repeat feel) */
const ORBIT_SPEED_RAD_PER_SEC = ORBIT_STEP * 20
/** Pan speed for continuous WASD movement */
const PAN_SPEED_PX_PER_SEC = 600
/** Zoom factor per key press */
const ZOOM_FACTOR = 1.15
/** Roll speed (radians/sec) for continuous Q/E movement */
const ROLL_SPEED_RAD_PER_SEC = (Math.PI / 36) * 20 // ~100 deg/sec

export interface KeyboardControlsOptions {
  /** CameraController ref */
  controllerRef: React.RefObject<CameraController | null>
  /** Camera ref */
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
  /** Canvas element ref */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Invalidate/render callback */
  invalidate: () => void
  /** Cancel any ongoing focus tween */
  cancelFocusTween?: () => void
  /** Focus on origin (reset camera target) */
  focusOnOrigin?: () => void

  /** Toggle help overlay (e.g. `?`) */
  toggleHelp?: () => void
  /** Toggle labels visibility */
  toggleLabels?: () => void
  /** Reset the free-look offset (recenter view) */
  resetLookOffset?: () => void
  /** Snapshot of the initial controller state (used for Reset / R). */
  initialControllerStateRef?: React.RefObject<CameraControllerState | null>

  /**
   * Optional per-focus-body reset states.
   *
   * When provided, Reset (R/Home) will prefer the entry keyed by
   * `String(focusBodyRef.current)`.
   */
  resetControllerStateByBodyRef?: React.RefObject<Map<string, CameraControllerState> | null>
  /** Current focus body (used to choose per-body reset state). */
  focusBodyRef?: React.RefObject<string | number | null>
  /** Whether keyboard controls are enabled */
  enabled?: boolean
}

/**
 * Check if keyboard event target is an editable element.
 * We don't want to capture shortcuts when typing in inputs.
 */
export function isEditableElement(target: unknown): boolean {
  if (!target) return false
  const maybeEl = target as { tagName?: unknown; isContentEditable?: unknown }
  const tagName = typeof maybeEl.tagName === 'string' ? maybeEl.tagName.toLowerCase() : ''
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true
  if (maybeEl.isContentEditable === true) return true
  return false
}

export function isHelpToggleShortcut(key: string, shiftKey: boolean): boolean {
  return key === '?' || (key === '/' && shiftKey)
}

/**
 * Hook to handle keyboard controls for the scene canvas.
 *
 * Shortcuts:
 * - Arrow keys: Orbit (yaw/pitch)
 * - Shift + Arrow keys: Pan
 * - W/A/S/D: Pan (alternate)
 * - +/=/- : Zoom in/out
 * - Q/E: Roll left/right
 * - F/C: Focus/center on origin (reset view target)
 * - R/Home: Reset view
 * - Escape: Recenter view (clear look offset only)
 * - Space: Play/pause time
 * - [ / ]: Step time backward/forward
 * - G: Go to selected (TODO: not implemented yet - requires selection state)
* - L: Toggle labels
 */
export function useKeyboardControls({
  controllerRef,
  cameraRef,
  canvasRef,
  invalidate,
  cancelFocusTween,
  focusOnOrigin,
  toggleHelp,
  toggleLabels,
  resetLookOffset,
  initialControllerStateRef,
  resetControllerStateByBodyRef,
  focusBodyRef,
  enabled = true,
}: KeyboardControlsOptions) {
  // Keep refs to latest values to avoid stale closures
  const invalidateRef = useRef(invalidate)
  const cancelFocusTweenRef = useRef(cancelFocusTween)
  const focusOnOriginRef = useRef(focusOnOrigin)
  const toggleHelpRef = useRef(toggleHelp)
  const toggleLabelsRef = useRef(toggleLabels)
  const resetLookOffsetRef = useRef(resetLookOffset)

  useEffect(() => {
    invalidateRef.current = invalidate
    cancelFocusTweenRef.current = cancelFocusTween
    focusOnOriginRef.current = focusOnOrigin
    toggleHelpRef.current = toggleHelp
    toggleLabelsRef.current = toggleLabels
    resetLookOffsetRef.current = resetLookOffset
  }, [invalidate, cancelFocusTween, focusOnOrigin, toggleHelp, toggleLabels, resetLookOffset])

  useEffect(() => {
    if (!enabled) return

    const pressedKeys = new Set<string>()
    let shiftDown = false

    let motionFrame: number | null = null
    let lastMotionTimeMs: number | null = null

    const stopMotion = () => {
      if (motionFrame != null) {
        window.cancelAnimationFrame(motionFrame)
        motionFrame = null
      }
      lastMotionTimeMs = null
      pressedKeys.clear()
      shiftDown = false
    }

    const startMotion = () => {
      if (motionFrame != null) return

      const step = (nowMs: number) => {
        const controller = controllerRef.current
        const camera = cameraRef.current
        const canvas = canvasRef.current

        // Stop if we lose required refs.
        if (!controller || !camera || !canvas) {
          stopMotion()
          return
        }

        // Don't move while typing.
        if (isEditableElement(document.activeElement)) {
          stopMotion()
          return
        }

        // Stop when no movement keys are held.
        if (pressedKeys.size === 0) {
          stopMotion()
          return
        }

        const dtSec =
          lastMotionTimeMs == null
            ? 1 / 60
            : Math.min(Math.max((nowMs - lastMotionTimeMs) / 1000, 0), 0.05)
        lastMotionTimeMs = nowMs

        let dirX = 0
        let dirY = 0
        if (pressedKeys.has('w')) dirY -= 1
        if (pressedKeys.has('s')) dirY += 1
        if (pressedKeys.has('a')) dirX -= 1
        if (pressedKeys.has('d')) dirX += 1

        // Shift + arrow keys: pan continuously.
        if (shiftDown) {
          if (pressedKeys.has('arrowup')) dirY -= 1
          if (pressedKeys.has('arrowdown')) dirY += 1
          if (pressedKeys.has('arrowleft')) dirX -= 1
          if (pressedKeys.has('arrowright')) dirX += 1
        }

        // Normalize diagonals so movement speed stays consistent.
        if (dirX !== 0 && dirY !== 0) {
          dirX *= Math.SQRT1_2
          dirY *= Math.SQRT1_2
        }

        const dxPx = dirX * PAN_SPEED_PX_PER_SEC * dtSec
        const dyPx = dirY * PAN_SPEED_PX_PER_SEC * dtSec

        // Arrow keys (without shift): orbit continuously.
        let yawDir = 0
        let pitchDir = 0
        if (!shiftDown) {
          if (pressedKeys.has('arrowleft')) yawDir -= 1
          if (pressedKeys.has('arrowright')) yawDir += 1
          if (pressedKeys.has('arrowup')) pitchDir += 1
          if (pressedKeys.has('arrowdown')) pitchDir -= 1

          // Normalize diagonals so orbit speed stays consistent.
          if (yawDir !== 0 && pitchDir !== 0) {
            yawDir *= Math.SQRT1_2
            pitchDir *= Math.SQRT1_2
          }
        }

        const dyaw = yawDir * ORBIT_SPEED_RAD_PER_SEC * dtSec
        const dpitch = pitchDir * ORBIT_SPEED_RAD_PER_SEC * dtSec

        let rollDir = 0
        if (pressedKeys.has('q')) rollDir -= 1
        if (pressedKeys.has('e')) rollDir += 1
        const dRoll = rollDir * ROLL_SPEED_RAD_PER_SEC * dtSec

        let didMove = false

        if (dxPx !== 0 || dyPx !== 0) {
          controller.pan(dxPx, dyPx, camera, {
            width: canvas.clientWidth || 800,
            height: canvas.clientHeight || 600,
          })
          didMove = true
        }

        if (dyaw !== 0 || dpitch !== 0) {
          controller.yaw += dyaw
          controller.pitch += dpitch
          didMove = true
        }

        if (dRoll !== 0) {
          controller.applyRollDelta(dRoll)
          didMove = true
        }

        if (didMove) {
          controller.applyToCamera(camera)
          invalidateRef.current()
        }

        motionFrame = window.requestAnimationFrame(step)
      }

      lastMotionTimeMs = null
      motionFrame = window.requestAnimationFrame(step)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when focus is in editable elements
      if (isEditableElement(e.target)) return

      if (!e.ctrlKey && !e.metaKey && !e.altKey && isHelpToggleShortcut(e.key, e.shiftKey)) {
        const toggle = toggleHelpRef.current
        if (!toggle) return
        e.preventDefault()
        toggle()
        return
      }

      const key = e.key.toLowerCase()

      // Track shift state so Shift+Arrow can pan continuously.
      if (e.key === 'Shift') {
        if (!e.repeat) shiftDown = true
        return
      }

      // Continuous arrow-key orbit (key-repeat independent)
      if (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
        e.preventDefault()

        if (!e.repeat) {
          pressedKeys.add(key)
          cancelFocusTweenRef.current?.()
          startMotion()
        }
        return
      }

      // Continuous WASD panning + Q/E rolling (key-repeat independent)
      if (
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd' ||
        key === 'q' ||
        key === 'e'
      ) {
        e.preventDefault()

        // Ignore repeat events; key state is tracked by the set.
        if (!e.repeat) {
          pressedKeys.add(key)
          cancelFocusTweenRef.current?.()
          startMotion()
        }
        return
      }

      const controller = controllerRef.current
      const camera = cameraRef.current

      // Handle shortcuts that don't require camera
      switch (e.key) {
        case ' ':
          e.preventDefault()
          timeStore.togglePlay()
          return

        case '[':
          e.preventDefault()
          timeStore.stepBackward()
          return

        case ']':
          e.preventDefault()
          timeStore.stepForward()
          return

        case 'Escape':
          // Recenter view: clear look offset only (keeps orbit position/target)
          e.preventDefault()
          resetLookOffsetRef.current?.()
          return
      }

      // Camera-dependent shortcuts require controller + camera
      if (!controller || !camera) return

      const doInvalidate = () => {
        controller.applyToCamera(camera)
        invalidateRef.current()
      }

      switch (e.key) {
        // Zoom controls
        case '+':
        case '=': // = key without shift produces =, with shift produces +
          e.preventDefault()
          cancelFocusTweenRef.current?.()
          controller.radius /= ZOOM_FACTOR
          doInvalidate()
          break

        case '-':
        case '_':
          e.preventDefault()
          cancelFocusTweenRef.current?.()
          controller.radius *= ZOOM_FACTOR
          doInvalidate()
          break

        // Focus/center on origin
        case 'f':
        case 'F':
        case 'c':
        case 'C':
          e.preventDefault()
          focusOnOriginRef.current?.()
          break

        // Reset view
        case 'r':
        case 'R':
        case 'Home':
          e.preventDefault()
          cancelFocusTweenRef.current?.()
          {
            const focusKey = focusBodyRef?.current != null ? String(focusBodyRef.current) : undefined

            const perBody = resetControllerStateByBodyRef?.current ?? null
            const perBodyState = focusKey ? perBody?.get(focusKey) : undefined
            const fallback = initialControllerStateRef?.current ?? null
            const next = perBodyState ?? fallback

            if (!next) return
            controller.restore(next)
            doInvalidate()
          }
          break

        // Toggle labels
        case 'l':
        case 'L':
          e.preventDefault()
          toggleLabelsRef.current?.()
          return
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return

      const key = e.key.toLowerCase()

      if (e.key === 'Shift') {
        shiftDown = false
        return
      }
      if (
        key !== 'w' &&
        key !== 'a' &&
        key !== 's' &&
        key !== 'd' &&
        key !== 'q' &&
        key !== 'e' &&
        key !== 'arrowleft' &&
        key !== 'arrowright' &&
        key !== 'arrowup' &&
        key !== 'arrowdown'
      ) {
        return
      }

      e.preventDefault()
      pressedKeys.delete(key)

      if (pressedKeys.size === 0) {
        stopMotion()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', stopMotion)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', stopMotion)
      stopMotion()
    }
  }, [
    enabled,
    controllerRef,
    cameraRef,
    canvasRef,
    initialControllerStateRef,
    resetControllerStateByBodyRef,
    focusBodyRef,
  ])
}
