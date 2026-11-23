import { spiceClients } from "@rybosome/tspice";

const [backend, device, mask] = process.argv.slice(2);
const client = await spiceClients.toSync({ backend });
const raw = client.spice.raw;
try {
  raw.errdev("SET", device);
  raw.errprt("SET", mask);
  raw.setmsg("A B07 diagnostic with a second field.");
  try {
    raw.sigerr("SPICE(B07DISPOSITION)");
    throw new Error("Expected structured signal");
  } catch (error) {
    if (
      error.spiceShort !== "SPICE(B07DISPOSITION)" ||
      error.spiceLong !== "A B07 diagnostic with a second field." ||
      raw.failed()
    )
      throw error;
  }
} finally {
  raw.errdev("SET", "NULL");
  await client.dispose();
}
