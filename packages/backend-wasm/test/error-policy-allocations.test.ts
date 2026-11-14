import { expect, it } from "vitest";
import { createErrorApi } from "../src/domains/error.js";
import { actualModule } from "./_helpers/errorModule.js";

for (const [name, value] of [
  ["errdev", "NULL"],
  ["errprt", "SHORT"],
] as const) {
  for (const mode of ["SET", "GET"] as const) {
    for (let failure = 0; failure <= 4; failure++) {
      it(name + " " + mode + " actual allocation " + failure, async () => {
        const m = await actualModule();
        const api = createErrorApi(m);
        const old = api[name]("GET");
        const malloc = m._malloc,
          free = m._free,
          live = new Set<number>();
        let ordinal = 0;
        m._malloc = (n) => {
          if (++ordinal === failure) return 0;
          const p = malloc(n);
          if (p) live.add(p);
          return p;
        };
        m._free = (p) => {
          expect(live.delete(p)).toBe(true);
          free(p);
        };
        try {
          const run = () =>
            mode === "GET" ? api[name]("GET") : api[name]("SET", value);
          if (failure) expect(run).toThrow(/alloc/i);
          else expect(run()).toBe(mode === "GET" ? old : undefined);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
        }
        expect(api[name]("GET")).toBe(!failure && mode === "SET" ? value : old);
      });
    }
  }
}
it("trcoff allocation failure preserves tracing, then a successful call disables it", async () => {
  const m = await actualModule(),
    api = createErrorApi(m);
  api.chkin("call");
  const malloc = m._malloc;
  m._malloc = () => 0;
  try {
    expect(() => api.trcoff()).toThrow(/alloc/i);
  } finally {
    m._malloc = malloc;
  }
  expect(api.qcktrc()).toBe("call");
  api.trcoff();
  expect(api.qcktrc()).toBe("");
});

it("stores diagnostic bytes in the module filesystem independently of the host path and kit file namespace", async () => {
  const module = await actualModule(),
    api = createErrorApi(module);
  const target = "/policy-report.txt";
  api.errdev("SET", target);
  expect(() => module.FS.readFile(target, { encoding: "binary" })).toThrow();
  api.errprt("SET", "NONE, SHORT, LONG");
  // WRLINE keeps its logical unit open. Generate enough ordinary reports to
  // flush several stdio blocks without relying on a particular buffer size.
  for (let i = 0; i < 100; i++) {
    api.setmsg("A B07 diagnostic with a second field.");
    expect(() => api.sigerr("SPICE(B07DISPOSITION)")).toThrow(/B07DISPOSITION/);
  }
  const text = new TextDecoder().decode(
    module.FS.readFile(target, { encoding: "binary" }),
  );
  expect(text.length).toBeGreaterThan(4096);
  expect(text).toContain("A B07 diagnostic with a second field.");
  expect(text).toContain("SPICE(B07DISPOSITION)");
  api.errdev("SET", "NULL");
  expect(api.errdev("GET")).toBe("NULL");
});
