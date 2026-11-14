import { spiceClients } from "@rybosome/tspice";

const backend = process.argv[2];
const first = await spiceClients.toSync({ backend });
try {
  first.spice.raw.errdev("SET", "NULL");
  first.spice.raw.errprt("SET", "SHORT");
  first.spice.raw.trcoff();
  await first.dispose();
  const second = await spiceClients.toSync({ backend });
  try {
    const raw = second.spice.raw;
    raw.chkin("SECOND");
    try {
      process.stdout.write(
        JSON.stringify([
          raw.errdev("GET"),
          raw.errprt("GET"),
          raw.trcdep(),
          raw.qcktrc(),
        ]),
      );
    } finally {
      raw.chkout("SECOND");
    }
  } finally {
    await second.dispose();
  }
} finally {
  await first.dispose();
}
