import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** N0067 UDDF must return before copying an undefined derivative after a callback or QDERIV error. */
export function stageUserDerivative(sourceDir, outputDir) {
  const name = "uddf_c.c";
  let source = fs.readFileSync(path.join(sourceDir, name), "utf8");
  if (
    createHash("sha256").update(source).digest("hex") !==
    "4b6d8536a32a3cdee760bb4e269d2285f535a24f0ece5929e2cd80a4c5f1c3cc"
  )
    throw new Error("Unexpected pinned UDDF translation");
  const guard = '   if (failed_c()) { chkout_c("uddf_c"); return; }';
  for (const call of [
    "   udfunc ( x - dx, &(udval[0]) );",
    "   udfunc ( x + dx, &(udval[1]) );",
    "                   (doublereal *) dfdx );",
  ]) {
    if (source.split(call).length !== 2)
      throw new Error("Unrecognized UDDF output producer");
    source = source.replace(call, call + "\n" + guard);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, name), source);
}
