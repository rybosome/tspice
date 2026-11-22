import { spiceStringByteLength } from "./string-bytes.js";
import { assertSpiceInt32 } from "../shared/spice-int.js";

/** Validate the input/output buffer shape for CSPICE's GET/SET error policy operations. */
export function policyArguments(
  op: string,
  argument: number | string | undefined,
  full: number,
) {
  spiceStringByteLength(op, "operation");
  const set = op.trim().toUpperCase() === "SET";
  if (set) {
    if (typeof argument !== "string")
      throw new TypeError("SET requires a string value");
    spiceStringByteLength(argument, "policy value");
    return { set, value: argument, capacity: full };
  }
  const capacity = argument === undefined ? full : argument;
  if (typeof capacity !== "number")
    throw new TypeError("GET requires a numeric byte capacity");
  assertSpiceInt32(capacity, "policy capacity");
  return { set, value: "", capacity: Math.min(capacity, full) };
}
