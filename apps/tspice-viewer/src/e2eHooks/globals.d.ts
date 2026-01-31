import type { SpiceClient } from '../spice/SpiceClient.js'

declare global {
  interface Window {
    __tspice_viewer__e2e?: {
      getFrameTransform: (args: { from: string; to: string; et: number }) =>
        ReturnType<SpiceClient['getFrameTransform']>
    }

    /** Signals to Playwright tests that the WebGL scene has rendered at least once. */
    __tspice_viewer__rendered_scene?: boolean
  }
}

export {}
