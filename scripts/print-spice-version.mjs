import { createBackend } from "@rybosome/tspice";

const backend = createBackend({ backend: "node" });
console.log(backend.spiceVersion());
