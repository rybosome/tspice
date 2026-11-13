import assert from "node:assert/strict";
import test from "node:test";
import { rewriteQuotedWasmBasename } from "./backend-wasm-assets.mjs";

test("WASM glue rewriting matches literal filenames, including regex metacharacters", () => {
  const old = "tspice_backend_wasm.web.wasm";
  const source = `'tspice_backend_wasmXwebXwasm'; '${old}'; "${old}"; 'prefix${old}'; ${old};`;
  assert.equal(
    rewriteQuotedWasmBasename(source, old, "shared.wasm"),
    `'tspice_backend_wasmXwebXwasm'; 'shared.wasm'; "shared.wasm"; 'prefix${old}'; ${old};`,
  );
  for (const char of ".*+?^${}()|[]\\") {
    const name = `bundle${char}node.wasm`;
    assert.equal(
      rewriteQuotedWasmBasename(`'${name}'; "${name}"`, name, "shared.wasm"),
      `'shared.wasm'; "shared.wasm"`,
    );
  }
});

test("WASM glue rewriting preserves quotation style and literal replacement characters", () => {
  assert.equal(
    rewriteQuotedWasmBasename(
      `'old.wasm'; "old.wasm"; 'oldXwasm'`,
      "old.wasm",
      "$&.wasm",
    ),
    `'$&.wasm'; "$&.wasm"; 'oldXwasm'`,
  );
  assert.equal(
    rewriteQuotedWasmBasename("'other.wasm'", "old.wasm", "new.wasm"),
    "'other.wasm'",
  );
});

test("both generated glue targets execute kplfrm and recover from a CSPICE error", async () => {
  const { readFile } = await import("node:fs/promises");
  const wasmBinary = await readFile(
    new URL(
      "../packages/backend-wasm/emscripten/tspice_backend_wasm.wasm",
      import.meta.url,
    ),
  );
  for (const target of ["web", "node"]) {
    const { default: factory } = await import(
      `../packages/backend-wasm/emscripten/tspice_backend_wasm.${target}.js`
    );
    const module = await factory({ wasmBinary });
    const err = module._malloc(2048);
    const out = module._malloc(4);
    assert.ok(err && out);
    try {
      assert.equal(module._tspice_new_int_cell(4, out, err, 2048), 0);
      const handle = module.HEAPU32[out >> 2];
      try {
        assert.notEqual(module._tspice_kplfrm(7, handle, err, 2048), 0);
        assert.match(module.UTF8ToString(err), /BADFRAMECLASS/);
        assert.equal(module._tspice_kplfrm(-1, handle, err, 2048), 0);
        assert.equal(module._tspice_card(handle, out, err, 2048), 0);
        assert.equal(module.HEAP32[out >> 2], 0);
      } finally {
        assert.equal(module._tspice_free_cell(handle, err, 2048), 0);
      }
    } finally {
      module._free(out);
      module._free(err);
    }
  }
});
