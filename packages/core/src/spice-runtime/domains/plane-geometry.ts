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
