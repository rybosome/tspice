# Node (native backend)

In Node, you can choose between:

- **Native backend** (`backend: "node"`): fastest, uses a native addon
- **WASM backend** (`backend: "wasm"`): portable, no native build

## Native backend (recommended for performance)

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toSync({ backend: "node" });

try {
  console.log(spice.raw.tkvrsn("TOOLKIT"));
} finally {
  await dispose();
}
```

If you see errors about missing native bindings, see the backend package docs:

- `@rybosome/tspice-backend-node`

## WASM backend

If you don’t want native addons, the WASM backend works in Node too:

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toAsync({ backend: "wasm" });

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

## Notes

- `@rybosome/tspice` is **ESM-only**. In CommonJS, use `await import("@rybosome/tspice")`.
- Kernel preload via `.withKernels(...)` uses `fetch` under the hood. Node 18+ has `fetch` built in; otherwise pass `opts.fetch`.
