import fs from "node:fs";
import path from "node:path";

// These N0067 routines use temporary outputs immediately after calls that can
// signal an error. Keep the pinned science code and exit under its own trace
// before consuming any undefined logical, plane, rotate matrix or point.
const checks = {
  inedpl: ["psv2pl_(point, span1, span2, dplane);"],
  npelpt: [
    "twovec_(smajor, &c__1, sminor, &c__2, rotate);",
    "nearpt_(prjpnt, &c_b11, &d__1, &c_b12, pnear, dist);",
  ],
  npedln: [
    "surfpt_(sclpt, udir, &scla, &sclb, &sclc, pt, found);",
    "surfpt_(sclpt, oppdir, &scla, &sclb, &sclc, &pt[3], &found[1]);",
    "nvc2pl_(normal, &c_b26, candpl);",
    "inedpl_(&scla, &sclb, &sclc, candpl, cand, &xfound);",
    "nvc2pl_(udir, &c_b26, prjpl);",
    "pjelpl_(cand, prjpl, prjel);",
    "vprjp_(sclpt, prjpl, prjpt);",
    "vprjpi_(prjnpt, prjpl, candpl, pnear, &ifound);",
  ],
};

/** Stage the checked N0067 routines in an ignored native or Emscripten build directory. */
export function stageCheckedGeometrySources(sourceDir, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const [routine, calls] of Object.entries(checks)) {
    const name = routine + ".c";
    let source = fs.readFileSync(path.join(sourceDir, name), "utf8");
    const trace = routine.toUpperCase();
    for (const call of calls) {
      const line = "    " + call + "\n";
      if (source.split(line).length !== 2) {
        throw new Error(`Unexpected N0067 ${name} call site: ${call}`);
      }
      const stop = `    if (failed_()) {\n        chkout_("${trace}", (ftnlen)${trace.length});\n        return 0;\n    }\n`;
      source = source.replace(line, line + stop);
    }
    source = source.replace(
      '#include "f2c.h"',
      '#include "f2c.h"\nextern logical failed_(void);',
    );
    fs.writeFileSync(path.join(destination, name), source);
  }
}
