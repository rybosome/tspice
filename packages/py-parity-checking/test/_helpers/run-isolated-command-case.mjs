// Native command arguments can be initialized only once in an OS process.
// Run the ordinary built facade, workflow dispatcher and independent oracle.
import fs from "node:fs";
import { spiceClients } from "@rybosome/tspice";
import { assertCaseParity } from "../../dist/parity-assert.js";
import { runCaseInSidecar } from "../../dist/run-sidecar.js";
import { runCaseInTspice } from "../../dist/run-tspice.js";
const scenario = JSON.parse(fs.readFileSync(0, "utf8"));
const root = process.argv[2];
const oracle = await runCaseInSidecar(scenario, root);
const client = await spiceClients.toSync({ backend: "node" });
try {
  assertCaseParity(
    scenario,
    oracle,
    runCaseInTspice(client.spice, scenario, root),
  );
} finally {
  await client.dispose();
}
