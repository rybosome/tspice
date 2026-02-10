import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { parseScenario } from "../src/dsl/parse.js";

describe("parseScenario", () => {
  it("canonicalizes absolute fixture-pack paths before expansion", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-parse-"));
    const packDir = path.join(tmp, "pack");
    fs.mkdirSync(packDir, { recursive: true });

    // A fixture pack is a directory containing a meta-kernel named after the dir.
    const metaKernelPath = path.join(packDir, "pack.tm");
    fs.writeFileSync(metaKernelPath, "\\begindata\nKERNELS_TO_LOAD = ( 'a.bsp' )\n", "utf8");

    // Build a path string that still contains `..` segments. (Note: `path.join`
    // will normalize these away, which defeats the purpose of this test.)
    const rawAbsWithDotDots = `${tmp}${path.sep}does-not-exist${path.sep}..${path.sep}pack`;
    expect(path.isAbsolute(rawAbsWithDotDots)).toBe(true);
    expect(rawAbsWithDotDots).not.toBe(path.resolve(rawAbsWithDotDots));

    const ast = parseScenario({
      sourcePath: path.join(tmp, "scenario.yml"),
      data: {
        cases: [{ call: "noop" }],
        setup: { kernels: [rawAbsWithDotDots] },
      },
    });

    const k = ast.setup?.kernels?.[0];
    expect(typeof k).toBe("object");
    expect(k).toMatchObject({
      path: metaKernelPath,
      restrictToDir: packDir,
    });
  });
});
