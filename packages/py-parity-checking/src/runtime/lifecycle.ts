import {
  registerFinalizer,
  runFinalizersBestEffort,
  type RunTspiceContext,
} from "./context.js";
import { removeScratchRootBestEffort } from "./path-ref.js";

/** Prepare toolkit lifecycle for a case: always kclear + reset before executing steps. */
export function beforeCaseLifecycle(context: RunTspiceContext): void {
  context.spice.raw.kclear();
  context.spice.raw.reset();
}

function kclearBestEffort(context: RunTspiceContext): void {
  try {
    context.spice.raw.kclear();
  } catch {
    // best-effort cleanup only
  }
}

function resetBestEffort(context: RunTspiceContext): void {
  try {
    context.spice.raw.reset();
  } catch {
    // best-effort cleanup only
  }
}

/** Finalize toolkit lifecycle: run finalizers best-effort, then always kclear + reset. */
export function finalizeCaseLifecycle(context: RunTspiceContext): void {
  // Keep failed claims for the registered retry, while Scratch still exists.
  if (context.state.ephemeris.spkHandles.size > 0) {
    resetBestEffort(context);
    for (const [id, handle] of context.state.ephemeris.spkHandles) {
      try {
        context.spice.raw.spkcls(handle);
        context.state.ephemeris.spkHandles.delete(id);
      } catch {
        /* The registered finalizer can retry this claim. */
      }
    }
  }
  if (!context.lifecycle.scratchCleanupRegistered) {
    registerFinalizer(context, "scratch.cleanup", () => {
      removeScratchRootBestEffort(context.paths.scratchRoot);
    });
    context.lifecycle.scratchCleanupRegistered = true;
  }

  runFinalizersBestEffort(context);
  kclearBestEffort(context);
  resetBestEffort(context);
}
