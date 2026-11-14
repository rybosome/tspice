import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { Spice, SpiceAsync } from "@rybosome/tspice";

/** Check raw CSPICE string methods and byte-capacity overloads in a consumer without DOM types. */
export async function stringConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const compress: string = spice.raw.cmprss(" ", 1, " a  B ");
  const equal: boolean = spice.raw.eqstr("a b", "AB");
  const whitespace: boolean = spice.raw.iswhsp("\t");
  const last: number = spice.raw.lastnb("é ");
  const lower: string = spice.raw.lcase("ABC", 3);
  const upper: string = spice.raw.ucase("abc");
  const insensitive: boolean = spice.raw.matchi("ABC", "a*", "*", "?");
  const sensitive: boolean = spice.raw.matchw("ABC", "A?C", "*", "?");
  const asyncCompress: string = await asyncSpice.raw.cmprss(" ", 2, "a  b", 5);
  const asyncEqual: boolean = await asyncSpice.raw.eqstr("ab", "AB");
  const asyncWhitespace: boolean = await asyncSpice.raw.iswhsp("");
  const asyncLast: number = await asyncSpice.raw.lastnb("");
  const asyncLower: string = await asyncSpice.raw.lcase("ABC");
  const asyncUpper: string = await asyncSpice.raw.ucase("abc", 2);
  const asyncInsensitive: boolean = await asyncSpice.raw.matchi(
    "ABC",
    "a*",
    "*",
    "?",
  );
  const asyncSensitive: boolean = await asyncSpice.raw.matchw(
    "ABC",
    "A?C",
    "*",
    "?",
  );
  void [
    compress,
    equal,
    whitespace,
    last,
    lower,
    upper,
    insensitive,
    sensitive,
    asyncCompress,
    asyncEqual,
    asyncWhitespace,
    asyncLast,
    asyncLower,
    asyncUpper,
    asyncInsensitive,
    asyncSensitive,
  ];
}

/** Check UTF-8 search positions and readonly search arrays for sync and async callers. */
export async function searchConsumer(
  spice: Spice,
  asyncSpice: SpiceAsync,
): Promise<void> {
  const values: readonly string[] = ["Earth", "Moon"];
  const indices: number[] = [
    spice.raw.cpos("Earth", "r", 0),
    spice.raw.cposr("Earth", "t", 4),
    spice.raw.ncpos("Earth", "a", 0),
    spice.raw.ncposr("Earth", "h", 4),
    spice.raw.pos("Earth", "ar", 0),
    spice.raw.posr("Earth", "th", 4),
    spice.raw.esrchc("moon", values),
    await asyncSpice.raw.cpos("Earth", "r", 0),
    await asyncSpice.raw.cposr("Earth", "t", 4),
    await asyncSpice.raw.ncpos("Earth", "a", 0),
    await asyncSpice.raw.ncposr("Earth", "h", 4),
    await asyncSpice.raw.pos("Earth", "ar", 0),
    await asyncSpice.raw.posr("Earth", "th", 4),
    await asyncSpice.raw.esrchc("moon", values),
  ];
  void indices;
}
