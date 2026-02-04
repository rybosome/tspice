// Smoke test for @rybosome/tspice with a native optionalDependency installed.
//
// Intended to be run from inside a throwaway temp project in CI.

const tspiceResolved =
  typeof import.meta.resolve === "function"
    ? import.meta.resolve("@rybosome/tspice")
    : "(import.meta.resolve not available)";
console.log("@rybosome/tspice resolves to:", tspiceResolved);

const mod = await import("@rybosome/tspice");
console.log("@rybosome/tspice export keys:", Object.keys(mod));
console.log("createBackend typeof:", typeof mod.createBackend);

const { createBackend } = mod;
const backend = await createBackend({ backend: "node" });

console.log("backend typeof:", typeof backend);
console.log(
  "backend keys:",
  Object.keys(backend).length,
  Object.keys(backend).slice(0, 25),
);
console.log("backend.kind:", backend.kind);

if (backend.kind !== "node") {
  console.log("backend value:", backend);
  throw new Error(`Expected backend.kind to be "node"; got: ${backend.kind}`);
}

const version = backend.spiceVersion();
if (typeof version !== "string" || version.length === 0) {
  throw new Error(
    `Expected spiceVersion() to return a non-empty string; got: ${String(version)}`,
  );
}

console.log(`Native backend loaded OK. CSPICE toolkit version: ${version}`);
