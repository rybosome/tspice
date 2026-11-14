import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const hashes = {
  "inquire.c":
    "6ec48c682ae87f6ebc1dc5863637bd2ead141409b662d79db8fbb7ed7727c698",
  "rdtext.c":
    "e3184b040f63baaf1ceed1976f4f5ca8083e745bd3e97377607da56941c5fa81",
  "rdtext_c.c":
    "1aaa5e03f7a73fc43b71eb4f796cc7e4ceaffee032ecb2b2ca5a5127d8fba627",
};
/** Stage the exact pinned reader and f2c definitions with initialized error outputs and valid unit bookkeeping. */
export function stageCheckedTextSources(sourceDir, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const [file, hash] of Object.entries(hashes)) {
    let source = fs.readFileSync(path.join(sourceDir, file), "utf8");
    if (crypto.createHash("sha256").update(source).digest("hex") !== hash)
      throw new Error("Unexpected N0067 text source: " + file);
    const replace = (before, after) => {
      if (source.split(before).length !== 2)
        throw new Error("Unexpected text reader call site in " + file);
      source = source.replace(before, after);
    };
    if (file === "inquire.c") {
      replace(
        "*a->innum= p-f__units;",
        "*a->innum= p ? (int)(p-f__units) : -1;",
      );
    } else if (file === "rdtext_c.c") {
      replace(
        "logical                 endfil;",
        "logical                 endfil = 0;",
      );
      replace(
        "   *eof  =  endfil;",
        '   if (failed_c()) { chkout_c("rdtext_c"); return; }\n   *eof  =  endfil;',
      );
    } else {
      // Keep all build paths on the same original RDTEXT unit registry.
      // Notify the shim even if a different toolkit routine closes its reader.
      replace(
        '#include "f2c.h"',
        '#include "f2c.h"\nextern void tspice_text_unit_closed(int);',
      );
      replace(
        "case 1: goto L_cltext;",
        'case 1: goto L_cltext;\n        case 3: return lstunt;\n        case 2: number = *eof; chkin_("CLTEXT", (ftnlen)6); goto tspice_close_known_unit;',
      );
      // A failed switch may change INDEX without publishing a new LSTFIL or LSTUNT.
      replace(
        "    if (! same) {",
        '    if (! same) {\n        s_copy(lstfil," ",(ftnlen)255,(ftnlen)1);',
      );
      replace(
        "getlun_(&unit);",
        'getlun_(&unit);\n            if (failed_()) { chkout_("RDTEXT",(ftnlen)6); return 0; }',
      );
      replace(
        "extern logical return_(void);",
        "extern logical return_(void), failed_(void);",
      );
      replace(
        "    index = isrchi_(&number, &n, units);\n    if (index > 0)",
        '    tspice_close_known_unit:\n    /* A close changes the saved index even when its file is absent. */\n    s_copy(lstfil," ",(ftnlen)255,(ftnlen)1);\n    index = isrchi_(&number, &n, units);\n    if (index > 0)',
      );
      // Publish actual owned closures to both wrapper and toolkit-internal calls.
      const close = "f_clos(&cl__1);";
      if (source.split(close).length !== 3)
        throw new Error("Unexpected RDTEXT close sites");
      source = source.replaceAll(
        close,
        close + "\n        tspice_text_unit_closed(cl__1.cunit);",
      );
      source +=
        "\n/* Close only a verified live reader lease, using the canonical unit cleanup. */\nint tspice_close_text_unit(int unit){return rdtext_0_(2,0,0,&unit,0,0);}\n/* Called only after a successful non-EOF read under the same toolkit lock. */\nint tspice_last_read_text_unit(void){return rdtext_0_(3,0,0,0,0,0);}\n";
    }
    fs.writeFileSync(path.join(destination, file), source);
  }
}
