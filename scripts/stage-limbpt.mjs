import { createHash } from "node:crypto";
import fs from "node:fs";

/** Stage N0067 LIMBPT with its existing OUTOFROOM check applied to remaining capacity. */
export function stageLimbpt(sourcePath, targetPath) {
  const source = fs.readFileSync(sourcePath, "utf8").replaceAll("\r\n", "\n");
  const hash = createHash("sha256").update(source).digest("hex");
  if (
    hash !== "22c6f37d8271c3123d7b7f8a43726d09d1dc55b4c446dd765be2da81cd740a52"
  )
    throw new Error("Unrecognized N0067 LIMBPT source for capacity validation");
  const check = "if (npts[i__ - 1] > room) {";
  if (source.split(check).length !== 3)
    throw new Error(
      "Expected one capacity check for each LIMBPT correction locus",
    );
  const checked = source.replaceAll(
    check,
    "room = *maxn - (to - 1);\n\t    " + check,
  );
  fs.writeFileSync(targetPath, checked);
}
