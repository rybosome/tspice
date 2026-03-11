import os from "node:os";
import path from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunCaseInputV2 } from "../../src/runners/types.js";

const { toSyncMock } = vi.hoisted(() => ({
  toSyncMock: vi.fn(),
}));

vi.mock("@rybosome/tspice", () => ({
  spiceClients: {
    toSync: toSyncMock,
  },
}));

import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";

function createInput(method: string, args: unknown[]): RunCaseInputV2 {
  const inRefs = args.map((_, index) => `$args.${index}`);

  return {
    schemaVersion: 3,
    manifest: {
      id: `methods/${method.replaceAll(".", "/")}@v3`,
      kind: "method",
    },
    contract: {
      contractMethod: method,
      canonicalMethod: method,
      result: { const: null },
      errors: [{ code: "invalid_args" }, { code: "spice_error" }],
    },
    args,
    workflow: {
      steps: [{ op: "call", call: method, in: inRefs }],
    },
  };
}

function createRawBackend(
  kind: "node" | "wasm",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind,
    kclear: vi.fn(),
    reset: vi.fn(),
    failed: vi.fn(() => false),
    getmsg: vi.fn(() => ""),

    furnsh: vi.fn(),
    exists: vi.fn(() => true),
    getfat: vi.fn(() => ({ arch: "DAF", type: "SPK" })),

    dlaopn: vi.fn(() => 11),
    dlabfs: vi.fn(() => ({ found: false })),
    dlacls: vi.fn(),

    ...overrides,
  };
}

afterEach(() => {
  toSyncMock.mockReset();
});

describe.skip("tspiceRunner file-io wasm staging + temp cleanup", () => {
  it("stages wasm file-io OS paths without calling furnsh", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "tspice-parity-stage-"));
    const osPath = path.join(tempDir, "exists-target.bsp");
    const bytes = Buffer.from("stage-me", "utf8");
    await writeFile(osPath, bytes);

    const stageVirtual = vi.fn();
    const exists = vi.fn(() => true);
    const furnsh = vi.fn();

    const raw = createRawBackend("wasm", {
      __stageVirtualFileForFileIo: stageVirtual,
      exists,
      furnsh,
    });

    toSyncMock.mockResolvedValueOnce({
      spice: { raw, kit: {} },
    });

    const runner = await createTspiceRunner({ backend: "wasm" });
    try {
      const out = await runner.runCase(createInput("file-io.exists", [osPath]));

      expect(out).toEqual({ ok: true, result: { exists: true } });
      expect(stageVirtual).toHaveBeenCalledTimes(1);
      expect(furnsh).not.toHaveBeenCalled();

      const [virtualPath, stagedBytes] = stageVirtual.mock.calls[0]!;
      expect(typeof virtualPath).toBe("string");
      expect(Buffer.from(stagedBytes as Uint8Array)).toEqual(bytes);
      expect(exists).toHaveBeenCalledWith(virtualPath);
    } finally {
      await runner.dispose?.();
    }
  });

  it("deletes temp .dla file from node filesystem after file-io.dlaopn", async () => {
    let openedPath: string | undefined;

    const raw = createRawBackend("node", {
      dlaopn: vi.fn((filePath: string) => {
        openedPath = filePath;
        writeFileSync(filePath, "temp-dla");
        return 21;
      }),
      dlabfs: vi.fn(() => ({ found: false })),
    });

    toSyncMock.mockResolvedValueOnce({
      spice: { raw, kit: {} },
    });

    const runner = await createTspiceRunner({ backend: "node" });
    try {
      const out = await runner.runCase(createInput("file-io.dlaopn", ["tag", "DAF/DLA", "ifname", 0]));

      expect(out).toEqual({ ok: true, result: { found: false } });
      expect(openedPath).toBeDefined();
      expect(existsSync(openedPath!)).toBe(false);
    } finally {
      await runner.dispose?.();
    }
  });

  it("keeps dlacls errors visible even if wasm virtual-file cleanup fails", async () => {
    const closeError = new Error("close failed");
    const cleanupError = new Error("cleanup failed");
    let openedVirtualPath: string | undefined;

    const deleteVirtual = vi.fn(() => {
      throw cleanupError;
    });

    const raw = createRawBackend("wasm", {
      __stageVirtualFileForFileIo: vi.fn(),
      __deleteVirtualFileForFileIo: deleteVirtual,
      dlaopn: vi.fn((filePath: string) => {
        openedVirtualPath = filePath;
        return 31;
      }),
      dlabfs: vi.fn(() => ({ found: false })),
      dlacls: vi.fn(() => {
        throw closeError;
      }),
    });

    toSyncMock.mockResolvedValueOnce({
      spice: { raw, kit: {} },
    });

    const runner = await createTspiceRunner({ backend: "wasm" });
    try {
      const out = await runner.runCase(createInput("file-io.dlaopn", ["tag", "DAF/DLA", "ifname", 0]));

      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.error.message).toBe(closeError.message);
      }

      expect(openedVirtualPath).toBeDefined();
      expect(deleteVirtual).toHaveBeenCalledTimes(1);
      expect(deleteVirtual).toHaveBeenCalledWith(openedVirtualPath);
    } finally {
      await runner.dispose?.();
    }
  });
});
