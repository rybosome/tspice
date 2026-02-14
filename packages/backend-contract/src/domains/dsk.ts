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
  /** Return the set of body IDs for which the specified DSK has segments. */
  dskobj(dsk: string, bodids: SpiceIntCell): void;

  /** Return the set of surface IDs for which the specified DSK has segments. */
  dsksrf(dsk: string, bodyid: number, srfids: SpiceIntCell): void;

  /** Return the descriptor of a DSK segment. */
  dskgd(handle: SpiceHandle, dladsc: DlaDescriptor): DskDescriptor;

  /** Return the type 2 DSK segment bookkeeping parameters. */
  dskb02(handle: SpiceHandle, dladsc: DlaDescriptor): DskType2Bookkeeping;
}
