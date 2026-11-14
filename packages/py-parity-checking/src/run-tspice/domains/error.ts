import type {
  StepErrorChkin,
  StepErrorChkout,
  StepErrorErrch,
  StepErrorErrdp,
  StepErrorErrint,
  StepErrorQcktrc,
  StepErrorReturn,
  StepErrorTrcdep,
  StepErrorTrcnam,
  StepErrorFailed,
  StepErrorGetmsg,
  StepErrorReset,
  StepErrorSetmsg,
  StepErrorSigerr,
  StepOutput,
} from "../../case-types.js";
import { registerFinalizer, type RunTspiceContext } from "../context.js";

type ErrorStep =
  | StepErrorErrch
  | StepErrorErrdp
  | StepErrorErrint
  | StepErrorQcktrc
  | StepErrorReturn
  | StepErrorTrcdep
  | StepErrorTrcnam
  | StepErrorFailed
  | StepErrorReset
  | StepErrorGetmsg
  | StepErrorSetmsg
  | StepErrorSigerr
  | StepErrorChkin
  | StepErrorChkout;

/** Execute one `error.*` workflow step in tspice. */
export function runErrorStep(
  context: RunTspiceContext,
  step: ErrorStep,
): StepOutput {
  switch (step.op) {
    case "error.errch":
      context.spice.raw.errch(step.marker, step.value);
      return { op: step.op, value: context.spice.raw.getmsg("LONG") };
    case "error.errdp":
      context.spice.raw.errdp(step.marker, step.value);
      return { op: step.op, value: context.spice.raw.getmsg("LONG") };
    case "error.errint":
      context.spice.raw.errint(step.marker, step.value);
      return { op: step.op, value: context.spice.raw.getmsg("LONG") };
    case "error.qcktrc":
      return { op: step.op, value: context.spice.raw.qcktrc(step.tracelen) };
    case "error.return":
      return { op: step.op, value: context.spice.raw.return() };
    case "error.trcdep":
      return { op: step.op, value: context.spice.raw.trcdep() };
    case "error.trcnam":
      return {
        op: step.op,
        value: context.spice.raw.trcnam(step.index, step.namlen),
      };
    case "error.failed":
      return { op: step.op, value: context.spice.raw.failed() };

    case "error.reset":
      context.spice.raw.reset();
      return { op: step.op, value: null };

    case "error.getmsg":
      return { op: step.op, value: context.spice.raw.getmsg(step.which) };

    case "error.setmsg":
      context.spice.raw.setmsg(step.message);
      return { op: step.op, value: null };

    case "error.sigerr": {
      if (!step.capture) {
        context.spice.raw.sigerr(step.short);
        return { op: step.op, value: null };
      }
      // Capture only real structured SPICE exceptions. A no-op or unrelated
      // failure cannot masquerade as successful signaling/recovery evidence.
      try {
        context.spice.raw.sigerr(step.short);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "spiceShort" in error &&
          typeof error.spiceShort === "string"
        ) {
          const long = "spiceLong" in error ? error.spiceLong : undefined;
          const trace = "spiceTrace" in error ? error.spiceTrace : undefined;
          if (
            (long !== undefined && typeof long !== "string") ||
            (trace !== undefined && typeof trace !== "string")
          )
            throw error;
          return {
            op: step.op,
            value: {
              short: error.spiceShort,
              long: long ?? "",
              trace: trace ?? "",
              failed: context.spice.raw.failed(),
            },
          };
        }
        throw error;
      }
      throw new Error("raw.sigerr did not throw a structured SPICE error");
    }

    case "error.chkin": {
      context.spice.raw.chkin(step.name);
      const state = context.state.error;
      state.traceStack.push(step.name);
      if (!state.cleanupRegistered) {
        state.cleanupRegistered = true;
        registerFinalizer(context, "error.unwindTrace", () => {
          // reset() clears errors, not caller-managed traceback entries. Unwind
          // in reverse order even when a workflow stops at an expected error.
          while (state.traceStack.length > 0) {
            const name = state.traceStack.pop();
            if (name === undefined) break;
            try {
              context.spice.raw.chkout(name);
            } catch {
              /* best effort */
            }
          }
        });
      }
      return { op: step.op, value: null };
    }

    case "error.chkout":
      context.spice.raw.chkout(step.name);
      context.state.error.traceStack.pop();
      return { op: step.op, value: null };

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled error step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
