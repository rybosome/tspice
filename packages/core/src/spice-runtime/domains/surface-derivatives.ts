type Vector3 = [number, number, number];
type State = [number, number, number, number, number, number];
function component(value: unknown, name: string, index: number): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${name}[${index}] must be finite`);
  return value;
}
/** Copy one finite rectangular direction or derivative state, reading each element once. */
export function surfaceVector(value: unknown, length: 3, name: string): Vector3;
export function surfaceVector(value: unknown, length: 6, name: string): State;
export function surfaceVector(
  value: unknown,
  length: 3 | 6,
  name: string,
): Vector3 | State {
  if (!Array.isArray(value) || value.length !== length)
    throw new TypeError(`${name} must be a length-${length} array`);
  const x = component(value[0], name, 0),
    y = component(value[1], name, 1),
    z = component(value[2], name, 2);
  if (length === 3) return [x, y, z];
  return [
    x,
    y,
    z,
    component(value[3], name, 3),
    component(value[4], name, 4),
    component(value[5], name, 5),
  ];
}
