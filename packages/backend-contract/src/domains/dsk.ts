import type { Found, SpiceHandle, SpiceVector3 } from "../shared/types.js";

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
  /** Compute phase, solar incidence and emission angles in radians. The surface direction locates a plate in the selected segment; its normal determines the angles. Use an owned open DAS and its traversed DLA descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/illum_pl02.html */
  illum_pl02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    target: string,
    et: number,
    abcorr: string,
    obsrvr: string,
    spoint: Readonly<SpiceVector3>,
  ): { phase: number; solar: number; emissn: number };
  /** Measure the angles in radians for a supplied surface point and one-based plate ID. Return the target epoch (TDB seconds), observer-to-point vector (km), and independent visibility and illumination flags. The routine requires a latitudinal type 2 segment. Use an owned open DAS and its traversed DLA descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/illum_plid_pl02.html */
  illum_plid_pl02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    target: string,
    et: number,
    abcorr: string,
    obsrvr: string,
    spoint: Readonly<SpiceVector3>,
    plid: number,
  ): {
    trgepc: number;
    srfvec: SpiceVector3;
    phase: number;
    solar: number;
    emissn: number;
    visible: boolean;
    lit: boolean;
  };
  /** Sample npts limb locations in their native cyclic order and return every corresponding one-based plate ID, observer position (km) and target epoch. Use an owned open DAS and its traversed DLA descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/limb_pl02.html */
  limb_pl02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    obsrvr: string,
    npts: number,
  ): {
    trgepc: number;
    obspos: SpiceVector3;
    lmbpts: SpiceVector3[];
    pltids: number[];
  };
  /** Intersect radial directions defined by longitude and latitude in radians with the selected segment. Result rows (km) and their one-based plate IDs follow the input order, including repeated directions. Use an owned open DAS and its traversed DLA descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/llgrid_pl02.html */
  llgrid_pl02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    grid: readonly (readonly [number, number])[],
  ): { srfpts: SpiceVector3[]; pltids: number[] };
  /** Find the sub-observer point using INTERCEPT or ELLIPSOID NEAR POINT. Return the segment-frame point (km), altitude (km) and one-based plate ID. Use an owned open DAS and its traversed DLA descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/subpt_pl02.html */
  subpt_pl02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    method: string,
    target: string,
    et: number,
    abcorr: string,
    obsrvr: string,
  ): { spoint: SpiceVector3; alt: number; plateID: number };
  /** Find the subsolar point using INTERCEPT or ELLIPSOID NEAR POINT. Return the segment-frame point (km), distance from the observer (km) and one-based plate ID. Use an owned open DAS and its traversed DLA descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/subsol_pl02.html */
  subsol_pl02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    method: string,
    target: string,
    et: number,
    abcorr: string,
    obsrvr: string,
  ): { spoint: SpiceVector3; dist: number; plateID: number };
  /** Sample the UMBRAL or PENUMBRAL terminator of the named extended source in native order. Return target epoch, observer position and all point/one-based plate ID pairs. Use an owned open DAS and its traversed DLA descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/term_pl02.html */
  term_pl02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    trmtyp: string,
    source: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    obsrvr: string,
    npts: number,
  ): {
    trgepc: number;
    obspos: SpiceVector3;
    trmpts: SpiceVector3[];
    pltids: number[];
  };
  /** Return the nearest intercept (km) and one-based plate ID for a ray in the selected type 2 segment frame. Supply the traversed descriptor from the owning open DAS; a zero direction signals RAYISZEROVECTOR.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskx02_c.html */
  dskx02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    vertex: Readonly<SpiceVector3>,
    raydir: Readonly<SpiceVector3>,
  ): Found<{ plid: number; xpt: SpiceVector3 }>;
  /** Search loaded DSK surfaces for the nearest hit in the target-centered fixref frame at ET (TDB seconds). With pri=false an empty surface list searches all surfaces; pri=true signals BADPRIORITYSPEC. The hit contains the borrowed KEEPER DAS number (comparable to kdata), eight DLA and 24 DSK descriptor components, and defined type 2 source data dc=[] and ic=[plate ID]. Open an owned DAS claim separately to read the source; unload or kclear manages the loaded kernel. Signed maxd and maxi default to 1; smaller capacities reach the toolkit error, and larger capacities retain only defined source words. Uses the linked N0067 DSKXSI implementation with initialized output and the original outer error trace.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskxsi_c.html */
  dskxsi(
    pri: boolean,
    target: string,
    srflst: readonly number[],
    et: number,
    fixref: string,
    vertex: Readonly<SpiceVector3>,
    raydir: Readonly<SpiceVector3>,
    maxd?: number,
    maxi?: number,
  ): Found<{
    xpt: SpiceVector3;
    handle: number;
    dladsc: DlaDescriptor;
    dskdsc: DskDescriptor;
    dc: number[];
    ic: number[];
  }>;
  /** Intersect paired arrays of ray vertices (km) and directions in the target-centered frame at ET. Return one found result per input ray in its original order. Empty ray arrays reach INVALIDCOUNT. A ray with no intercept has no coordinates. Searches are unprioritized and an empty surface list allows all loaded surfaces.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskxv_c.html */
  dskxv(
    pri: boolean,
    target: string,
    srflst: readonly number[],
    et: number,
    fixref: string,
    vertices: readonly Readonly<SpiceVector3>[],
    dirs: readonly Readonly<SpiceVector3>[],
  ): Found<{ xpt: SpiceVector3 }>[];
  /** Read the process/runtime-wide DSK tolerance or margin by its signed integer keyword (1–6). Invalid keys signal INDEXOUTOFRANGE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskgtl_c.html */
  dskgtl(key: number): number;
  /** Set one of the four mutable DSK tolerances or margins. Keys 5 and 6 signal IMMUTABLEVALUE. Values are finite and N0067 applies no additional magnitude or sign checks. Save the old value with dskgtl and restore it explicitly when finished; kclear does not reset these parameters.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskstl_c.html */
  dskstl(key: number, value: number): void;
  /** Read up to room double components of a type-2 item. The scalar offset start is zero-based. Return only initialized values reported by CSPICE, including a shorter final page. Keywords 15 through 19 select the descriptor, vertex bounds, voxel origin, voxel size and flattened xyz vertices.
   * Use a DLA descriptor for this segment obtained by traversal of the open file.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskd02_c.html
   */
  dskd02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    item: number,
    start: number,
    room: number,
  ): number[];

  /** Read up to room integer components of a type-2 item at a zero-based scalar offset. The result is trimmed to the reported count. Keywords 1–14 cover size metadata, grid extents, connectivity, index lists and coarse-grid pointers. Scalar items require start zero because N0067 leaves its internal size unset on other offsets.
   * Use a DLA descriptor for this segment obtained by traversal of the open file.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dski02_c.html
   */
  dski02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    item: number,
    start: number,
    room: number,
  ): number[];

  /** Return the oriented unit normal of the one-based triangular plate ID. The right-handed vertex order determines its direction. A degenerate face may return zero.
   * Use a DLA descriptor for this segment obtained by traversal of the open file.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskn02_c.html
   */
  dskn02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    plid: number,
  ): SpiceVector3;

  /** Read up to room plate triples starting with one-based plate number start. Each owned triple contains three one-based vertex IDs. A final partial page contains only actual plates.
   * Use a DLA descriptor for this segment obtained by traversal of the open file.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskp02_c.html
   */
  dskp02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    start: number,
    room: number,
  ): SpiceVector3[];

  /** Read up to room Cartesian vertex triples starting with one-based vertex number start. Each owned xyz row is in km in the segment frame. The final partial page stops at the last vertex.
   * Use a DLA descriptor for this segment obtained by traversal of the open file.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskv02_c.html
   */
  dskv02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
    start: number,
    room: number,
  ): SpiceVector3[];

  /** Return vertex and triangular plate counts from the selected type-2 DSK segment.
   * Use a DLA descriptor for this segment obtained by traversal of the open file.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskz02_c.html
   */
  dskz02(
    handle: SpiceHandle,
    dladsc: DlaDescriptor,
  ): { nv: number; np: number };

  /** Close an owned DAS-backed DSK reference. On a writer, true requests DAS segregation and false flushes buffered data before low-level closure. Successful closure invalidates this token. A DSK loaded by furnsh must instead be released with unload or kclear.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskcls_c.html
   */
  dskcls(handle: SpiceHandle, optmiz: boolean): void;

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
