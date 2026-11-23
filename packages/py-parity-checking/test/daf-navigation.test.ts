import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const root = path.resolve(import.meta.dirname, "..");
const name = "C01  PACKED  SUMMARY  BYTES\t";

// Each test owns an independently authored scratch file. Only its in-memory
// copy is submitted to the backend; dafopw never opens a repository fixture.
function withFixture<T>(
  check: (file: Uint8Array, expected: Uint8Array) => Promise<T>,
): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-daf-summary-"));
  return (async () => {
    try {
      const fixture = path.join(dir, "navigation.bsp");
      const output: unknown = JSON.parse(
        execFileSync(
          "uv",
          [
            "run",
            "--locked",
            "--project",
            path.join(root, "sidecars/spiceypy"),
            "python",
            path.join(root, "fixtures/generate-navigation-daf.py"),
            fixture,
          ],
          { encoding: "utf8", timeout: 15000 },
        ),
      );
      if (
        !Array.isArray(output) ||
        output.length !== 40 ||
        !output.every(
          (b: unknown) =>
            typeof b === "number" && Number.isInteger(b) && b >= 0 && b <= 255,
        )
      )
        throw Error("Malformed packed oracle bytes");
      return await check(fs.readFileSync(fixture), Uint8Array.from(output));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  })();
}

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      ": reads exact packed summary bits and terminal tab from independent SPICELIB fixture",
    () =>
      withFixture(async (file, expected) => {
        const { spice, dispose } = await spiceClients.toSync({ backend }),
          raw = spice.raw;
        try {
          raw.furnsh({ path: "navigation.bsp", bytes: file });
          raw.unload("navigation.bsp");
          const writer = raw.dafopw("navigation.bsp");
          try {
            expect(raw.dafhsf(writer)).toEqual({ nd: 2, ni: 6 });
            raw.dafbbs(writer);
            expect(raw.daffpa(writer)).toBe(true);
            expect(raw.dafgh()).toBe(writer);
            expect(raw.dafgn(writer)).toBe(name);
            // The shortened prefix ends in a blank; F2C_ConvertStr trims it.
            expect(raw.dafgn(writer, 5)).toBe("C01");
            const summary = raw.dafgs(writer);
            expect(summary).toBeInstanceOf(Uint8Array);
            expect(Array.from(summary)).toEqual(Array.from(expected));
            // Mutating the consumer-owned buffer cannot change the CSPICE summary.
            summary.fill(0);
            expect(Array.from(raw.dafgs(writer))).toEqual(Array.from(expected));
            expect(raw.daffpa(writer)).toBe(false);
            expect(() => raw.dafgs(writer)).toThrow(/NOCURRENTARRAY/);
            raw.dafbfs(writer);
            expect(raw.daffna(writer)).toBe(true);
            expect(raw.dafgn(writer)).toBe(name);
            expect(raw.failed()).toBe(false);
          } finally {
            raw.dafcls(writer);
          }
          // Reopening the same logical file gives a new owned reference.
          const reader = raw.dafopr("navigation.bsp");
          try {
            raw.dafbfs(reader);
            expect(raw.daffna(reader)).toBe(true);
            expect(Array.from(raw.dafgs(reader))).toEqual(Array.from(expected));
          } finally {
            raw.dafcls(reader);
          }
        } finally {
          try {
            raw.kclear();
          } finally {
            await dispose();
          }
        }
      }),
  );
}
