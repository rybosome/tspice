import { assertSpiceInt32 } from "../shared/spice-int.js";

/** N0067's pool holds at most 400,000 values; a corner has three components. */
export function fovWorkspace(room: number, shapelen: number, framelen: number) {
  assertSpiceInt32(room, "room");
  assertSpiceInt32(shapelen, "shapelen");
  assertSpiceInt32(framelen, "framelen");
  if (room < -715827882)
    throw new RangeError("FOV room overflows the toolkit component count");
  return {
    room: Math.min(room, 133334),
    shapelen: Math.min(shapelen, 81),
    framelen: Math.min(framelen, 81),
  };
}

/** Own each component before dispatch so accessors cannot change a validated ray. */
export function fovRayDirection(value: unknown): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError("raydir must be a three-component array");
  function component(entry: unknown, index: number): number {
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new RangeError(`raydir[${index}] must be finite`);
    return entry;
  }
  return [
    component(value[0], 0),
    component(value[1], 1),
    component(value[2], 2),
  ];
}
