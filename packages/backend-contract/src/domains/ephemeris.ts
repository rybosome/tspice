import type { AbCorr, SpkezrResult, SpkposResult } from "../shared/types.js";

export interface EphemerisApi {
  /** Compute state (6-vector) and light time via `spkezr`. */
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkezrResult;

  /** Compute position (3-vector) and light time via `spkpos`. */
  spkpos(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkposResult;
}
