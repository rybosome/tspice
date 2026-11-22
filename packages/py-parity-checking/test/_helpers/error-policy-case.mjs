import { readFileSync } from "node:fs";
import { spiceClients } from "@rybosome/tspice";
import { runCaseInTspice } from "../../dist/run-tspice.js";

const { backend, parityCase, fixturesRoot } = JSON.parse(
  readFileSync(0, "utf8"),
);
const client = await spiceClients.toSync({ backend });
try {
  const result = runCaseInTspice(client.spice, parityCase, fixturesRoot);
  process.stdout.write(JSON.stringify(result));
} finally {
  await client.dispose();
}
