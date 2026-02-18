export type DrawingBufferSize = { width: number; height: number }

export type OnDrawingBufferResize = ((bufferSize: DrawingBufferSize) => void) | null

/**
 * Maintain the latest drawing buffer size and replay it to late subscribers.
 *
 * This prevents `LineMaterial` users (e.g. orbit paths) from rendering with the
 * default `(1,1)` resolution when they subscribe after an initial resize.
 */
export function createDrawingBufferResizeSubscription() {
  let lastWidth: number | null = null
  let lastHeight: number | null = null
  let fn: OnDrawingBufferResize = null

  return {
    emit: (width: number, height: number) => {
      lastWidth = width
      lastHeight = height
      fn?.({ width, height })
    },

    set: (next: OnDrawingBufferResize) => {
      fn = next
      if (fn && lastWidth != null && lastHeight != null) {
        fn({ width: lastWidth, height: lastHeight })
      }
    },
  }
}
