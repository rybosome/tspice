import { describe, expect, it, vi } from 'vitest'

import { __testing } from './createThreeRuntime.js'

describe('createThreeRuntime drawing-buffer resize subscription', () => {
  it('replays the latest buffer size to late subscribers', () => {
    const sub = __testing.createDrawingBufferResizeSubscription()

    // Initial resize happens before a subscriber is installed.
    sub.emit(800, 600)

    const fn = vi.fn()
    sub.set(fn)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ width: 800, height: 600 })
  })

  it('invokes the subscriber on subsequent emits', () => {
    const sub = __testing.createDrawingBufferResizeSubscription()

    const fn = vi.fn()
    sub.set(fn)

    sub.emit(100, 200)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ width: 100, height: 200 })
  })

  it('does not invoke the subscriber until a size has been emitted', () => {
    const sub = __testing.createDrawingBufferResizeSubscription()

    const fn = vi.fn()
    sub.set(fn)

    expect(fn).toHaveBeenCalledTimes(0)

    sub.emit(10, 20)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ width: 10, height: 20 })
  })

  it('supports clearing the subscriber', () => {
    const sub = __testing.createDrawingBufferResizeSubscription()

    const fn = vi.fn()
    sub.set(fn)
    sub.emit(10, 20)

    expect(fn).toHaveBeenCalledTimes(1)

    sub.set(null)
    sub.emit(30, 40)

    // No additional calls after unsubscribe.
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
