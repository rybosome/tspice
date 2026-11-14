import fs from "node:fs";
import path from "node:path";

/** Stage the pinned shared flag with lock-free load/store for native signal delivery. */
export function stageGfSignalFlag(sourceDir, destination) {
  const name = "zzgfsavh_c.c";
  const source = fs.readFileSync(path.join(sourceDir, name), "utf8");
  const original = "static SpiceBoolean signalStatus = SPICEFALSE;";
  if (source.split(original).length !== 2)
    throw new Error("Unexpected N0067 GF interrupt flag declaration");
  const checked = source.replace(
    original,
    [
      "#include <stdatomic.h>",
      '_Static_assert(ATOMIC_INT_LOCK_FREE == 2, "GF signal flag requires lock-free int");',
      "static _Atomic int signalStatus = SPICEFALSE;",
    ].join("\n"),
  );
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, name), checked);
}
