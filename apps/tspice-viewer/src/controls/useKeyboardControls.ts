import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import type { CameraController } from './CameraController.js'
import { timeStore } from '../time/timeStore.js'

/** Orbit step in radians per key press */
const ORBIT_STEP = 0.05
/** Pan step in pixels equivalent */
const PAN_STEP_PX = 30
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
 * - L: Toggle labels (TODO: not implemented yet - no label system)
 */
export function useKeyboardControls({
  controllerRef,
  cameraRef,
  canvasRef,
  invalidate,
  cancelFocusTween,
  focusOnOrigin,
  enabled = true,
}: KeyboardControlsOptions) {
  // Keep refs to latest values to avoid stale closures
  const invalidateRef = useRef(invalidate)
  const cancelFocusTweenRef = useRef(cancelFocusTween)
  const focusOnOriginRef = useRef(focusOnOrigin)

  useEffect(() => {
    invalidateRef.current = invalidate
    cancelFocusTweenRef.current = cancelFocusTween
    focusOnOriginRef.current = focusOnOrigin
  }, [invalidate, cancelFocusTween, focusOnOrigin])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when focus is in editable elements
      if (isEditableElement(e.target)) return

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

        // WASD Pan (alternate)
        case 'w':
        case 'W':
          e.preventDefault()
          cancelFocusTweenRef.current?.()
          if (canvas) {
            controller.pan(0, -PAN_STEP_PX, camera, {
              width: canvas.clientWidth || 800,
              height: canvas.clientHeight || 600,
            })
          }
          doInvalidate()
          break

        case 'a':
        case 'A':
          e.preventDefault()
          cancelFocusTweenRef.current?.()
          if (canvas) {
            controller.pan(-PAN_STEP_PX, 0, camera, {
              width: canvas.clientWidth || 800,
              height: canvas.clientHeight || 600,
            })
          }
          doInvalidate()
          break

        case 's':
        case 'S':
          e.preventDefault()
          cancelFocusTweenRef.current?.()
          if (canvas) {
            controller.pan(0, PAN_STEP_PX, camera, {
              width: canvas.clientWidth || 800,
              height: canvas.clientHeight || 600,
            })
          }
          doInvalidate()
          break

        case 'd':
        case 'D':
          e.preventDefault()
          cancelFocusTweenRef.current?.()
          if (canvas) {
            controller.pan(PAN_STEP_PX, 0, camera, {
              width: canvas.clientWidth || 800,
              height: canvas.clientHeight || 600,
            })
          }
          doInvalidate()
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
          // Reset to default camera position
          controller.target.set(0, 0, 0)
          controller.yaw = Math.atan2(2.2, 2.2) // Approx original yaw
          controller.pitch = Math.asin(1.4 / Math.sqrt(2.2 * 2.2 + 1.4 * 1.4 + 2.2 * 2.2))
          controller.radius = Math.sqrt(2.2 * 2.2 + 1.4 * 1.4 + 2.2 * 2.2)
          doInvalidate()
          break

        // TODO: G for "go to selected" - requires selection state to be passed in
        // Currently there's no easy way to access the selected body from here.
        // The selection logic is inside SceneCanvas's useEffect closure.

        // TODO: L for "toggle labels" - no label system implemented yet
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, controllerRef, cameraRef, canvasRef])
}
