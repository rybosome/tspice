import type {
  StepOutput,
  StepTimeDeltet,
  StepTimeEt2Utc,
  StepTimeScdecd,
  StepTimeScencd,
  StepTimeSce2c,
  StepTimeSce2s,
  StepTimeScs2e,
  StepTimeSct2e,
  StepTimeStr2Et,
  StepTimeTimout,
  StepTimeTkvrsn,
  StepTimeTparse,
  StepTimeTpictr,
  StepTimeTimdefGet,
  StepTimeTimdefSet,
  StepTimeUnitim,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type TimeStep =
  | StepTimeStr2Et
  | StepTimeEt2Utc
  | StepTimeTkvrsn
  | StepTimeTimout
  | StepTimeDeltet
  | StepTimeUnitim
  | StepTimeTparse
  | StepTimeTpictr
  | StepTimeTimdefGet
  | StepTimeTimdefSet
  | StepTimeScs2e
  | StepTimeSce2s
  | StepTimeScencd
  | StepTimeScdecd
  | StepTimeSct2e
  | StepTimeSce2c;

/** Execute one `time.*` workflow step in tspice. */
export function runTimeStep(context: RunTspiceContext, step: TimeStep): StepOutput {
  switch (step.op) {
    case "time.str2et":
      return { op: step.op, value: context.spice.raw.str2et(step.time) };

    case "time.et2utc":
      return {
        op: step.op,
        value: context.spice.raw.et2utc(step.et, step.format, step.prec),
      };

    case "time.tkvrsn":
      return {
        op: step.op,
        value: context.spice.raw.tkvrsn(step.item),
      };

    case "time.timout":
      return {
        op: step.op,
        value: context.spice.raw.timout(step.et, step.picture),
      };

    case "time.deltet":
      return {
        op: step.op,
        value: context.spice.raw.deltet(step.epoch, step.eptype),
      };

    case "time.unitim":
      return {
        op: step.op,
        value: context.spice.raw.unitim(step.epoch, step.insys, step.outsys),
      };

    case "time.tparse":
      return {
        op: step.op,
        value: context.spice.raw.tparse(step.timstr),
      };

    case "time.tpictr":
      return {
        op: step.op,
        value: context.spice.raw.tpictr(step.sample, step.pictur),
      };

    case "time.timdef":
      if (step.action === "GET") {
        return { op: step.op, value: context.spice.raw.timdef("GET", step.item) };
      }

      context.spice.raw.timdef("SET", step.item, step.value);
      return { op: step.op, value: null };

    case "time.scs2e":
      return {
        op: step.op,
        value: context.spice.raw.scs2e(step.sc, step.sclkch),
      };

    case "time.sce2s":
      return {
        op: step.op,
        value: context.spice.raw.sce2s(step.sc, step.et),
      };

    case "time.scencd":
      return {
        op: step.op,
        value: context.spice.raw.scencd(step.sc, step.sclkch),
      };

    case "time.scdecd":
      return {
        op: step.op,
        value: context.spice.raw.scdecd(step.sc, step.sclkdp),
      };

    case "time.sct2e":
      return {
        op: step.op,
        value: context.spice.raw.sct2e(step.sc, step.sclkdp),
      };

    case "time.sce2c":
      return {
        op: step.op,
        value: context.spice.raw.sce2c(step.sc, step.et),
      };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled time step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
