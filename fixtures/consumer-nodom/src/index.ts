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

/** Token results retain byte offsets in both local and transported public declarations. */
export async function tokenConsumer(
  spice: Spice,
  remote: SpiceAsync,
): Promise<void> {
  const next: { next: string; rest: string } = spice.raw.nextwd(" alpha beta");
  const nth: { word: string; loc: number } = await remote.raw.nthwd(
    "α beta",
    1,
    4,
  );
  const single: { n: number; items: string[] } = spice.raw.lparse(
    "a,b",
    ",",
    4,
  );
  const multiple: { n: number; items: string[] } = await remote.raw.lparsm(
    "a;b c",
    "; ",
    4,
    3,
  );
  const spans: { last: number; nchar: number }[] = [
    spice.raw.lx4dec(".25", 0),
    await remote.raw.lx4num("1E+3", 0),
    spice.raw.lx4sgn("-3", 0),
    await remote.raw.lx4uns("27", 0),
    spice.raw.lxqstr("'q'", "'", 0),
  ];
  void [next, nth, single, multiple, spans];
}

async function charSetParser(spice: Spice, worker: SpiceAsync): Promise<void> {
  const output = spice.kit.newCharCell(4, 16);
  try {
    spice.raw.lparss("blue,red,blue", ",", output);
  } finally {
    spice.kit.freeCell(output);
  }
  const remote = await worker.kit.newCharCell(4, 16);
  try {
    await worker.raw.lparss("blue,red,blue", ",", remote);
  } finally {
    await worker.kit.freeCell(remote);
  }
}
void charSetParser;
