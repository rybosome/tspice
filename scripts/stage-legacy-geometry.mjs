import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// A failed SPICELIB stage may leave automatic state, vectors or flags unwritten.
// Bind edits to the pinned translations, match executable calls, and preserve the
// original toolkit diagnostic before any use of that stage's outputs.
const routines = {
  illum: {
    sha256: "b20011336e9f9c7249124e60b4e2fe9b0b3e56597e5d9aabca44ce2bdeaf488a",
    calls: {
      zzbods2c: 2,
      cidfrm: 1,
      spkez: 2,
      surfnm: 1,
    },
  },
  subpt: {
    sha256: "44b1b635747e58a749346a6343ee200cc24dad18432052f92ea6d695ec7518a3",
    calls: {
      zzbods2c: 2,
      cidfrm: 1,
      spkez: 1,
      surfpt: 1,
    },
  },
  subsol: {
    sha256: "2ae0f688b4ea0b99cd1f75a30c7ee3f8376c0dbef6cc7f5033e57bef9312668e",
    calls: {
      zzbods2c: 2,
      cidfrm: 1,
      ltime: 1,
      spkpos: 1,
      surfpt: 1,
    },
  },
  srfxpt: {
    sha256: "df724ccaeda53b98f0198c0cb99fbbbf2d00219c7c00a22a033f5efb0dc6cb01",
    calls: {
      zzbods2c: 2,
      cidfrm: 1,
      spkezp: 1,
      spkssb: 2,
      stelab: 2,
      stlabx: 2,
      npedln: 1,
      surfpt: 2,
    },
  },
};

/** Stage the four pinned legacy geometry translations with checked intermediate calls. */
export function stageLegacyGeometry(sourceDir, outputDir) {
  for (const [name, { sha256, calls }] of Object.entries(routines)) {
    const source = fs
      .readFileSync(path.join(sourceDir, name + ".c"), "utf8")
      .replaceAll("\r\n", "\n");
    if (createHash("sha256").update(source).digest("hex") !== sha256)
      throw new Error("Unrecognized N0067 source for " + name);
    const start = source.indexOf("    if (return_()) {");
    let body = source.slice(start);
    for (const [callee, expected] of Object.entries(calls)) {
      const match = new RegExp(
        "^([ \\t]*)" + callee + "_" + "\\([^;]*?\\);",
        "gm",
      );
      let changes = 0;
      body = body.replace(match, (call, indent, offset) => {
        if (/^\s*if \(failed_\(\)\)/.test(body.slice(offset + call.length)))
          return call;
        changes++;
        return (
          call +
          "\n" +
          indent +
          'if (failed_()) { chkout_("' +
          name.toUpperCase() +
          '", (ftnlen)' +
          name.length +
          "); return 0; }"
        );
      });
      if (changes !== expected)
        throw new Error(
          "Unexpected number of " + callee + " stages in " + name,
        );
    }
    fs.writeFileSync(
      path.join(outputDir, name + ".c"),
      source.slice(0, start) + body,
    );
  }
}
