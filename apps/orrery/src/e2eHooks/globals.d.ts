import type { Mat3ColMajor } from '@rybosome/tspice'

declare global {
  interface Window {
    __tspice_viewer__e2e?: {
      getFrameTransform: (args: { from: string; to: string; et: number }) => Promise<Mat3ColMajor>

      /**
       * Apply a deterministic camera preset intended for visual regression tests.
       *
       * Current presets are intentionally minimal and focused on the Sun.
       */
      setCameraPreset?: (preset: 'sun-close' | 'sun-medium' | 'sun-far') => void

      /** Lock lighting values used by golden images (ambient + sun light intensity). */
      lockDeterministicLighting?: () => void

      /**
       * Render one frame and return basic perf counters.
       *
       * NOTE: this measures CPU time around a single `renderOnce()` call; it is
       * not a GPU timer query.
       */
      samplePerfCounters?: () => {
        cpuFrameMs: number
        drawCalls: number
        triangles: number
        textures: number
      }

      /** Return the last `samplePerfCounters()` result (or null if none). */
      getLastPerfCounters?: () => {
        cpuFrameMs: number
        drawCalls: number
        triangles: number
        textures: number
      } | null
    }

    /** Signals to Playwright tests that the WebGL scene has rendered at least once. */
    __tspice_viewer__rendered_scene?: boolean

    /** Number of in-flight async texture loads (e2e only). */
    __tspice_viewer__pending_texture_loads?: number
  }
}

export {}
