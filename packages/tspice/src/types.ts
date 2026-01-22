/** 3-vector, typically kilometers or km/s depending on context. */
export type Vec3 = readonly [number, number, number];

/** 6-vector, typically (x,y,z,vx,vy,vz). */
export type Vec6 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

/** 3x3 matrix, row-major. */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** SPICE frame name (e.g. "J2000", "IAU_EARTH"). */
export type FrameName = string;

/** Aberration correction string accepted by `spkezr`. */
export type AberrationCorrection =
  | "NONE"
  | "LT"
  | "LT+S"
  | "CN"
  | "CN+S"
  | "XLT"
  | "XLT+S"
  | "XCN"
  | "XCN+S";

export type SpiceTime = number & { readonly __tspiceBrand: "SpiceTime" };

export type StateVector = {
  /** Seconds past J2000 (ET). */
  et: SpiceTime;
  /** Reference frame used for `position`/`velocity`. */
  frame: FrameName;
  /** Target body/ID string used for the query. */
  target: string;
  /** Observer body/ID string used for the query. */
  observer: string;
  /** Aberration correction used for the query. */
  aberration: AberrationCorrection;

  position: Vec3;
  velocity: Vec3;
  /** One-way light time (seconds). */
  lightTime: number;
};

export type GetStateArgs = {
  target: string;
  observer: string;
  at: SpiceTime;
  frame?: FrameName;
  aberration?: AberrationCorrection;
};
