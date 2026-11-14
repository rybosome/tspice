import assert from "node:assert/strict";
import { spiceClients } from "@rybosome/tspice";

const later = () => new Promise((resolve) => setTimeout(resolve, 20));
let received = 0;
process.on("SIGINT", () => {
  received++;
});
const first = await spiceClients.toSync({ backend: "node" }),
  second = await spiceClients.toAsync({ backend: "node" });
const a = first.spice.raw,
  b = second.spice.raw;
try {
  a.gfinth(2);
  await b.gfinth(2);
  a.gfclrh();
  assert.equal(await b.gfbail(), false);
  process.kill(process.pid, "SIGINT");
  await later();
  assert.equal(await b.gfbail(), true);
  assert.equal(received, 0);
  await first.dispose();
  await b.gfclrh();
  process.kill(process.pid, "SIGINT");
  await later();
  assert.equal(await b.gfbail(), true);
  assert.equal(received, 0);
  await b.gfclrh();
  await second.dispose();
  process.kill(process.pid, "SIGINT");
  for (let i = 0; i < 25 && received === 0; i++) await later();
  assert.equal(received, 1);
} finally {
  await first.dispose();
  await second.dispose();
}
console.log(
  "observed interrupt, retained second claim, restored host listener",
);
