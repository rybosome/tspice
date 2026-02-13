import { afterEach, describe, expect, it, vi } from "vitest";

import { createSpiceWorker } from "../src/worker/browser/createSpiceWorker.js";

const originalWorker = (globalThis as unknown as { Worker?: unknown }).Worker;
const originalCreateObjectURL = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
const originalRevokeObjectURL = (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;

afterEach(() => {
  if (originalWorker === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as unknown as { Worker?: unknown }).Worker;
  } else {
    (globalThis as unknown as { Worker?: unknown }).Worker = originalWorker;
  }

  if (originalCreateObjectURL === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  } else {
    (URL as unknown as { createObjectURL?: unknown }).createObjectURL = originalCreateObjectURL;
  }

  if (originalRevokeObjectURL === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  } else {
    (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL = originalRevokeObjectURL;
  }
});

describe("createSpiceWorker()", () => {
  it("revokes the inline blob URL even if Worker construction throws", () => {
    const createObjectURL = vi.fn(() => "blob:tspice-test");
    const revokeObjectURL = vi.fn();

    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;

    let seenUrl: unknown;
    (globalThis as unknown as { Worker: unknown }).Worker = class {
      constructor(url: unknown) {
        seenUrl = url;
        throw new Error("boom");
      }
    };

    expect(() => createSpiceWorker()).toThrow(/boom/);
    expect(seenUrl).toBe("blob:tspice-test");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tspice-test");
  });

  it("revokes the inline blob URL after successful Worker construction", () => {
    const createObjectURL = vi.fn(() => "blob:tspice-test");
    const revokeObjectURL = vi.fn();

    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;

    (globalThis as unknown as { Worker: unknown }).Worker = class {
      constructor(_url: unknown, _options?: unknown) {}
      postMessage() {}
      addEventListener() {}
      removeEventListener() {}
      terminate() {}
    };

    createSpiceWorker();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tspice-test");
  });
});
