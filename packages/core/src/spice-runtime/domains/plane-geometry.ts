/** Copy and validate the fixed-size array representation used for CSPICE plane geometry. */
function checkShape(
  value: unknown,
  length: number,
  label: string,
): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length !== length)
    throw new TypeError(`${label} must be a length-${length} array`);
}

/** Scientific results may contain nonfinite IEEE values even with finite inputs. */
export function planeComponent(
  value: unknown,
  label: string,
  finite: boolean,
): number {
  if (typeof value !== "number")
    throw new TypeError(`${label} must be numeric`);
  if (finite && !Number.isFinite(value))
    throw new RangeError(`${label} must be finite`);
  return value;
}

/** Snapshot each entry of a finite input vector, or own a possibly nonfinite result. */
export function copyPlaneVector(
  value: unknown,
  label: string,
  finite: boolean,
): [number, number, number] {
  checkShape(value, 3, label);
  return [
    planeComponent(value[0], label, finite),
    planeComponent(value[1], label, finite),
    planeComponent(value[2], label, finite),
  ];
}

/** Snapshot the three normal coordinates and the constant in their CSPICE order. */
export function copyPlaneComponents(
  value: unknown,
  label: string,
  finite: boolean,
): [number, number, number, number] {
  checkShape(value, 4, label);
  return [
    planeComponent(value[0], label, finite),
    planeComponent(value[1], label, finite),
    planeComponent(value[2], label, finite),
    planeComponent(value[3], label, finite),
  ];
}

/** Preserve the three intersection classifications emitted by INRYPL. */
export function planeIntersectionCount(value: unknown): -1 | 0 | 1 {
  if (value !== -1 && value !== 0 && value !== 1)
    throw new TypeError("Invalid CSPICE ray/plane intersection count");
  return value;
}

/** Pack the three caller-owned vectors once into named-field order for the native interfaces. */
export function packEllipse(value: unknown, label: string): number[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !("center" in value) ||
    !("semiMajor" in value) ||
    !("semiMinor" in value)
  )
    throw new TypeError(
      `${label} must contain center, semiMajor and semiMinor vectors`,
    );
  return [
    ...copyPlaneVector(value.center, label + ".center", true),
    ...copyPlaneVector(value.semiMajor, label + ".semiMajor", true),
    ...copyPlaneVector(value.semiMinor, label + ".semiMinor", true),
  ];
}

/** Validate every returned scalar and copy all three C ellipse components, including IEEE extrema. */
export function unpackEllipse(
  value: unknown,
  label: string,
): {
  center: [number, number, number];
  semiMajor: [number, number, number];
  semiMinor: [number, number, number];
} {
  checkShape(value, 9, label);
  function vector(data: unknown[], offset: number): [number, number, number] {
    return [
      planeComponent(data[offset], label, false),
      planeComponent(data[offset + 1], label, false),
      planeComponent(data[offset + 2], label, false),
    ];
  }
  return {
    center: vector(value, 0),
    semiMajor: vector(value, 3),
    semiMinor: vector(value, 6),
  };
}

/** CSPICE defines intersection points only for the two positive count classifications. */
export function ellipseIntersectionCount(value: unknown): -1 | 0 | 1 | 2 {
  if (value !== -1 && value !== 0 && value !== 1 && value !== 2)
    throw new TypeError("Invalid CSPICE ellipse/plane intersection count");
  return value;
}
