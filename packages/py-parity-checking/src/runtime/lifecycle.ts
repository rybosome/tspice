import { registerFinalizer, runFinalizersBestEffort, type RunTspiceContext } from "./context.js";
import { removeScratchRootBestEffort } from "./path-ref.js";

/** Prepare toolkit lifecycle for a case: always kclear + reset before executing steps. */
export function beforeCaseLifecycle(context: RunTspiceContext): void {
  if (!context.lifecycle.scratchCleanupRegistered) {
    registerFinalizer(context, "scratch.cleanup", () => {
      removeScratchRootBestEffort(context.paths.scratchRoot);
    });
    context.lifecycle.scratchCleanupRegistered = true;
  }

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
  runFinalizersBestEffort(context);
  kclearBestEffort(context);
  resetBestEffort(context);
}
