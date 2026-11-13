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
  // Close CKs while Scratch files still exist. Preserve failed claims so their
  // registered finalizers can retry once before Scratch is removed.
  if (context.state.frames.ckHandles.size > 0) {
    resetBestEffort(context);
    for (const [id, handle] of context.state.frames.ckHandles) {
      try {
        context.spice.raw.ckupf(handle);
        context.state.frames.ckHandles.delete(id);
      } catch {
        // A pending claim remains available to its registered finalizer.
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
