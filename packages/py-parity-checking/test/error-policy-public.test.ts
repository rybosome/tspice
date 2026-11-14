import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const helpers = fileURLToPath(new URL("./_helpers/", import.meta.url));
const project = fileURLToPath(
  new URL("../sidecars/spiceypy/", import.meta.url),
);
function child(
  backend: "node" | "wasm" | "python",
  device: string,
  mask = "NONE, SHORT, LONG",
) {
  const proc =
    backend === "python"
      ? spawnSync(
          "uv",
          [
            "run",
            "--locked",
            "--project",
            project,
            "python",
            path.join(helpers, "error-policy-effects.py"),
            device,
            mask,
          ],
          { encoding: "utf8", timeout: 15000 },
        )
      : spawnSync(
          process.execPath,
          [
            path.join(helpers, "error-policy-effects.mjs"),
            backend,
            device,
            mask,
          ],
          { encoding: "utf8", timeout: 15000 },
        );
  if (proc.error) throw proc.error;
  expect(proc.signal).toBeNull();
  return proc;
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  for (const [device, mask] of [
    ["SCREEN", "NONE, SHORT"],
    ["SCREEN", "NONE, LONG"],
    ["NULL", "DEFAULT"],
    ["SCREEN", "NONE"],
  ] as const) {
    run(
      backend + " writes the independent " + mask + " report to " + device,
      () => {
        const reference = child("python", device, mask),
          actual = child(backend, device, mask);
        expect(reference.status, reference.stderr).toBe(0);
        expect(actual.status, actual.stderr).toBe(0);
        expect(actual.stdout).toBe(reference.stdout);
        if (device === "NULL" || mask === "NONE")
          expect(reference.stdout).toBe("");
        else {
          expect(reference.stdout.includes("SPICE(B07DISPOSITION)")).toBe(
            mask.includes("SHORT"),
          );
          expect(
            reference.stdout.includes("A B07 diagnostic with a second field."),
          ).toBe(mask.includes("LONG"));
        }
      },
    );
  }
  for (const flavor of ["sync", "async"] as const) {
    run(
      backend +
        " " +
        flavor +
        " cached policy calls observe prior mutations and captured errors",
      async () => {
        const builder = spiceClients.caching({ maxEntries: 100 });
        const client =
          flavor === "sync"
            ? await builder.toSync({ backend })
            : await builder.toAsync({ backend });
        const raw = client.spice.raw;
        const oldDevice = await raw.errdev("GET"),
          oldMask = await raw.errprt("GET");
        try {
          await raw.errdev("SET", "NULL");
          await raw.errdev("SET", "SCREEN");
          await raw.errdev("SET", "NULL");
          expect(await raw.errdev("GET")).toBe("NULL");
          await raw.errprt("SET", "NONE, SHORT");
          expect(await raw.errprt("GET")).toBe("SHORT");
          await raw.errprt("SET", "NONE, LONG");
          expect(await raw.errprt("GET")).toBe("LONG");
          await expect(
            Promise.resolve().then(() =>
              raw.errprt("SET", "NONE, SHORT, INVALID, LONG"),
            ),
          ).rejects.toMatchObject({ spiceShort: "SPICE(INVALIDLISTITEM)" });
          expect(await raw.errprt("GET")).toBe("SHORT, LONG");
          await expect(
            Promise.resolve().then(() => raw.sigerr("SPICE(CACHED)")),
          ).rejects.toMatchObject({ spiceShort: "SPICE(CACHED)" });
          for (const name of ["OLDER", "NEWER"]) {
            await raw.chkin(name);
            expect(await raw.trcnam(0)).toBe(name);
            expect(await raw.qcktrc()).toBe(name);
            await raw.chkout(name);
            expect(await raw.trcdep()).toBe(0);
          }
          await raw.errdev("SET", "Aé\t");
          expect(await raw.errdev("GET", 4)).toBe("Aé");
          await expect(
            Promise.resolve().then(() => raw.errdev("GET", 3)),
          ).rejects.toThrow();
          expect(await raw.errdev("GET")).toBe("Aé\t");
        } finally {
          await raw.errdev("SET", oldDevice);
          await raw.errprt("SET", "NONE");
          if (oldMask) await raw.errprt("SET", oldMask);
          await client.dispose();
        }
      },
    );
  }
}
it.runIf(nodeBackendAvailable)(
  "native writes every byte of the same fresh caller-owned file as the independent toolkit",
  () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tspice-b07-"));
    try {
      const reference = path.join(dir, "reference.log"),
        file = path.join(dir, "native.log");
      const oracle = child("python", reference),
        actual = child("node", file);
      expect(oracle.status).toBe(0);
      expect(actual.status).toBe(0);
      expect(actual.stdout).toBe(oracle.stdout);
      const bytes = readFileSync(reference);
      expect(bytes.toString()).toContain("B07DISPOSITION");
      expect(bytes.toString()).toContain("second field.");
      expect(readFileSync(file)).toEqual(bytes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

it("WASM file bytes flushed by the retained unit match the independent file byte-for-byte", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tspice-b07-file-"));
  try {
    const file = path.join(dir, "oracle.log");
    const reference = spawnSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        project,
        "python",
        path.join(helpers, "error-policy-effects.py"),
        file,
        "NONE, SHORT, LONG",
        "100",
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    expect(reference.status, reference.stderr).toBe(0);
    const module = spawnSync(
      process.execPath,
      [path.join(helpers, "error-policy-module.mjs")],
      { timeout: 15000 },
    );
    expect(module.status, module.stderr.toString()).toBe(0);
    const oracle = readFileSync(file);
    expect(module.stdout.byteLength).toBeGreaterThan(4096);
    expect(module.stdout.byteLength).toBeLessThanOrEqual(oracle.byteLength);
    expect(module.stdout).toEqual(oracle.subarray(0, module.stdout.byteLength));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("the independent toolkit retains valid ERRPRT changes on either side of an invalid list entry", () => {
  const program = `import ctypes as c, spiceypy as s, json
f=c.CDLL(s.libspice._name).errprt_c
f.argtypes=[c.c_char_p,c.c_int,c.POINTER(c.c_char)]
f.restype=None
s.errdev("SET",8,"NULL")
f(b"SET",0,c.create_string_buffer(b"NONE, SHORT, INVALID, LONG"))
short=s.getmsg("SHORT",80)
s.reset()
out=c.create_string_buffer(41)
f(b"GET",41,out)
print(json.dumps([short,out.value.decode(),s.failed()]))`;
  const oracle = spawnSync(
    "uv",
    ["run", "--locked", "--project", project, "python", "-c", program],
    { encoding: "utf8", timeout: 15000 },
  );
  expect(oracle.status, oracle.stderr).toBe(0);
  expect(JSON.parse(oracle.stdout)).toEqual([
    "SPICE(INVALIDLISTITEM)",
    "SHORT, LONG",
    false,
  ]);
});

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      " client disposal and recreation observes the actual toolkit policy lifetime",
    () => {
      const child = spawnSync(
        process.execPath,
        [path.join(helpers, "error-device-lifetime.mjs"), backend],
        { encoding: "utf8", timeout: 15000 },
      );
      expect(child.status, child.stderr).toBe(0);
      expect(JSON.parse(child.stdout)).toEqual(
        backend === "node"
          ? ["NULL", "SHORT", 0, ""]
          : ["SCREEN", "", 1, "SECOND"],
      );
    },
  );
}
