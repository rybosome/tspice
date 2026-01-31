import { listDefaultVisibleBodies } from "../scene/BodyRegistry.js";
import type { SpiceClient } from "../spice/SpiceClient.js";

/**
* Hard UTC bounds enforced by the viewer.
*
* Notes:
* - These are interpreted via SPICE `str2et` (via `utcToEt`).
* - We *never* allow the scrub range outside 1950..2050 (inclusive).
* - Kernel coverage may be smaller; in that case we clamp inward.
*/
export const VIEWER_SCRUB_UTC_HARD_MIN = "1950-01-01T00:00:00Z";

// de432s.bsp coverage ends around 2050-01-02 (per kernel comments), so we use
// that as the viewer's maximum allowed UTC.
export const VIEWER_SCRUB_UTC_HARD_MAX = "2050-01-02T00:00:00Z";

export type ViewerScrubRange = {
  minEtSec: number;
  maxEtSec: number;

  /** UTC endpoints used for conversion (for logging/debugging). */
  hardMinUtc: string;
  hardMaxUtc: string;

  hardMinEtSec: number;
  hardMaxEtSec: number;

  /** True if we had to clamp due to kernel coverage validation. */
  clampedToKernelCoverage: boolean;
};

type UtcToEt = (utc: string) => number;

/**
* Compute scrub min/max ET seconds.
*
* Call this only after loading the required kernels (at least the LSK), so
* `utcToEt` can do a correct `str2et` conversion.
*/
export function computeViewerScrubRangeEt(input: {
  utcToEt: UtcToEt;
  /** Optional kernel-coverage validator (best-effort). */
  validateEt?: (et: number) => boolean;
}): ViewerScrubRange {
  const hardMinUtc = VIEWER_SCRUB_UTC_HARD_MIN;
  const hardMaxUtc = VIEWER_SCRUB_UTC_HARD_MAX;

  const hardMinEtSec = input.utcToEt(hardMinUtc);
  const hardMaxEtSec = input.utcToEt(hardMaxUtc);

  const validateEt = input.validateEt;

  let minEtSec = hardMinEtSec;
  let maxEtSec = hardMaxEtSec;
  let clampedToKernelCoverage = false;

  if (validateEt) {
    // Most of the time both endpoints are valid and we can skip extra work.
    if (!validateEt(minEtSec)) {
      const found = findFirstValidEt({ minEtSec, maxEtSec, validateEt });
      if (found != null) {
        minEtSec = found;
        clampedToKernelCoverage = true;
      }
    }

    if (!validateEt(maxEtSec)) {
      const found = findLastValidEt({ minEtSec, maxEtSec, validateEt });
      if (found != null) {
        maxEtSec = found;
        clampedToKernelCoverage = true;
      }
    }
  }

  // Best-effort safety: always preserve ordering.
  if (!(minEtSec < maxEtSec)) {
    minEtSec = hardMinEtSec;
    maxEtSec = hardMaxEtSec;
    clampedToKernelCoverage = false;
  }

  return {
    minEtSec,
    maxEtSec,
    hardMinUtc,
    hardMaxUtc,
    hardMinEtSec,
    hardMaxEtSec,
    clampedToKernelCoverage,
  };
}

const BOUNDARY_EPSILON_SEC = 1;

function findFirstValidEt(input: {
  minEtSec: number;
  maxEtSec: number;
  validateEt: (et: number) => boolean;
}): number | null {
  let lo = input.minEtSec;
  let hi = input.maxEtSec;

  if (input.validateEt(lo)) return lo;
  if (!input.validateEt(hi)) return null;

  // Binary search for the earliest valid ET.
  while (hi - lo > BOUNDARY_EPSILON_SEC) {
    const mid = (lo + hi) * 0.5;
    if (input.validateEt(mid)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return hi;
}

function findLastValidEt(input: {
  minEtSec: number;
  maxEtSec: number;
  validateEt: (et: number) => boolean;
}): number | null {
  let lo = input.minEtSec;
  let hi = input.maxEtSec;

  if (input.validateEt(hi)) return hi;
  if (!input.validateEt(lo)) return null;

  // Binary search for the latest valid ET.
  while (hi - lo > BOUNDARY_EPSILON_SEC) {
    const mid = (lo + hi) * 0.5;
    if (input.validateEt(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
* Best-effort validator for whether the viewer can render its default bodies at
* the given time.
*
* We use this to clamp the scrub range to the actual kernel pack coverage.
*/
export function validateViewerEtForLoadedKernels(input: {
  spiceClient: SpiceClient;
  etSec: number;
}): boolean {
  try {
    // Default visible bodies are all queried relative to SUN in SceneCanvas.
    // (Moon is special-cased into the scene, so we include it explicitly.)
    const bodies = [...listDefaultVisibleBodies().map((b) => b.body), "MOON"];

    for (const body of bodies) {
      input.spiceClient.getBodyState({
        target: body,
        observer: "SUN",
        frame: "J2000",
        et: input.etSec,
      });

      // The lighting pass queries the Sun relative to the focus body.
      input.spiceClient.getBodyState({
        target: "SUN",
        observer: body,
        frame: "J2000",
        et: input.etSec,
      });
    }

    return true;
  } catch {
    return false;
  }
}
