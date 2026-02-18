import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { describe, expect, it, vi } from 'vitest'

import { createDrawingBufferResizeSubscription } from './drawingBufferResizeSubscription.js'

describe('createThreeRuntime drawing-buffer resize subscription', () => {
  it('replays the latest buffer size to late subscribers', () => {
    const sub = createDrawingBufferResizeSubscription()

    // Initial resize happens before a subscriber is installed.
    sub.emit(800, 600)

    const fn = vi.fn()
    sub.set(fn)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ width: 800, height: 600 })
  })

  it('invokes the subscriber on subsequent emits', () => {
    const sub = createDrawingBufferResizeSubscription()

    const fn = vi.fn()
    sub.set(fn)

    sub.emit(100, 200)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ width: 100, height: 200 })
  })

  it('does not invoke the subscriber until a size has been emitted', () => {
    const sub = createDrawingBufferResizeSubscription()

    const fn = vi.fn()
    sub.set(fn)

    expect(fn).toHaveBeenCalledTimes(0)

    sub.emit(10, 20)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ width: 10, height: 20 })
  })

  it('supports clearing the subscriber', () => {
    const sub = createDrawingBufferResizeSubscription()

    const fn = vi.fn()
    sub.set(fn)
    sub.emit(10, 20)

    expect(fn).toHaveBeenCalledTimes(1)

    sub.set(null)
    sub.emit(30, 40)

    // No additional calls after unsubscribe.
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('keeps LineMaterial resolution correct when a late subscriber is followed by a no-op resize', () => {
    const sub = createDrawingBufferResizeSubscription()

    // Mimic `createThreeRuntime.resize()` behavior: if the observable inputs are
    // unchanged, resize work no-ops and does not re-emit the drawing buffer size.
    let lastResizeKey: string | null = null
    const maybeResize = (args: { width: number; height: number; pixelRatio: number }) => {
      const { width, height, pixelRatio } = args
      const resizeKey = `${width}x${height}@${pixelRatio}|off|1`
      if (resizeKey === lastResizeKey) return
      lastResizeKey = resizeKey

      // In Three.js, drawing buffer size is effectively the CSS size scaled by pixel ratio.
      sub.emit(Math.floor(width * pixelRatio), Math.floor(height * pixelRatio))
    }

    // Initial resize happens before orbit paths (or other `LineMaterial` users) subscribe.
    maybeResize({ width: 400, height: 300, pixelRatio: 2 })

    const material = new LineMaterial({ linewidth: 1 })
    expect(material.resolution.x).toBe(1)
    expect(material.resolution.y).toBe(1)

    const updateResolution = vi.fn((bufferSize: { width: number; height: number }) => {
      material.resolution.set(bufferSize.width, bufferSize.height)
    })

    // Late subscriber: should immediately receive the most recent buffer size.
    sub.set(updateResolution)

    expect(updateResolution).toHaveBeenCalledTimes(1)
    expect(material.resolution.x).toBe(800)
    expect(material.resolution.y).toBe(600)

    // ResizeObserver fires again, but nothing changed -> no-op resize.
    maybeResize({ width: 400, height: 300, pixelRatio: 2 })

    // No additional callback, but the material is still correct.
    expect(updateResolution).toHaveBeenCalledTimes(1)
    expect(material.resolution.x).toBe(800)
    expect(material.resolution.y).toBe(600)

    material.dispose()
  })
})
