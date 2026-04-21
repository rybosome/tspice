import type { StepOutput, WorkflowStep } from "../case-types.js";
import type { RunTspiceContext } from "./context.js";
import { runCellsWindowsStep } from "./domains/cells-windows.js";
import { runCoordsVectorsStep } from "./domains/coords-vectors.js";
import { runEphemerisStep } from "./domains/ephemeris.js";
import { runEkStep } from "./domains/ek.js";
import { runErrorStep } from "./domains/error.js";
import { runGeometryStep } from "./domains/geometry.js";
import { runGeometryGfStep } from "./domains/geometry-gf.js";
import { runIdsNamesStep } from "./domains/ids-names.js";
import { runKernelPoolStep } from "./domains/kernel-pool.js";
import { runKernelsStep } from "./domains/kernels.js";
import { runTimeStep } from "./domains/time.js";

/** Dispatch one workflow step to its corresponding tspice domain handler. */
export function dispatchStep(context: RunTspiceContext, step: WorkflowStep): StepOutput {
  switch (step.op) {
    case "time.str2et":
    case "time.et2utc":
    case "time.tkvrsn":
    case "time.timout":
    case "time.deltet":
    case "time.unitim":
    case "time.tparse":
    case "time.tpictr":
    case "time.timdef":
    case "time.scs2e":
    case "time.sce2s":
    case "time.scencd":
    case "time.scdecd":
    case "time.sct2e":
    case "time.sce2c":
      return runTimeStep(context, step);

    case "ids-names.bodn2c":
    case "ids-names.bodc2n":
    case "ids-names.bodc2s":
    case "ids-names.boddef":
    case "ids-names.bodfnd":
    case "ids-names.bods2c":
    case "ids-names.bodvar":
      return runIdsNamesStep(context, step);

    case "coords-vectors.reclat":
    case "coords-vectors.latrec":
    case "coords-vectors.recsph":
    case "coords-vectors.sphrec":
    case "coords-vectors.vnorm":
    case "coords-vectors.vhat":
    case "coords-vectors.vdot":
    case "coords-vectors.vcrss":
    case "coords-vectors.vadd":
    case "coords-vectors.vsub":
    case "coords-vectors.vminus":
    case "coords-vectors.vscl":
    case "coords-vectors.mxm":
    case "coords-vectors.rotate":
    case "coords-vectors.rotmat":
    case "coords-vectors.axisar":
    case "coords-vectors.georec":
    case "coords-vectors.recgeo":
    case "coords-vectors.mxv":
    case "coords-vectors.mtxv":
      return runCoordsVectorsStep(context, step);

    case "cells-windows.card":
    case "cells-windows.insrtc":
    case "cells-windows.insrtd":
    case "cells-windows.insrti":
    case "cells-windows.scard":
    case "cells-windows.size":
    case "cells-windows.ssize":
    case "cells-windows.valid":
    case "cells-windows.wncard":
    case "cells-windows.wninsd":
    case "cells-windows.wnfetd":
    case "cells-windows.wnvald":
      return runCellsWindowsStep(context, step);

    case "kernel-pool.gdpool":
    case "kernel-pool.gipool":
    case "kernel-pool.gcpool":
    case "kernel-pool.gnpool":
    case "kernel-pool.dtpool":
    case "kernel-pool.pdpool":
    case "kernel-pool.pipool":
    case "kernel-pool.pcpool":
    case "kernel-pool.swpool":
    case "kernel-pool.cvpool":
    case "kernel-pool.expool":
      return runKernelPoolStep(context, step);

    case "kernels.furnsh":
    case "kernels.kclear":
    case "kernels.kinfo":
    case "kernels.kplfrm":
    case "kernels.ktotal":
    case "kernels.kdata":
    case "kernels.kxtrct":
    case "kernels.unload":
      return runKernelsStep(context, step);

    case "error.failed":
    case "error.reset":
    case "error.getmsg":
    case "error.setmsg":
    case "error.sigerr":
    case "error.chkin":
    case "error.chkout":
      return runErrorStep(context, step);

    case "ephemeris.spkcls":
    case "ephemeris.spkcov":
    case "ephemeris.spkez":
    case "ephemeris.spkezp":
    case "ephemeris.spkezr":
    case "ephemeris.spkgeo":
    case "ephemeris.spkgps":
    case "ephemeris.spkobj":
    case "ephemeris.spkopa":
    case "ephemeris.spkopn":
    case "ephemeris.spkpds":
    case "ephemeris.spkpos":
    case "ephemeris.spksfs":
    case "ephemeris.spkssb":
    case "ephemeris.spkuds":
    case "ephemeris.spkw08":
      return runEphemerisStep(context, step);

    case "ek.ekfind":
    case "ek.ekgc":
    case "ek.ekgd":
    case "ek.ekgi":
    case "ek.ekopn":
    case "ek.ekopr":
    case "ek.ekopw":
    case "ek.ekcls":
    case "ek.ekntab":
    case "ek.ektnam":
    case "ek.eknseg":
    case "ek.ekifld":
    case "ek.ekacli":
    case "ek.ekacld":
    case "ek.ekaclc":
    case "ek.ekffld":
      return runEkStep(context, step);

    case "geometry.subpnt":
    case "geometry.subslr":
    case "geometry.sincpt":
    case "geometry.ilumin":
    case "geometry.illumg":
    case "geometry.illumf":
    case "geometry.occult":
    case "geometry.nvc2pl":
    case "geometry.pl2nvc":
      return runGeometryStep(context, step);

    case "geometry-gf.gfsstp":
    case "geometry-gf.gfstep":
    case "geometry-gf.gfstol":
    case "geometry-gf.gfrefn":
    case "geometry-gf.gfrepi":
    case "geometry-gf.gfrepf":
    case "geometry-gf.gfsep":
    case "geometry-gf.gfdist":
      return runGeometryGfStep(context, step);

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
