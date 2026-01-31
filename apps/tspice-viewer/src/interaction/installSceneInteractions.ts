import * as THREE from 'three'
import type { CameraController } from '../controls/CameraController.js'
import { pickFirstIntersection } from './pick.js'
import { BODY_REGISTRY, type BodyId } from '../scene/BodyRegistry.js'

export type SelectionRingTarget = {
  setTarget: (mesh: THREE.Object3D | undefined) => void
}

export type SceneInteractions = {
  cancelFocusTween: () => void
  focusOn: (nextTarget: THREE.Vector3, opts?: { radius?: number; immediate?: boolean }) => void
  dispose: () => void
}

export function installSceneInteractions(args: {
  canvas: HTMLCanvasElement
  camera: THREE.PerspectiveCamera
  controller: CameraController
  pickables: THREE.Mesh[]
  invalidate: () => void
  renderOnce: (timeMs?: number) => void

  computeFocusRadius: (radiusWorld: number) => number

  setFocusBody: (body: string) => void
  setSelectedBody: (body: string | null) => void
  selectedBodyIdRef: { current: BodyId | undefined }

  selectionRing?: SelectionRingTarget
  panModeEnabledRef: { current: boolean }
  lookModeEnabledRef: { current: boolean }

  isDisposed: () => boolean
}): SceneInteractions {
  const {
    canvas,
    camera,
    controller,
    pickables,
    invalidate,
    renderOnce,
    computeFocusRadius,
    setFocusBody,
    setSelectedBody,
    selectedBodyIdRef,
    selectionRing,
    panModeEnabledRef,
    lookModeEnabledRef,
    isDisposed,
  } = args

  const raycaster = new THREE.Raycaster()

  const clickMoveThresholdPx = 6
  const orbitSensitivity = 0.006
  const freeLookSensitivity = 0.003
  const rollSensitivity = 0.005
  const wheelZoomScale = 0.001
  const focusTweenMs = 320

  let selectedBodyId: string | undefined

  let focusTweenFrame: number | null = null

  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

  const cancelFocusTween = () => {
    if (focusTweenFrame == null) return
    window.cancelAnimationFrame(focusTweenFrame)
    focusTweenFrame = null
  }

  // Drag modes: orbit, pan, freeLook, roll
  type DragMode = 'orbit' | 'pan' | 'freeLook' | 'roll'

  let mouseDown:
    | {
        pointerId: number
        mode: DragMode
        startX: number
        startY: number
        lastX: number
        lastY: number
        isDragging: boolean
      }
    | undefined

  const activeTouches = new Map<number, { x: number; y: number }>()
  // Track last angle for 2-finger rotation gesture
  let lastTouchAngle: number | null = null

  let touchState:
    | { kind: 'none' }
    | {
        kind: 'single'
        pointerId: number
        mode: 'orbit' | 'pan' | 'freeLook'
        startX: number
        startY: number
        lastX: number
        lastY: number
        isDragging: boolean
      }
    | {
        kind: 'pinch'
        ids: [number, number]
        lastCenterX: number
        lastCenterY: number
        lastDistance: number
      } = { kind: 'none' }

  let selected:
    | {
        mesh: THREE.Mesh
      }
    | undefined

  let selectionPulseFrame: number | null = null
  const stopSelectionPulse = () => {
    if (selectionPulseFrame == null) return
    window.cancelAnimationFrame(selectionPulseFrame)
    selectionPulseFrame = null
  }

  const startSelectionPulse = () => {
    if (selectionPulseFrame != null) return

    const step = () => {
      if (isDisposed() || !selected) {
        selectionPulseFrame = null
        return
      }
      invalidate()
      selectionPulseFrame = window.requestAnimationFrame(step)
    }

    selectionPulseFrame = window.requestAnimationFrame(step)
  }

  const setSelectedMesh = (mesh: THREE.Mesh | undefined) => {
    if (selected?.mesh === mesh) return

    if (selected) {
      selected = undefined
      selectedBodyId = undefined
      selectedBodyIdRef.current = undefined
      setSelectedBody(null)
      selectionRing?.setTarget(undefined)
      stopSelectionPulse()
      invalidate()
    }

    if (!mesh) return

    selected = { mesh }

    selectedBodyId = String(mesh.userData.bodyId ?? '') || undefined

    // Keep ref in sync for label overlay
    const registry = BODY_REGISTRY.find((r) => String(r.body) === selectedBodyId)
    selectedBodyIdRef.current = registry?.id

    // Update React state for inspector panel
    if (selectedBodyId) {
      setSelectedBody(selectedBodyId)
    }

    // Subtle world-space ring indicator around the selected body.
    selectionRing?.setTarget(mesh)
    startSelectionPulse()
    invalidate()
  }

  const focusOn = (nextTarget: THREE.Vector3, opts?: { radius?: number; immediate?: boolean }) => {
    cancelFocusTween()

    const startTarget = controller.target.clone()
    const endTarget = nextTarget.clone()

    const startRadius = controller.radius
    const endRadius = opts?.radius ?? startRadius

    const immediate = Boolean(opts?.immediate)

    // Skip tiny moves to avoid scheduling unnecessary animation frames.
    if (
      immediate ||
      (startTarget.distanceToSquared(endTarget) < 1e-16 && Math.abs(endRadius - startRadius) < 1e-9)
    ) {
      controller.target.copy(endTarget)
      controller.radius = endRadius
      controller.applyToCamera(camera)
      invalidate()
      return
    }

    const startTime = performance.now()

    const step = () => {
      const now = performance.now()
      const t = THREE.MathUtils.clamp((now - startTime) / focusTweenMs, 0, 1)
      const eased = easeInOutCubic(t)

      controller.target.copy(startTarget).lerp(endTarget, eased)
      controller.radius = THREE.MathUtils.lerp(startRadius, endRadius, eased)
      controller.applyToCamera(camera)
      renderOnce()

      if (t >= 1) {
        focusTweenFrame = null
        return
      }

      focusTweenFrame = window.requestAnimationFrame(step)
    }

    focusTweenFrame = window.requestAnimationFrame(step)
  }

  canvas.style.cursor = 'grab'

  const onContextMenu = (ev: MouseEvent) => {
    ev.preventDefault()
  }

  const onPointerDown = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      ev.preventDefault()

      activeTouches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      canvas.setPointerCapture(ev.pointerId)

      if (activeTouches.size === 1) {
        // Determine mode based on toggles: Look > Pan > Orbit
        let mode: 'orbit' | 'pan' | 'freeLook' = 'orbit'
        if (lookModeEnabledRef.current) {
          mode = 'freeLook'
        } else if (panModeEnabledRef.current) {
          mode = 'pan'
        }

        touchState = {
          kind: 'single',
          pointerId: ev.pointerId,
          mode,
          startX: ev.clientX,
          startY: ev.clientY,
          lastX: ev.clientX,
          lastY: ev.clientY,
          isDragging: false,
        }
        return
      }

      if (activeTouches.size >= 2) {
        cancelFocusTween()

        const [a, b] = Array.from(activeTouches.entries())
        const ids: [number, number] = [a[0], b[0]]
        const dx = a[1].x - b[1].x
        const dy = a[1].y - b[1].y
        const centerX = (a[1].x + b[1].x) / 2
        const centerY = (a[1].y + b[1].y) / 2
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Initialize angle for rotation tracking
        lastTouchAngle = Math.atan2(dy, dx)

        touchState = {
          kind: 'pinch',
          ids,
          lastCenterX: centerX,
          lastCenterY: centerY,
          lastDistance: dist,
        }
        return
      }
    }

    // Desktop pointer handling
    // Button 0 = LMB, Button 1 = MMB, Button 2 = RMB
    const isLMB = ev.button === 0
    const isMMB = ev.button === 1
    const isRMB = ev.button === 2

    // Determine mode:
    // - LMB (no shift): orbit
    // - LMB + Shift: pan
    // - MMB: pan
    // - RMB (no shift): free-look
    // - RMB + Shift: roll
    let mode: DragMode | null = null

    if (isLMB && !ev.shiftKey) {
      mode = 'orbit'
    } else if ((isLMB && ev.shiftKey) || isMMB) {
      mode = 'pan'
    } else if (isRMB && !ev.shiftKey) {
      mode = 'freeLook'
    } else if (isRMB && ev.shiftKey) {
      mode = 'roll'
    }

    if (!mode) return

    ev.preventDefault()

    mouseDown = {
      pointerId: ev.pointerId,
      mode,
      startX: ev.clientX,
      startY: ev.clientY,
      lastX: ev.clientX,
      lastY: ev.clientY,
      isDragging: false,
    }

    canvas.setPointerCapture(ev.pointerId)
  }

  const onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      if (!activeTouches.has(ev.pointerId)) return

      ev.preventDefault()
      activeTouches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

      const rect = canvas.getBoundingClientRect()

      if (activeTouches.size >= 2) {
        cancelFocusTween()

        // Ensure pinch state if we have 2+ active pointers.
        if (touchState.kind !== 'pinch') {
          const [a, b] = Array.from(activeTouches.entries())
          const dx = a[1].x - b[1].x
          const dy = a[1].y - b[1].y
          lastTouchAngle = Math.atan2(dy, dx)
          touchState = {
            kind: 'pinch',
            ids: [a[0], b[0]],
            lastCenterX: (a[1].x + b[1].x) / 2,
            lastCenterY: (a[1].y + b[1].y) / 2,
            lastDistance: Math.sqrt(dx * dx + dy * dy),
          }
          return
        }

        const a = activeTouches.get(touchState.ids[0])
        const b = activeTouches.get(touchState.ids[1])

        if (!a || !b) {
          // Pick the first two active touches.
          const [na, nb] = Array.from(activeTouches.entries())
          const dx = na[1].x - nb[1].x
          const dy = na[1].y - nb[1].y
          lastTouchAngle = Math.atan2(dy, dx)
          touchState = {
            kind: 'pinch',
            ids: [na[0], nb[0]],
            lastCenterX: (na[1].x + nb[1].x) / 2,
            lastCenterY: (na[1].y + nb[1].y) / 2,
            lastDistance: Math.hypot(na[1].x - nb[1].x, na[1].y - nb[1].y),
          }
          return
        }

        const centerX = (a.x + b.x) / 2
        const centerY = (a.y + b.y) / 2
        const dist = Math.hypot(a.x - b.x, a.y - b.y)

        const centerDx = centerX - touchState.lastCenterX
        const centerDy = centerY - touchState.lastCenterY

        // Two-finger pan is always enabled.
        controller.pan(centerDx, centerDy, camera, { width: rect.width, height: rect.height })

        // Pinch zoom.
        if (dist > 0.5 && touchState.lastDistance > 0.5) {
          const ratio = touchState.lastDistance / dist
          controller.radius *= ratio
        }

        // 2-finger rotation gesture (twist) for roll
        const dx = a.x - b.x
        const dy = a.y - b.y
        const currentAngle = Math.atan2(dy, dx)

        if (lastTouchAngle !== null) {
          let deltaAngle = currentAngle - lastTouchAngle
          // Wrap to [-PI, PI]
          while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
          while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI

          // Apply roll (negative because twist direction)
          controller.applyRollDelta(-deltaAngle)
        }
        lastTouchAngle = currentAngle

        touchState.lastCenterX = centerX
        touchState.lastCenterY = centerY
        touchState.lastDistance = dist

        controller.applyToCamera(camera)
        invalidate()
        return
      }

      if (touchState.kind !== 'single') return
      if (ev.pointerId !== touchState.pointerId) return

      const totalDx = ev.clientX - touchState.startX
      const totalDy = ev.clientY - touchState.startY

      if (!touchState.isDragging) {
        if (totalDx * totalDx + totalDy * totalDy < clickMoveThresholdPx ** 2) {
          return
        }

        cancelFocusTween()
        touchState.isDragging = true
        touchState.lastX = ev.clientX
        touchState.lastY = ev.clientY
        return
      }

      const dx = ev.clientX - touchState.lastX
      const dy = ev.clientY - touchState.lastY

      touchState.lastX = ev.clientX
      touchState.lastY = ev.clientY

      if (touchState.mode === 'orbit') {
        controller.yaw -= dx * orbitSensitivity
        controller.pitch -= dy * orbitSensitivity
      } else if (touchState.mode === 'pan') {
        controller.pan(dx, dy, camera, { width: rect.width, height: rect.height })
      } else if (touchState.mode === 'freeLook') {
        controller.applyFreeLookDelta(dx, dy, freeLookSensitivity)
      }

      controller.applyToCamera(camera)
      invalidate()
      return
    }

    if (!mouseDown) return
    if (ev.pointerId !== mouseDown.pointerId) return

    const totalDx = ev.clientX - mouseDown.startX
    const totalDy = ev.clientY - mouseDown.startY

    if (!mouseDown.isDragging) {
      if (totalDx * totalDx + totalDy * totalDy < clickMoveThresholdPx ** 2) {
        return
      }

      cancelFocusTween()

      mouseDown.isDragging = true
      mouseDown.lastX = ev.clientX
      mouseDown.lastY = ev.clientY
      canvas.style.cursor = 'grabbing'
      return
    }

    const dx = ev.clientX - mouseDown.lastX
    const dy = ev.clientY - mouseDown.lastY

    mouseDown.lastX = ev.clientX
    mouseDown.lastY = ev.clientY

    if (mouseDown.mode === 'orbit') {
      controller.yaw -= dx * orbitSensitivity
      controller.pitch -= dy * orbitSensitivity
    } else if (mouseDown.mode === 'pan') {
      const rect = canvas.getBoundingClientRect()
      controller.pan(dx, dy, camera, { width: rect.width, height: rect.height })
    } else if (mouseDown.mode === 'freeLook') {
      controller.applyFreeLookDelta(dx, dy, freeLookSensitivity)
    } else if (mouseDown.mode === 'roll') {
      // Use horizontal movement for roll
      controller.applyRollDelta(dx * rollSensitivity)
    }

    controller.applyToCamera(camera)
    invalidate()
  }

  const onPointerUp = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      if (!activeTouches.has(ev.pointerId)) return

      ev.preventDefault()

      const wasSingleTap =
        touchState.kind === 'single' &&
        touchState.pointerId === ev.pointerId &&
        !touchState.isDragging &&
        activeTouches.size === 1

      activeTouches.delete(ev.pointerId)

      try {
        canvas.releasePointerCapture(ev.pointerId)
      } catch {
        // Ignore cases like pointercancel where the capture is already released.
      }

      if (wasSingleTap) {
        const hit = pickFirstIntersection({
          clientX: ev.clientX,
          clientY: ev.clientY,
          element: canvas,
          camera,
          pickables,
          raycaster,
        })

        if (!hit) {
          setSelectedMesh(undefined)
          invalidate()
        } else {
          const hitMesh = hit.object
          if (hitMesh instanceof THREE.Mesh) {
            const nextSelectedBodyId = String(hitMesh.userData.bodyId ?? '') || undefined
            const selectionChanged = nextSelectedBodyId !== selectedBodyId
            if (selectionChanged) {
              setSelectedMesh(hitMesh)
              // Clear look offset when focusing new object
              controller.resetLookOffset()
              if (nextSelectedBodyId) setFocusBody(nextSelectedBodyId)
            }

            // When selection changes, rely on focus-body changes to center
            // and auto-zoom (avoids focusing in the pre-rebase coordinate
            // system).
            if (!selectionChanged) {
              const target = new THREE.Vector3()
              hitMesh.getWorldPosition(target)
              focusOn(target)
            }
          }
        }
      }

      if (activeTouches.size === 0) {
        touchState = { kind: 'none' }
        lastTouchAngle = null
        return
      }

      if (activeTouches.size === 1) {
        const [nextId, nextPos] = Array.from(activeTouches.entries())[0]
        // Determine mode based on toggles: Look > Pan > Orbit
        let mode: 'orbit' | 'pan' | 'freeLook' = 'orbit'
        if (lookModeEnabledRef.current) {
          mode = 'freeLook'
        } else if (panModeEnabledRef.current) {
          mode = 'pan'
        }
        touchState = {
          kind: 'single',
          pointerId: nextId,
          mode,
          startX: nextPos.x,
          startY: nextPos.y,
          lastX: nextPos.x,
          lastY: nextPos.y,
          isDragging: false,
        }
        lastTouchAngle = null
        return
      }

      // 2+ touches: keep pinch state based on first two pointers.
      const [a, b] = Array.from(activeTouches.entries())
      const dx = a[1].x - b[1].x
      const dy = a[1].y - b[1].y
      lastTouchAngle = Math.atan2(dy, dx)
      touchState = {
        kind: 'pinch',
        ids: [a[0], b[0]],
        lastCenterX: (a[1].x + b[1].x) / 2,
        lastCenterY: (a[1].y + b[1].y) / 2,
        lastDistance: Math.sqrt(dx * dx + dy * dy),
      }
      return
    }

    if (!mouseDown) return
    if (ev.pointerId !== mouseDown.pointerId) return

    const { isDragging: wasDragging, mode } = mouseDown
    mouseDown = undefined

    try {
      canvas.releasePointerCapture(ev.pointerId)
    } catch {
      // Ignore cases like pointercancel where the capture is already released.
    }

    canvas.style.cursor = 'grab'

    if (wasDragging) return

    // Only left-click (without shift) selects/focuses.
    if (mode !== 'orbit') return

    const hit = pickFirstIntersection({
      clientX: ev.clientX,
      clientY: ev.clientY,
      element: canvas,
      camera,
      pickables,
      raycaster,
    })

    if (!hit) {
      setSelectedMesh(undefined)
      invalidate()
      return
    }

    const hitMesh = hit.object
    if (!(hitMesh instanceof THREE.Mesh)) return

    const nextSelectedBodyId = String(hitMesh.userData.bodyId ?? '') || undefined
    if (nextSelectedBodyId !== selectedBodyId) {
      setSelectedMesh(hitMesh)
      // Clear look offset when focusing new object
      controller.resetLookOffset()
      if (nextSelectedBodyId) setFocusBody(nextSelectedBodyId)
      // Let focus-body changes drive camera centering + auto-zoom.
      return
    }

    const target = new THREE.Vector3()
    hitMesh.getWorldPosition(target)

    // Use the mesh's current world scale so focus radius matches the
    // visually-rendered (potentially scaled) body.
    const worldScale = new THREE.Vector3()
    hitMesh.getWorldScale(worldScale)
    const radiusWorld = worldScale.x

    if (Number.isFinite(radiusWorld) && radiusWorld > 0) {
      focusOn(target, { radius: computeFocusRadius(radiusWorld) })
    } else {
      focusOn(target)
    }
  }

  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault()

    cancelFocusTween()

    controller.radius *= Math.exp(ev.deltaY * wheelZoomScale)
    controller.applyToCamera(camera)
    invalidate()
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('pointermove', onPointerMove, { passive: false })
  canvas.addEventListener('pointerup', onPointerUp, { passive: false })
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false })
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

  const dispose = () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContextMenu)

    cancelFocusTween()
    setSelectedMesh(undefined)
    stopSelectionPulse()
  }

  return {
    cancelFocusTween,
    focusOn,
    dispose,
  }
}
