import { beforeEach, describe, expect, it, vi } from "vitest";

const toSyncMock = vi.fn();

vi.mock("@rybosome/tspice", () => ({
  spiceClients: {
    toSync: toSyncMock,
  },
}));

type BackendKind = "node" | "wasm";

function createClient(kind: BackendKind) {
  return {
    spice: {
      raw: {
        kind,
        kclear: vi.fn(),
        reset: vi.fn(),
      },
      kit: {},
    },
  };
}

describe("createTspiceRunner backend selection", () => {
  beforeEach(() => {
    vi.resetModules();
    toSyncMock.mockReset();
  });

  it("records requested===actual backend metadata for explicit node lane", async () => {
    toSyncMock.mockImplementation(async ({ backend }: { backend: BackendKind }) => {
      if (backend !== "node") {
        throw new Error(`unexpected backend request: ${backend}`);
      }

      return createClient("node");
    });

    const { createTspiceRunner } = await import("../../src/runners/tspiceRunner.js");
    const runner = await createTspiceRunner({ backend: "node" });

    expect(runner.kind).toBe("tspice(node)");
    expect(runner.backendMetadata).toEqual({
      requestedBackend: "node",
      actualBackend: "node",
      fallbackDetected: false,
    });

    await runner.dispose?.();
  });

  it("flags fallback when auto mode falls back from node to wasm", async () => {
    toSyncMock.mockImplementation(async ({ backend }: { backend: BackendKind }) => {
      if (backend === "node") {
        throw new Error("Cannot find module '@rybosome/tspice-native-linux-x64-gnu'");
      }

      return createClient("wasm");
    });

    const { createTspiceRunner } = await import("../../src/runners/tspiceRunner.js");
    const runner = await createTspiceRunner({ backend: "auto" });

    expect(runner.kind).toBe("tspice(wasm)");
    expect(runner.backendMetadata).toEqual({
      requestedBackend: "auto",
      actualBackend: "wasm",
      fallbackDetected: true,
    });

    await runner.dispose?.();
  });

  it("throws when the reported backend does not match the requested explicit lane", async () => {
    toSyncMock.mockImplementation(async ({ backend }: { backend: BackendKind }) => {
      if (backend !== "node") {
        throw new Error(`unexpected backend request: ${backend}`);
      }

      return createClient("wasm");
    });

    const { createTspiceRunner } = await import("../../src/runners/tspiceRunner.js");

    await expect(createTspiceRunner({ backend: "node" })).rejects.toThrow(
      /requested=node but spice client reported "wasm"|backend mismatch/,
    );
  });
});
