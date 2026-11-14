import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

async function textCommandConsumer() {
  const client = await spiceClients.toSync({ backend: "wasm" });
  try {
    const { line, eof } = client.spice.raw.rdtext(
      { path: "words.txt", bytes: new Uint8Array([65, 10]) },
      8,
    );
    const saved: void = client.spice.raw.putcml(["program", line]);
    return { line, eof, saved };
  } finally {
    await client.dispose();
  }
}
void textCommandConsumer;
