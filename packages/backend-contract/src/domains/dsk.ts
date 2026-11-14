import type { SpiceHandle, SpiceVector3 } from "../shared/types.js";

import type { SpiceIntCell } from "./cells-windows.js";
import type { DlaDescriptor } from "./file-io.js";

/** Segment descriptor returned by `dskgd` (CSPICE: `SpiceDSKDescr`). */
export type DskDescriptor = {
  // NOTE: these names intentionally mirror the CSPICE struct fields.
  surfce: number;
  center: number;
  dclass: number;
  dtype: number;
  frmcde: number;
  corsys: number;
  /** Coordinate system parameters (CSPICE: `corpar[SPICE_DSK_NSYPAR]`). */
  corpar: number[];

  co1min: number;
  co1max: number;
  co2min: number;
  co2max: number;
  co3min: number;
  co3max: number;
  start: number;
  stop: number;
};

/** Summary bookkeeping parameters for a type 2 DSK segment (CSPICE: `dskb02_c`). */
export type DskType2Bookkeeping = {
  nv: number;
  np: number;
  nvxtot: number;

  /** Vertex bounds: `[[xmin,xmax],[ymin,ymax],[zmin,zmax]]` (CSPICE: `vtxbds[3][2]`). */
  vtxbds: [[number, number], [number, number], [number, number]];

  voxsiz: number;
  voxori: SpiceVector3;
  vgrext: SpiceVector3;

  cgscal: number;
  vtxnpl: number;
  voxnpt: number;
  voxnpl: number;
};

/** Backend contract for DSK (Digital Shape Kernel) segment queries. */
export interface DskApi {
  /**
   * Union this DSK's body IDs into an initialized integer set cell.
   * Existing IDs are retained and results sorted/deduplicated. CSPICE appends
   * segment IDs before deduplication, so temporary capacity can exceed the final
   * unique count. The cell may be partially changed after an error.
   * @param dsk Existing backend filesystem path; the file need not be loaded.
   * @param bodids Live integer cell, initialized even when capacity is zero.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskobj_c.html
   */
  dskobj(dsk: string, bodids: SpiceIntCell): void;

  /**
   * Union surface IDs for `bodyid` into an initialized integer set cell.
   * A body absent from the file leaves the existing set unchanged. Temporary
   * append capacity is required before deduplication, as for `dskobj`.
   * @param bodyid Signed int32 body ID; fractions and overflow are rejected.
   * @param srfids Live integer cell; reinitialize explicitly after an error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dsksrf_c.html
   */
  dsksrf(dsk: string, bodyid: number, srfids: SpiceIntCell): void;

  /**
   * Return all DSK descriptor fields, including ten coordinate parameters,
   * coordinate bounds and ET seconds past J2000. Bound units depend on `corsys`.
   * @param handle Live DAS-backed token for the open file.
   * @param dladsc Valid descriptor obtained from that file's DLA traversal.
   * Invalid integer fields are rejected before FFI. Valid-looking arbitrary
   * addresses cannot establish descriptor ownership; CSPICE leaves effects of
   * invalid descriptors undefined.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskgd_c.html
   */
  dskgd(handle: SpiceHandle, dladsc: DlaDescriptor): DskDescriptor;

  /**
   * Return all type-2 bookkeeping counts, voxel geometry and list sizes.
   * `vtxbds` is [[xmin,xmax],[ymin,ymax],[zmin,zmax]] in km; voxel size/origin
   * are in km and grid extents are integer voxel counts.
   * @param handle Live DAS-backed token for the open file.
   * @param dladsc Valid descriptor for a type-2 segment in this file; callers
   * must establish the type. Invalid descriptors have undefined CSPICE effects.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskb02_c.html
   */
  dskb02(handle: SpiceHandle, dladsc: DlaDescriptor): DskType2Bookkeeping;
}
