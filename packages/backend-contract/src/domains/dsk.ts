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
  /** Sum the areas of triangular plates, including repeated plates. Flat xyz vertices and signed one-based index triples determine the two counts. Empty plates yield zero. A nonempty set needs at least three vertices. Invalid references signal INDEXOUTOFRANGE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pltar_c.html
   */
  pltar(vertices: readonly number[], plates: readonly number[]): number;

  /** Expand the three xyz rows of a triangle about their centroid by the factor 1 + delta. Zero preserves the triangle, −1 collapses it, and smaller values pass through the centroid. Return all nine coordinates in vertex order in a new array.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pltexp_c.html
   */
  pltexp(
    iverts: readonly number[],
    delta: number,
  ): [number, number, number, number, number, number, number, number, number];

  /** Return a closest point on the closed triangular plate and its nonnegative distance, including projections onto edges or vertices. Collinear and coincident vertices are handled by the pinned segment or point path. Coordinates and distance have the same length unit.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pltnp_c.html
   */
  pltnp(
    point: Readonly<SpiceVector3>,
    v1: Readonly<SpiceVector3>,
    v2: Readonly<SpiceVector3>,
    v3: Readonly<SpiceVector3>,
  ): { pnear: SpiceVector3; dist: number };

  /** Compute the oriented, unnormalized cross product of consecutive plate edges. Its magnitude equals twice the plate area. Reversing winding changes the sign, and a degenerate plate can return the zero vector.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pltnrm_c.html
   */
  pltnrm(
    v1: Readonly<SpiceVector3>,
    v2: Readonly<SpiceVector3>,
    v3: Readonly<SpiceVector3>,
  ): SpiceVector3;

  /** Sum the signed tetrahedral volumes of an oriented closed plate model. Consistently outward faces give positive enclosed volume, reversed faces negative. Supply at least four vertices and four plates, using one-based indices. CSPICE checks counts and indices but assumes a valid boundary.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pltvol_c.html
   */
  pltvol(vertices: readonly number[], plates: readonly number[]): number;

  /** Compute the third-coordinate bounds of a type-2 plate mesh. Code 1 uses radius, 3 rectangular z, and 4 planetodetic altitude. For 4 supply at least [equatorialRadius, flattening]. Other codes use no parameters. All vertices contribute to maxima. For 1 and 4 each plate reference must be in 1..vertexCount. The planetodetic lower bound assumes convexity of the corresponding altitude surface.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskrb2_c.html
   */
  dskrb2(
    vertices: readonly number[],
    plates: readonly number[],
    corsys: number,
    corpar?: readonly number[],
  ): { mncor3: number; mxcor3: number };

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
