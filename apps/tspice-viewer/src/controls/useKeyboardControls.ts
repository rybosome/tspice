import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import type { CameraController, CameraControllerState } from './CameraController.js'
import { timeStore } from '../time/timeStore.js'

/** Orbit step in radians per key press */
const ORBIT_STEP = 0.05
/** Pan step in pixels equivalent */
const PAN_STEP_PX = 30
/** Pan speed for continuous WASD movement */
const PAN_SPEED_PX_PER_SEC = 600
/** Zoom factor per key press */
const ZOOM_FACTOR = 1.15

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
  /** Toggle labels visibility */
  toggleLabels?: () => void
  /** Snapshot of the initial controller state (used for Reset / R). */
  initialControllerStateRef?: React.RefObject<CameraControllerState | null>
  /** Whether keyboard controls are enabled */
  enabled?: boolean
}

/**
 * Check if keyboard event target is an editable element.
 * We don't want to capture shortcuts when typing in inputs.
 */
function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Hook to handle keyboard controls for the scene canvas.
 *
 * Shortcuts:
 * - Arrow keys: Orbit (yaw/pitch)
 * - Shift + Arrow keys: Pan
 * - W/A/S/D: Pan (alternate)
 * - +/=/- : Zoom in/out
 * - F/C: Focus/center on origin (reset view target)
 * - R/Home: Reset view
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
  toggleLabels,
  initialControllerStateRef,
  enabled = true,
}: KeyboardControlsOptions) {
  // Keep refs to latest values to avoid stale closures
  const invalidateRef = useRef(invalidate)
  const cancelFocusTweenRef = useRef(cancelFocusTween)
  const focusOnOriginRef = useRef(focusOnOrigin)
  const toggleLabelsRef = useRef(toggleLabels)

  useEffect(() => {
    invalidateRef.current = invalidate
    cancelFocusTweenRef.current = cancelFocusTween
    focusOnOriginRef.current = focusOnOrigin
    toggleLabelsRef.current = toggleLabels
  }, [invalidate, cancelFocusTween, focusOnOrigin, toggleLabels])

  useEffect(() => {
    if (!enabled) return

    const pressedKeys = new Set<string>()
    let panFrame: number | null = null
    let lastPanTimeMs: number | null = null

    const stopPan = () => {
      if (panFrame != null) {
        window.cancelAnimationFrame(panFrame)
        panFrame = null
      }
      lastPanTimeMs = null
      pressedKeys.clear()
    }

    const startPan = () => {
      if (panFrame != null) return

      const step = (nowMs: number) => {
        const controller = controllerRef.current
        const camera = cameraRef.current
        const canvas = canvasRef.current

        // Stop if we lose required refs.
        if (!controller || !camera || !canvas) {
          stopPan()
          return
        }

        // Don't move while typing.
        if (isEditableElement(document.activeElement)) {
          stopPan()
          return
        }

        // Stop when no movement keys are held.
        if (pressedKeys.size === 0) {
          stopPan()
          return
        }

        const dtSec =
          lastPanTimeMs == null
            ? 1 / 60
            : Math.min(Math.max((nowMs - lastPanTimeMs) / 1000, 0), 0.05)
        lastPanTimeMs = nowMs

        let dirX = 0
        let dirY = 0
        if (pressedKeys.has('w')) dirY -= 1
        if (pressedKeys.has('s')) dirY += 1
        if (pressedKeys.has('a')) dirX -= 1
        if (pressedKeys.has('d')) dirX += 1

        // Normalize diagonals so movement speed stays consistent.
        if (dirX !== 0 && dirY !== 0) {
          dirX *= Math.SQRT1_2
          dirY *= Math.SQRT1_2
        }

        const dxPx = dirX * PAN_SPEED_PX_PER_SEC * dtSec
        const dyPx = dirY * PAN_SPEED_PX_PER_SEC * dtSec

        if (dxPx !== 0 || dyPx !== 0) {
          controller.pan(dxPx, dyPx, camera, {
            width: canvas.clientWidth || 800,
            height: canvas.clientHeight || 600,
          })
          controller.applyToCamera(camera)
          invalidateRef.current()
        }

        panFrame = window.requestAnimationFrame(step)
      }

      lastPanTimeMs = null
      panFrame = window.requestAnimationFrame(step)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when focus is in editable elements
      if (isEditableElement(e.target)) return

      const key = e.key.toLowerCase()

      // Continuous WASD panning (key-repeat independent)
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        e.preventDefault()

        // Ignore repeat events; key state is tracked by the set.
        if (!e.repeat) {
          pressedKeys.add(key)
          cancelFocusTweenRef.current?.()
          startPan()
        }
        return
      }

      const controller = controllerRef.current
      const camera = cameraRef.current
      const canvas = canvasRef.current

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
      }

      // Camera-dependent shortcuts require controller + camera
      if (!controller || !camera) return

      const doInvalidate = () => {
        controller.applyToCamera(camera)
        invalidateRef.current()
      }

      switch (e.key) {
        // Orbit controls: Arrow keys (without Shift)
        case 'ArrowLeft':
          if (!e.shiftKey) {
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            controller.yaw -= ORBIT_STEP
            doInvalidate()
          } else {
            // Shift + Arrow: Pan
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            if (canvas) {
              controller.pan(-PAN_STEP_PX, 0, camera, {
                width: canvas.clientWidth || 800,
                height: canvas.clientHeight || 600,
              })
            }
            doInvalidate()
          }
          break

        case 'ArrowRight':
          if (!e.shiftKey) {
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            controller.yaw += ORBIT_STEP
            doInvalidate()
          } else {
            // Shift + Arrow: Pan
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            if (canvas) {
              controller.pan(PAN_STEP_PX, 0, camera, {
                width: canvas.clientWidth || 800,
                height: canvas.clientHeight || 600,
              })
            }
            doInvalidate()
          }
          break

        case 'ArrowUp':
          if (!e.shiftKey) {
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            controller.pitch += ORBIT_STEP
            doInvalidate()
          } else {
            // Shift + Arrow: Pan
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            if (canvas) {
              controller.pan(0, -PAN_STEP_PX, camera, {
                width: canvas.clientWidth || 800,
                height: canvas.clientHeight || 600,
              })
            }
            doInvalidate()
          }
          break

        case 'ArrowDown':
          if (!e.shiftKey) {
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            controller.pitch -= ORBIT_STEP
            doInvalidate()
          } else {
            // Shift + Arrow: Pan
            e.preventDefault()
            cancelFocusTweenRef.current?.()
            if (canvas) {
              controller.pan(0, PAN_STEP_PX, camera, {
                width: canvas.clientWidth || 800,
                height: canvas.clientHeight || 600,
              })
            }
            doInvalidate()
          }
          break

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
            const initial = initialControllerStateRef?.current
            if (!initial) return
            controller.restore(initial)
            doInvalidate()
          }
          break

        // Toggle labels
        case 'l':
        case 'L':
          e.preventDefault()
          toggleLabelsRef.current?.()
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return

      const key = e.key.toLowerCase()
      if (key !== 'w' && key !== 'a' && key !== 's' && key !== 'd') return

      e.preventDefault()
      pressedKeys.delete(key)

      if (pressedKeys.size === 0) {
        stopPan()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', stopPan)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', stopPan)
      stopPan()
    }
  }, [enabled, controllerRef, cameraRef, canvasRef, initialControllerStateRef])
}
