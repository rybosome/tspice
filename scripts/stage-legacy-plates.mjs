import fs from "node:fs";
import path from "node:path";
import { stageAberrationCache } from "./stage-aberration-cache.mjs";
import { stageLimbpt } from "./stage-limbpt.mjs";

/** Combine the E08 correction-cache and E20 remaining-capacity guards, then
 * stop the pinned legacy plate call tree at failed producers. Only build-tree
 * copies are changed. The original successful scientific calls are retained. */
export function stageLegacyPlates(sourceDir, dest) {
  stageAberrationCache(sourceDir, dest);
  // LIMBPT is itself an aberration-cache owner. Its E20 hash is checked on the
  // original source; carry its verified two capacity edits into the staged copy.
  const originalLimb = path.join(sourceDir, "limbpt.c");
  const checkedLimb = path.join(dest, "limbpt.capacity.tmp");
  stageLimbpt(originalLimb, checkedLimb);
  try {
    const parsed = fs.readFileSync(checkedLimb, "utf8");
    const original = fs
      .readFileSync(originalLimb, "utf8")
      .replaceAll("\r\n", "\n");
    const old = "if (npts[i__ - 1] > room) {";
    const fixed = "room = *maxn - (to - 1);\n\t    " + old;
    if (parsed !== original.replaceAll(old, fixed))
      throw new Error("Unexpected LIMBPT capacity repair");
    const file = path.join(dest, "limbpt.c");
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf8").replaceAll(old, fixed),
    );
  } finally {
    fs.unlinkSync(checkedLimb);
  }
  function edit(name, original, checked, staged = false) {
    const file = name + ".c";
    const source = fs
      .readFileSync(path.join(staged ? dest : sourceDir, file), "utf8")
      .replaceAll("\r\n", "\n");
    if (source.split(original).length !== 2)
      throw new Error("Unexpected pinned CSPICE block in " + name);
    fs.writeFileSync(path.join(dest, file), source.replace(original, checked));
  }
  for (const name of ["limb_pl02", "term_pl02"]) {
    const mark =
      'errint_c ( "#",  nBytes                                    );';
    edit(name, mark, mark + '\n      sigerr_c ( "SPICE(MEMORYFAILURE)" );');
  }
  const near =
    "nearpt_c ( sunpos, radii[0], radii[1], radii[2], npt, &npalt );";
  edit(
    "subsol_pl02",
    near,
    [
      'if ( failed_c() ) { chkout_c("subsol_pl02"); return; }',
      "      if ( n != 3 ) {",
      '         setmsg_c("Target radii count must be three but was #.");',
      '         errint_c("#", n); sigerr_c("SPICE(INVALIDCOUNT)");',
      '         chkout_c("subsol_pl02"); return;',
      "      }",
      "      " + near,
    ].join("\n"),
  );
  // DSKX02_C unconditionally converts its private logical after a failed lookup.
  edit(
    "dskx02_c",
    "logical                 fnd;",
    "logical                 fnd = 0;",
  );
  for (const name of ["spkaps", "zzspkfap"]) {
    const mark = "zzstelab_(&xmit, accobs, &stobs[3], starg, pcorr, dpcorr);";
    edit(
      name,
      mark,
      mark +
        '\n    if (failed_()) { chkout_("' +
        name.toUpperCase() +
        '", (ftnlen)' +
        name.length +
        "); return 0; }",
      true,
    );
  }
  for (const name of ["spkcvo", "spkcvt"]) {
    // In OBSERVER locus, the next operation may copy private J2000 output.
    const mark = "if (orfcde == j2code) {\n\t    moved_(j2stat, &c__6, state);";
    edit(
      name,
      mark,
      'if (failed_()) { chkout_("' +
        name.toUpperCase() +
        '", (ftnlen)6); return 0; }\n\t' +
        mark,
      true,
    );
  }
  // Return through the original trace frame while its primary error is active.
  // If stellar aberration fails, its private result is undefined.
  for (const transform of ["stelab", "stlabx"]) {
    const mark = transform + "_(ptarg, &sobs[3], tpos);";
    edit(
      "spkapo",
      mark,
      mark +
        '\n\t    if (failed_()) { chkout_("SPKAPO", (ftnlen)6); return 0; }',
      true,
    );
  }
  // A failed distortion or limb-plane construction leaves private storage undefined.
  for (const [file, steps] of [
    [
      "inedpl_c",
      [
        "pl2psv_c  ( plane, point, span1, span2 );",
        "psv2pl_c ( point, span1, span2, &dplane );",
        "pl2psv_c  ( &dplane, center, vec1, vec2 );",
      ],
    ],
    [
      "edlimb_c",
      [
        "nvc2pl_c ( normal, 1.0, &lplane );",
        "inedpl_c ( scla,  sclb,  sclc,  &lplane,  limb,  &found );",
      ],
    ],
  ]) {
    for (const [index, mark] of steps.entries()) {
      edit(
        file,
        mark,
        mark + '\n   if (failed_c()) { chkout_c("' + file + '"); return; }',
        index > 0,
      );
    }
  }
  const diff = "qderiv_(&c__3, &stobs[3], &stobs[9], &c_b13, acc);";
  edit(
    "spkacs",
    diff,
    'if (failed_()) { chkout_("SPKACS", (ftnlen)6); return 0; }\n\t' + diff,
    true,
  );
}
