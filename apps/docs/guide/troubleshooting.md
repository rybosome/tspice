# Troubleshooting

Use this page when `@rybosome/tspice` setup or runtime errors are blocking you.

It focuses on **user-fixable** issues: backend setup, worker/runtime wiring, kernel URL/path configuration, and missing kernel data.

## Quick triage checklist

1. Copy the full error text (including any wrapped `Original error:` details).
2. Confirm your execution mode: `toSync`, `toAsync`, or `toWebWorker`.
3. Confirm backend target: `backend: "node"` (native) or `backend: "wasm"`.
4. Verify kernel preload inputs (`origin`, `baseUrl`, `pathBase`, `pick(...)`, URLs, paths).
5. Verify required kernels are loaded for the operation you are calling.

## Error catalog (user-fixable)

| Scenario | Typical trigger | Observed error text/pattern | What to do |
| --- | --- | --- | --- |
| Native backend load failures | `backend: "node"` selected, but native addon cannot be resolved or loaded | `createBackend(node): backend module load failed. Expected: @rybosome/tspice-backend-node to load successfully. Got: ... Hint: install/build native backend artifacts or use backend="wasm".`<br/>`Native addon tspice_backend_node.node not found for ...`<br/>`TSPICE_BACKEND_NODE_BINDING_PATH points to a non-existent file` | Install/build the native backend for your platform/arch. If using `TSPICE_BACKEND_NODE_BINDING_PATH`, point it at an existing `.node` file. If you need portability, switch to `backend: "wasm"`. |
| WASM module load / URL failures | Invalid `wasmUrl`, missing `.wasm` asset, bad bytes, or failed WASM module init | `createBackend(wasm): backend module load failed. Expected: @rybosome/tspice-backend-wasm to load successfully. Got: ... Hint: verify WASM package/bundle availability and wasmUrl configuration.`<br/>`Unsupported wasmUrl scheme ...`<br/>`Failed to read tspice WASM binary (wasmUrl=...)`<br/>`Invalid WASM magic header ...`<br/>`Failed to initialize tspice WASM module ...` | Use a supported `wasmUrl` and verify deploy paths. Ensure the wasm binary is the expected file and is served correctly. Rebuild backend wasm artifacts if local build output is stale/corrupt. |
| Worker availability / module setup errors | Calling `toWebWorker()` in runtime without Worker support, or worker creation/messaging fails | `createSpiceWorker(): Worker API is unavailable. Expected: globalThis.Worker to be a constructor function. Got: ... Hint: run in a worker-capable runtime or provide an explicit worker entry URL.`<br/>`createSpiceWorker(inline): unsupported workerOptions.type. Expected: "module". Got: ... Hint: omit workerOptions.type or set it to "module".`<br/>`Failed to create Worker`<br/>`Worker request timed out after ...`<br/>`Worker postMessage failed ...` | Run worker mode only where `Worker` exists, keep module-worker configuration (`type: "module"`) for inline workers, and verify worker bundling/message flow. Increase timeout for long-running calls if needed. |
| Kernel URL / `baseUrl` / `pathBase` validation failures | Invalid `origin`, `pathBase`, or directory-shape `baseUrl`; root-relative URLs mixed with `baseUrl` | `kernels.*(): invalid origin. Expected: non-empty, non-whitespace string (or "" for no prefix). Got: blank/whitespace.`<br/>`kernels.*(): invalid pathBase. Expected: non-empty, non-whitespace string (or "" for no path prefix). Got: blank/whitespace.`<br/>`kernels.*()/loadKernelPack(): invalid ... baseUrl. Expected: directory-style baseUrl (ending in "/"). Got: ... Hint: append a trailing slash.`<br/>`loadKernelPack(): incompatible root-relative kernel URL with current behavior. Expected: relative kernel.url when rootRelativeKernelUrlBehavior="error". Got: kernel.url=..., baseUrl=... Hint: use relative kernel.url or change rootRelativeKernelUrlBehavior.` | Make `baseUrl` directory-style (trailing `/`). Use non-empty `origin` + `pathBase`. Prefer relative kernel URLs (no leading `/`) when you expect `baseUrl` to apply. |
| Missing `fetch` for kernel preload | `.withKernels(...)`/`loadKernelPack(...)` runs where `fetch` is unavailable | `loadKernelPack(): fetch implementation missing. Expected: opts.fetch, spiceClients.withFetch(fetch), or globalThis.fetch. Got: undefined. Hint: inject a fetch function in non-browser or sandboxed runtimes.` | Provide `fetch` via `spiceClients.withFetch(fetchFn)` (or `opts.fetch` if calling lower-level helpers), polyfill `globalThis.fetch`, or use a runtime with built-in `fetch`. |
| Kernel fetch / CORS / not-found failures | Kernel URL returns non-OK HTTP response or browser host blocks cross-origin fetch | `loadKernelPack(): failed to fetch kernel bytes. Expected: HTTP success response for <url>. Got: status=... Hint: verify URL, network access, and auth/CORS settings.` | Check URL correctness and hosting status. For browser apps, use CORS-enabled hosting/proxying (NAIF canonical host often fails direct browser CORS). In Node, make sure preload URLs are absolute (or resolvable via absolute `baseUrl`). |
| Missing required kernels for operation class (LSK/SPK/FK/PCK/CK/SCLK) | Calling time, ephemeris, frame, or attitude APIs without required kernels loaded | `/NOLEAPSECONDS|KERNELVARNOTFOUND|MISSINGTIMEINFO/i` (missing LSK)<br/>`/SCLK/i` (missing SCLK)<br/>`/NOLOADEDFILES|CKLPF/i` (missing CK/other data) | Load the minimum kernel family set for your workflow (see [Kernel requirements by workflow](#kernel-requirements-by-workflow)) before making SPICE calls. Keep load order explicit and deterministic. |
| WASM virtual-path misuse | Loading kernels into wasm with empty path, OS path, URL, or traversal segments | `Kernel path must be non-empty`<br/>`WASM kernel paths must be virtual ids ... not OS paths/URLs`<br/>`Invalid kernel path (.. not allowed)` | For wasm loading, use virtual IDs/paths (for example `naif/lsk/naif0012.tls`), never local filesystem paths or URLs, and never `..` traversal segments. |
| Kernel catalog `pick(...)` misconfiguration | Invalid `pick` call shape, unknown curated ID, or custom catalog missing mapping config | `kernels.*().pick(): missing kernel selection; expected at least one id/entry. Got: undefined/empty array.`<br/>`kernels.*().pick(): ambiguous argument form. Expected: either pick([entries...]) or pick(first, ...rest). Got: array first argument plus additional arguments. Hint: choose one calling style.`<br/>`kernels.tspice().pick(): unsupported curated kernel id. Expected: one of TSPICE_KERNEL_IDS. Got: ... Hint: use kernels.naif().pick(...) for non-curated NAIF IDs.`<br/>`kernels.custom().pick(): string-id mapping is not configured. Expected: string ids require kernels.custom({ origin, pathBase, baseUrl? }). Got: string id with opts omitted.` | Pass one valid `pick(...)` form (array *or* variadic). Use only supported IDs with `kernels.tspice()`, or switch to `kernels.naif()` for full NAIF inventory. Configure `kernels.custom({ origin, pathBase, baseUrl? })` before passing string IDs. |

## Kernel requirements by workflow

Use this as a quick minimum checklist when diagnosing missing-data errors.

| Workflow / API family | Typical minimum kernels |
| --- | --- |
| UTC ↔ ET (`kit.utcToEt`, `kit.etToUtc`) | **LSK** |
| State vectors / ephemerides (`kit.getState`, `raw.spkezr`) | **SPK** (+ **LSK** for UTC↔ET conversion in the same flow) |
| Body-fixed frame transforms (`kit.frameTransform` involving body frames) | **PCK** (and sometimes **FK**, depending on frame definitions) |
| Mission/instrument frame transforms | **FK** (plus related mission kernels) |
| Spacecraft attitude / pointing | **CK** + **SCLK** (often plus **FK** and **LSK**) |
| Spacecraft clock conversions | **SCLK** (often plus **LSK**) |

## Related docs

- Guide: [Getting started](/guide/getting-started)
- Guide: [Creating clients](/guide/creating-clients)
- Guide: [Kernels](/guide/kernels)
- Guide: [Browser](/guide/browser)
- Guide: [Node](/guide/node)
- Example: [Browser ephemeris](/examples/browser-ephemeris)
- API index: [API overview](/api/)
