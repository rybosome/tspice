import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// N0067 SPICELIB routines with a saved five-character PRVCOR. The list is
// shared by GYP's object list and the native and WASM source staging steps.
const owners = [
  "illumf",
  "illumg",
  "limbpt",
  "sincpt",
  "spkacs",
  "spkapo",
  "spkapp",
  "spkaps",
  "spkcvo",
  "spkcvt",
  "spkez",
  "spkltc",
  "subpnt",
  "subslr",
  "tangpt",
  "termpt",
  "zzsfxcor",
  "zzspkac0",
  "zzspkac1",
  "zzspkap0",
  "zzspkap1",
  "zzspkas0",
  "zzspkas1",
  "zzspkez0",
  "zzspkez1",
  "zzspkfao",
  "zzspkfap",
  "zzspkfat",
  "zzspkflt",
  "zzspkfzo",
  "zzspkfzt",
  "zzspklt0",
  "zzspklt1",
  "zzspkpa0",
  "zzspkpa1",
];

function replaceOnce(source, from, to, file) {
  if (source.split(from).length !== 2) {
    throw new Error(
      `Unexpected N0067 aberration cache source in ${file}: ${from}`,
    );
  }
  return source.replace(from, to);
}

/** Stage the pinned source with cache hits restricted to keys retained in full. */
export function stageAberrationCache(sourceDir, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const declaration = 'static char prvcor[5] = "     ";';
  const compare = "s_cmp(abcorr, prvcor, abcorr_len, (ftnlen)5)";
  const save = "s_copy(prvcor, abcorr, (ftnlen)5, abcorr_len);";
  for (const owner of owners) {
    const file = owner + ".c";
    let source = fs.readFileSync(path.join(sourceDir, file), "utf8");
    source = replaceOnce(
      source,
      declaration,
      declaration + "\n    static logical tspice_complete_prvcor = FALSE_;",
      file,
    );
    source = replaceOnce(
      source,
      compare + " != 0",
      "!tspice_complete_prvcor || " + compare + " != 0",
      file,
    );
    // Fortran S_CMP ignores trailing ASCII blanks. Immediately after S_COPY
    // this is true exactly when no significant byte was lost in the saved key.
    source = replaceOnce(
      source,
      save,
      save + "\n\ttspice_complete_prvcor = (" + compare + " == 0);",
      file,
    );
    fs.writeFileSync(path.join(destination, file), source);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.stdout.write(
    owners.map((owner) => "generated/" + owner + ".c").join(" "),
  );
}
