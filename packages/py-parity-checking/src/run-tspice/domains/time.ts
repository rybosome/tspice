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
  StepTimeEtcal,
  StepTimeUtc2et,
  StepTimeTparch,
  StepTimeTsetyr,
  StepTimeEt2lst,
  StepTimeTparse,
  StepTimeTpictr,
  StepTimeTimdefGet,
  StepTimeTimdefSet,
  StepTimeUnitim,
} from "../../case-types.js";
import { registerFinalizer, type RunTspiceContext } from "../context.js";

function preserveTimeDefaults(context: RunTspiceContext): void {
  const label = "time.defaults.restore";
  if (context.lifecycle.finalizers.some((f) => f.label === label)) return;
  const calendar = context.spice.raw.timdef("GET", "CALENDAR");
  const system = context.spice.raw.timdef("GET", "SYSTEM");
  const zone = context.spice.raw.timdef("GET", "ZONE");
  registerFinalizer(context, label, () => {
    context.spice.raw.timdef("SET", "CALENDAR", calendar);
    // SYSTEM and ZONE are mutually exclusive. Restoring the nonempty setting
    // also clears the other; passing an empty SET value is invalid.
    if (system) context.spice.raw.timdef("SET", "SYSTEM", system);
    else if (zone) context.spice.raw.timdef("SET", "ZONE", zone);
  });
}

// These persistent controls have no public getter. Observe their effects
// before a workflow changes them so callers retain their entry settings.
function preserveTimeParser(
  context: RunTspiceContext,
  setting: "tparch" | "tsetyr",
): void {
  const label = "time.restore." + setting;
  if (context.lifecycle.finalizers.some((f) => f.label === label)) return;
  const raw = context.spice.raw;
  if (setting === "tparch") {
    let mode = "NO";
    try {
      raw.tparse("1993 April 31 12:00:00");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("day of the month")
      )
        throw error;
      mode = "YES";
    }
    registerFinalizer(context, label, () => raw.tparch(mode));
    return;
  }
  // In a 100-year window, suffixes wrap at most once. Locate the
  // first year in the earlier century, or retain '00 for a whole century.
  function expandedYear(suffix: number): number {
    const timestamp = raw.tparse("JAN 01 '" + String(suffix).padStart(2, "0"));
    const formatted = raw.etcal(timestamp);
    const match = /^(\d+) /.exec(formatted);
    if (!match)
      throw new Error("Unexpected expanded calendar year: " + formatted);
    return Number(match[1]);
  }
  const century = expandedYear(0);
  let lower = century;
  if (expandedYear(99) < century) {
    let first = 1;
    let last = 99;
    while (first < last) {
      const mid = Math.floor((first + last) / 2);
      if (expandedYear(mid) < century) last = mid;
      else first = mid + 1;
    }
    lower = century - 100 + first;
  }
  registerFinalizer(context, label, () => raw.tsetyr(lower));
}

type TimeStep =
  | StepTimeStr2Et
  | StepTimeEt2Utc
  | StepTimeTkvrsn
  | StepTimeTimout
  | StepTimeDeltet
  | StepTimeUnitim
  | StepTimeEtcal
  | StepTimeUtc2et
  | StepTimeTparch
  | StepTimeTsetyr
  | StepTimeEt2lst
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
export function runTimeStep(
  context: RunTspiceContext,
  step: TimeStep,
): StepOutput {
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

    case "time.unitim": {
      const epoch = context.spice.raw.unitim(
        step.epoch,
        step.insys,
        step.outsys,
      );
      const julian = ["JED", "JDTDB", "JDTDT"].includes(
        step.outsys.trim().toUpperCase(),
      );
      return {
        op: step.op,
        // Retain the raw output and observe its offset at second scale. Relative
        // tolerance on a 2.45-million-day Julian epoch otherwise hides ~0.2 s.
        value: {
          epoch,
          secondsPastJ2000: julian ? (epoch - 2451545) * 86400 : epoch,
        },
      };
    }

    case "time.etcal":
      return {
        op: step.op,
        value: context.spice.raw.etcal(step.et, step.callen),
      };
    case "time.utc2et":
      return { op: step.op, value: context.spice.raw.utc2et(step.utcstr) };
    case "time.tparch":
      preserveTimeParser(context, "tparch");
      context.spice.raw.tparch(step.type);
      return { op: step.op, value: null };
    case "time.tsetyr":
      preserveTimeParser(context, "tsetyr");
      context.spice.raw.tsetyr(step.year);
      return { op: step.op, value: null };
    case "time.et2lst":
      return {
        op: step.op,
        value: context.spice.raw.et2lst(
          step.et,
          step.body,
          step.lon,
          step.type,
          step.timlen,
          step.ampmlen,
        ),
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
        return {
          op: step.op,
          value: context.spice.raw.timdef("GET", step.item),
        };
      }

      preserveTimeDefaults(context);
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
