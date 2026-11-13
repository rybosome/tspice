import { expect, it } from "vitest";
import { createNodeBackend } from "../src/index.js";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
it.runIf(nodeAddonAvailable())(
  "dispose closes the actual DAF handle of an empty SPK without weakening raw spkcls",
  () => {
    const native = getNativeAddon(),
      original = native.spkopn;
    let physical: number | undefined;
    native.spkopn = (...args) => {
      const handle = original(...args);
      physical = handle;
      return handle;
    };
    try {
      const backend = createNodeBackend();
      const h = backend.raw.spkopn(
        { kind: "virtual-output", path: "empty-dispose.bsp" },
        "AUTHORED",
        0,
      );
      expect(() => backend.raw.spkcls(h)).toThrow(/NOSEGMENTSFOUND/);
      const dispose: unknown = Reflect.get(backend, "disposeAll");
      if (typeof dispose !== "function")
        throw Error("Missing real backend disposal hook");
      expect(() => Reflect.apply(dispose, backend, [])).not.toThrow();
      expect(physical).toBeDefined();
      if (physical === undefined) throw Error("Missing actual native handle");
      const closedHandle = physical;
      expect(() => native.dafbfs(closedHandle)).toThrow(/NOSUCHHANDLE|HANDLE/i);
    } finally {
      native.spkopn = original;
      if (physical !== undefined) {
        native.reset();
        native.dafcls(physical);
      }
      native.kclear();
    }
  },
);
