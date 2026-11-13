import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { expect, it } from "vitest";

it("loads exact tracked SPK/PCK bytes in an isolated empty cache with network disabled", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-offline-kernel-"));
  try {
    const helpers = path.join(root, "helpers"),
      fixtures = path.join(root, "fixtures/kernels/ephemeris-de440s");
    fs.mkdirSync(helpers, { recursive: true });
    fs.mkdirSync(fixtures, { recursive: true });
    const source = fs.readFileSync(
      new URL("./helpers/kernels.ts", import.meta.url),
      "utf8",
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    fs.writeFileSync(path.join(helpers, "kernels.mjs"), compiled);
    const specs = [
      {
        name: "de440s.bsp",
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
        sha256:
          "c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2",
      },
      {
        name: "pck00010.tpc",
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
        sha256:
          "59468328349aa730d18bf1f8d7e86efe6e40b75dfb921908f99321b3a7a701d2",
      },
    ];
    for (const spec of specs)
      fs.copyFileSync(
        fileURLToPath(
          new URL(
            `./fixtures/kernels/ephemeris-de440s/${spec.name}`,
            import.meta.url,
          ),
        ),
        path.join(fixtures, spec.name),
      );
    assert.equal(fs.existsSync(path.join(root, ".cache/kernels")), false);
    // Exercise the actual helper in a separate process and isolated project path.
    // Its old cache is absent regardless of this machine's populated test cache.
    const runner = `import assert from 'node:assert/strict';import crypto from 'node:crypto';import {ensureKernelFile} from './helpers/kernels.mjs';globalThis.fetch=()=>{throw Error('NETWORK_DISABLED_REGRESSION')};for(const spec of ${JSON.stringify(specs)}){const result=await ensureKernelFile(spec);assert.equal(crypto.createHash('sha256').update(result.bytes).digest('hex'),spec.sha256);assert.ok(result.path.endsWith('/fixtures/kernels/ephemeris-de440s/'+spec.name));}await assert.rejects(ensureKernelFile({...${JSON.stringify(specs[0])},sha256:'0'.repeat(64)}),/SHA-256 mismatch/);`;
    const entry = path.join(root, "run.mjs");
    fs.writeFileSync(entry, runner);
    const result = spawnSync(process.execPath, [entry], {
      encoding: "utf8",
      timeout: 15000,
    });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
