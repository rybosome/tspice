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
  return {
    schemaVersion: 2,
    manifest: {
      id: `methods/${method.replaceAll(".", "/")}@v2`,
      kind: "method",
    },
    contract: {
      contractMethod: method,
      canonicalMethod: method,
      aliases: [],
      result: { const: null },
      errors: [{ code: "invalid_args" }, { code: "spice_error" }],
    },
    args,
    workflow: {
      steps: [{ op: "invokeLegacyCall" }],
    },
  };
}

function createRawBackend(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "node",
    kclear: vi.fn(),
    reset: vi.fn(),
    failed: vi.fn(() => false),
    getmsg: vi.fn(() => ""),

    kdata: vi.fn(() => ({ found: true, file: "/tmp/default.ek" })),
    ekopr: vi.fn(() => 11),
    eknseg: vi.fn(() => 3),
    ekcls: vi.fn(),

    ...overrides,
  };
}

afterEach(() => {
  toSyncMock.mockReset();
});

describe("tspiceRunner ek.eknseg", () => {
  it("trims trailing fixed-width whitespace before opening the EK", async () => {
    const ekopr = vi.fn(() => 42);
    const eknseg = vi.fn(() => 7);
    const ekcls = vi.fn();

    const raw = createRawBackend({
      kdata: vi.fn(() => ({ found: true, file: "/tmp/trim-me.ek      \t" })),
      ekopr,
      eknseg,
      ekcls,
    });

    toSyncMock.mockResolvedValueOnce({
      spice: { raw, kit: {} },
    });

    const runner = await createTspiceRunner({ backend: "node" });
    try {
      const out = await runner.runCase(createInput("ek.eknseg", []));

      expect(out).toEqual({ ok: true, result: { ok: true, nseg: 7 } });
      expect(ekopr).toHaveBeenCalledTimes(1);
      expect(ekopr).toHaveBeenCalledWith("/tmp/trim-me.ek");
      expect(eknseg).toHaveBeenCalledWith(42);
      expect(ekcls).toHaveBeenCalledWith(42);
    } finally {
      await runner.dispose?.();
    }
  });

  it("closes the EK handle even when eknseg fails", async () => {
    const eknsegError = new Error("eknseg exploded");
    const ekopr = vi.fn(() => 99);
    const ekcls = vi.fn();

    const raw = createRawBackend({
      ekopr,
      eknseg: vi.fn(() => {
        throw eknsegError;
      }),
      ekcls,
    });

    toSyncMock.mockResolvedValueOnce({
      spice: { raw, kit: {} },
    });

    const runner = await createTspiceRunner({ backend: "node" });
    try {
      const out = await runner.runCase(createInput("ek.eknseg", []));

      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.error.message).toBe(eknsegError.message);
      }

      expect(ekcls).toHaveBeenCalledTimes(1);
      expect(ekcls).toHaveBeenCalledWith(99);
    } finally {
      await runner.dispose?.();
    }
  });
});
