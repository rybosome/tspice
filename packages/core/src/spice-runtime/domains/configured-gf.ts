/** A request issued by a configurable GF solver to the caller. All epochs are TDB seconds. */
export type GfControlEvent =
  | { kind: "step"; epoch: number }
  | { kind: "refine"; first: number; second: number; stateAtFirst: boolean; stateAtSecond: boolean }
  | { kind: "reportStart"; confinementEndpoints: readonly number[]; prefix: string; suffix: string }
  | { kind: "reportUpdate"; intervalStart: number; intervalEnd: number; epoch: number }
  | { kind: "reportEnd" }
  | { kind: "bail" };

/** Return a positive step or refined epoch, a boolean for bail, and void for progress events. */
export type GfControl<R = number | boolean | void> = (event: GfControlEvent) => R;

function numberAt(args: readonly unknown[], index: number): number {
  const value = args[index];
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError("Invalid Geometry Finder callback argument");
  return value;
}

function decodeControlEvent(slot: number, args: readonly unknown[]): GfControlEvent {
  switch (slot) {
    case 0:
      return { kind: "step", epoch: numberAt(args, 0) };
    case 1:
      return {
        kind: "refine",
        first: numberAt(args, 0),
        second: numberAt(args, 1),
        stateAtFirst: numberAt(args, 2) !== 0,
        stateAtSecond: numberAt(args, 3) !== 0,
      };
    case 2: {
      const [values, prefix, suffix] = args;
      if (!Array.isArray(values) || typeof prefix !== "string" || typeof suffix !== "string")
        throw new TypeError("Invalid Geometry Finder progress arguments");
      return {
        kind: "reportStart",
        confinementEndpoints: values.map((_, index) => numberAt(values, index)),
        prefix,
        suffix,
      };
    }
    case 3:
      return {
        kind: "reportUpdate",
        intervalStart: numberAt(args, 0),
        intervalEnd: numberAt(args, 1),
        epoch: numberAt(args, 2),
      };
    case 4:
      return { kind: "reportEnd" };
    case 5:
      return { kind: "bail" };
    default:
      throw new TypeError("Invalid Geometry Finder callback slot");
  }
}

function encodeControlResult(event: GfControlEvent, value: unknown): number {
  switch (event.kind) {
    case "step":
    case "refine":
      if (typeof value === "number" && Number.isFinite(value)) return value;
      throw new TypeError(`GF ${event.kind} callback must return a finite number`);
    case "bail":
      if (typeof value === "boolean") return Number(value);
      throw new TypeError("GF bail callback must return a boolean");
    default:
      if (value === undefined) return 0;
      throw new TypeError("GF progress callback must return void");
  }
}

/** Bind the typed JS control callback to the slots shared by the two toolkits. */
export function bindConfiguredGfControl(control: GfControl, asynchronous: false): (slot: number, args: readonly unknown[]) => number;
export function bindConfiguredGfControl(control: GfControl, asynchronous: boolean): (slot: number, args: readonly unknown[]) => number | Promise<number>;
export function bindConfiguredGfControl(control: GfControl, asynchronous: boolean) {
  if (typeof control !== "function") throw new TypeError("Expected a Geometry Finder control callback");
  return (slot: number, args: readonly unknown[]) => {
    const event = decodeControlEvent(slot, args);
    const result: unknown = control(event);
    if (result instanceof Promise) {
      if (asynchronous) return result.then((value) => encodeControlResult(event, value));
      void result.catch(() => undefined);
      throw new TypeError("A synchronous GF callback must return synchronously");
    }
    return encodeControlResult(event, result);
  };
}
