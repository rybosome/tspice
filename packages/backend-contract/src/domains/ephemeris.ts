/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type {
  AbCorr,
  Found,
  SpiceStateVector,
  SpkezrResult,
  SpkposResult,
} from "../shared/types.js";
import type { SpiceIntCell, SpiceWindow } from "./cells-windows.js";

/**
 * Packed SPK segment descriptor (DAF summary) as a 5-double array.
 *
 * This is the packed form returned by `spksfs` and accepted by `spkuds`.
 */
export type SpkPackedDescriptor = readonly [number, number, number, number, number];

/** Unpacked SPK segment descriptor (see `spkuds_c`). */
export type SpkUnpackedDescriptor = {
  body: number;
  center: number;
  frame: number;
  type: number;

  first: number;
  last: number;

  baddr: number;
  eaddr: number;
};

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

  /** Compute state (6-vector) and light time via `spkez` (numeric IDs). */
  spkez(
    target: number,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: number,
  ): SpkezrResult;

  /** Compute position (3-vector) and light time via `spkezp` (numeric IDs). */
  spkezp(
    target: number,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: number,
  ): SpkposResult;

  /** Compute geometric state (6-vector) and light time via `spkgeo` (numeric IDs). */
  spkgeo(
    target: number,
    et: number,
    ref: string,
    observer: number,
  ): SpkezrResult;

  /** Compute geometric position (3-vector) and light time via `spkgps` (numeric IDs). */
  spkgps(
    target: number,
    et: number,
    ref: string,
    observer: number,
  ): SpkposResult;

  /** Compute state (6-vector) of `target` relative to the solar system barycenter via `spkssb`. */
  spkssb(target: number, et: number, ref: string): SpiceStateVector;

  /** Compute the coverage window for an object in an SPK via `spkcov`. */
  spkcov(spk: string, idcode: number, cover: SpiceWindow): void;

  /** Find the set of objects present in an SPK via `spkobj`. */
  spkobj(spk: string, ids: SpiceIntCell): void;

  /**
   * Search loaded SPK files for the highest-priority segment applicable to `body` and `et`.
   *
   * Note: `handle` is the native SPICE DAF handle for the file containing the segment.
   */
  spksfs(body: number, et: number): Found<{ handle: number; descr: SpkPackedDescriptor; ident: string }>;

  /** Pack an SPK segment descriptor via `spkpds`. */
  spkpds(
    body: number,
    center: number,
    frame: string,
    type: number,
    first: number,
    last: number,
  ): SpkPackedDescriptor;

  /** Unpack a packed SPK segment descriptor via `spkuds`. */
  spkuds(descr: SpkPackedDescriptor): SpkUnpackedDescriptor;
}
