import { expect, it } from "vitest";
import {
  createWorkerGfCallbacks,
  dispatchGfCallback,
  encodeGfCallback,
  gfCallbackCancel,
} from "../src/worker/transport/gfCallbacks.js";

it("routes callback replies to their original request and recovers the original scalar identity", async () => {
  const scalar = (x: number) => x * x;
  const pred = (f: typeof scalar, t: number) => {
    expect(f).toBe(scalar);
    return f(t) > 2;
  };
  const calls: unknown[] = [];
  const worker = createWorkerGfCallbacks((msg) => {
    calls.push(msg);
  });
  const first = worker.decode(
    "raw.gfudb",
    4,
    1,
    encodeGfCallback("raw.gfudb", 1, pred),
  );
  const second = worker.decode(
    "raw.uddf",
    5,
    0,
    encodeGfCallback("raw.uddf", 0, scalar),
  );
  if (typeof first !== "function" || typeof second !== "function")
    throw new Error("Missing proxies");
  const b = first(() => 0, 2),
    n = second(-3);
  const requests = new Map([
    [4, { op: "raw.gfudb", args: [scalar, pred] }],
    [5, { op: "raw.uddf", args: [scalar] }],
  ]);
  for (const packet of calls.reverse())
    expect(
      dispatchGfCallback(
        packet,
        (id) => requests.get(id),
        (msg) => worker.receive(msg),
      ),
    ).toBe(true);
  await expect(b).resolves.toBe(true);
  await expect(n).resolves.toBe(9);
  expect(encodeGfCallback("raw.gfudb", 3, 42)).toBe(42);
  worker.dispose();
});
it("cancels suspended callbacks and ignores late or foreign replies", async () => {
  const calls: unknown[] = [];
  const worker = createWorkerGfCallbacks((msg) => calls.push(msg));
  const remote = worker.decode("raw.uddf", 7, 0, { gfCallback: 0 });
  if (typeof remote !== "function") throw Error("missing callback");
  const result = remote(2);
  expect(calls).toHaveLength(1);
  expect(
    worker.receive({
      type: "tspice.gf.callback.result",
      id: 8,
      call: 1,
      ok: true,
      value: 9,
    }),
  ).toBe(true);
  expect(worker.receive({ type: gfCallbackCancel, id: 7 })).toBe(true);
  await expect(result).rejects.toThrow(/cancelled/);
  await expect(remote(2)).rejects.toThrow(/ended/);
  expect(
    worker.receive({
      type: "tspice.gf.callback.result",
      id: 7,
      call: 1,
      ok: true,
      value: 4,
    }),
  ).toBe(true);
  worker.complete(7);
  worker.dispose();
});

it("routes asynchronous configurable GF controls on each worker operation", async () => {
  const events = [
    { kind: "step", epoch: 5 },
    { kind: "refine", first: 4, second: 6, stateAtFirst: false, stateAtSecond: true },
    { kind: "reportStart", confinementEndpoints: [0, 10], prefix: "start", suffix: "end" },
    { kind: "reportUpdate", intervalStart: 0, intervalEnd: 10, epoch: 5 },
    { kind: "reportEnd" },
    { kind: "bail" },
  ];
  for (const op of ["raw.gfevnt", "raw.gffove", "raw.gfocce"]) {
    const expected = [2, 5, undefined, undefined, undefined, false];
    const control = async (event: unknown) => {
      expect(event).toEqual(events[expected.length ? 6 - expected.length : 0]);
      return expected.shift();
    };
    const request = { op, args: [{}, 1, 2, control] };
    const worker = createWorkerGfCallbacks((packet) => {
      dispatchGfCallback(packet, () => request, (reply) => worker.receive(reply));
    });
    const remote = worker.decode(op, 9, 3, encodeGfCallback(op, 3, control));
    if (typeof remote !== "function") throw Error("Missing configurable callback proxy");
    const values: unknown[] = [];
    for (const event of events) values.push(await remote(event));
    expect(values).toEqual([2, 5, undefined, undefined, undefined, false]);
    worker.complete(9);
    worker.dispose();
  }
});
