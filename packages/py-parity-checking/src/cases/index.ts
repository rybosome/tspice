import type { ParityCase } from "../case-types.js";

import cellsWindowsCasesRaw from "./cells-windows.cases.json" with { type: "json" };
import coordsVectorsAxisarCasesRaw from "./coords-vectors/axisar.cases.json" with { type: "json" };
import coordsVectorsGeorecCasesRaw from "./coords-vectors/georec.cases.json" with { type: "json" };
import coordsVectorsLatrecCasesRaw from "./coords-vectors/latrec.cases.json" with { type: "json" };
import coordsVectorsMtxvCasesRaw from "./coords-vectors/mtxv.cases.json" with { type: "json" };
import coordsVectorsMxmCasesRaw from "./coords-vectors/mxm.cases.json" with { type: "json" };
import coordsVectorsMxvCasesRaw from "./coords-vectors/mxv.cases.json" with { type: "json" };
import coordsVectorsReclatCasesRaw from "./coords-vectors/reclat.cases.json" with { type: "json" };
import coordsVectorsRecgeoCasesRaw from "./coords-vectors/recgeo.cases.json" with { type: "json" };
import coordsVectorsRecsphCasesRaw from "./coords-vectors/recsph.cases.json" with { type: "json" };
import coordsVectorsRotateCasesRaw from "./coords-vectors/rotate.cases.json" with { type: "json" };
import coordsVectorsRotmatCasesRaw from "./coords-vectors/rotmat.cases.json" with { type: "json" };
import coordsVectorsSphrecCasesRaw from "./coords-vectors/sphrec.cases.json" with { type: "json" };
import coordsVectorsVaddCasesRaw from "./coords-vectors/vadd.cases.json" with { type: "json" };
import coordsVectorsVcrssCasesRaw from "./coords-vectors/vcrss.cases.json" with { type: "json" };
import coordsVectorsVdotCasesRaw from "./coords-vectors/vdot.cases.json" with { type: "json" };
import coordsVectorsVhatCasesRaw from "./coords-vectors/vhat.cases.json" with { type: "json" };
import coordsVectorsVminusCasesRaw from "./coords-vectors/vminus.cases.json" with { type: "json" };
import coordsVectorsVnormCasesRaw from "./coords-vectors/vnorm.cases.json" with { type: "json" };
import coordsVectorsVsclCasesRaw from "./coords-vectors/vscl.cases.json" with { type: "json" };
import coordsVectorsVsubCasesRaw from "./coords-vectors/vsub.cases.json" with { type: "json" };
import ekCasesRaw from "./ek.cases.json" with { type: "json" };
import idsNamesCasesRaw from "./ids-names.cases.json" with { type: "json" };
import kernelPoolCasesRaw from "./kernel-pool.cases.json" with { type: "json" };
import kernelsCasesRaw from "./kernels.cases.json" with { type: "json" };
import timeDeltetCasesRaw from "./time/deltet.cases.json" with { type: "json" };
import timeEt2UtcCasesRaw from "./time/et2utc.cases.json" with { type: "json" };
import timeScdecdCasesRaw from "./time/scdecd.cases.json" with { type: "json" };
import timeSce2cCasesRaw from "./time/sce2c.cases.json" with { type: "json" };
import timeSce2sCasesRaw from "./time/sce2s.cases.json" with { type: "json" };
import timeScencdCasesRaw from "./time/scencd.cases.json" with { type: "json" };
import timeScs2eCasesRaw from "./time/scs2e.cases.json" with { type: "json" };
import timeSct2eCasesRaw from "./time/sct2e.cases.json" with { type: "json" };
import timeStr2EtCasesRaw from "./time/str2et.cases.json" with { type: "json" };
import timeTimdefCasesRaw from "./time/timdef.cases.json" with { type: "json" };
import timeTimoutCasesRaw from "./time/timout.cases.json" with { type: "json" };
import timeTkvrsnCasesRaw from "./time/tkvrsn.cases.json" with { type: "json" };
import timeTparseCasesRaw from "./time/tparse.cases.json" with { type: "json" };
import timeTpictrCasesRaw from "./time/tpictr.cases.json" with { type: "json" };
import timeUnitimCasesRaw from "./time/unitim.cases.json" with { type: "json" };

export const timeCases: ParityCase[] = [
  ...(timeStr2EtCasesRaw as ParityCase[]),
  ...(timeEt2UtcCasesRaw as ParityCase[]),
  ...(timeTimdefCasesRaw as ParityCase[]),
  ...(timeDeltetCasesRaw as ParityCase[]),
  ...(timeScdecdCasesRaw as ParityCase[]),
  ...(timeSce2cCasesRaw as ParityCase[]),
  ...(timeSce2sCasesRaw as ParityCase[]),
  ...(timeScencdCasesRaw as ParityCase[]),
  ...(timeScs2eCasesRaw as ParityCase[]),
  ...(timeSct2eCasesRaw as ParityCase[]),
  ...(timeTimoutCasesRaw as ParityCase[]),
  ...(timeTkvrsnCasesRaw as ParityCase[]),
  ...(timeTparseCasesRaw as ParityCase[]),
  ...(timeTpictrCasesRaw as ParityCase[]),
  ...(timeUnitimCasesRaw as ParityCase[]),
];

export const idsNamesCases = idsNamesCasesRaw as ParityCase[];
export const coordsVectorsCases: ParityCase[] = [
  ...(coordsVectorsReclatCasesRaw as ParityCase[]),
  ...(coordsVectorsLatrecCasesRaw as ParityCase[]),
  ...(coordsVectorsRecsphCasesRaw as ParityCase[]),
  ...(coordsVectorsSphrecCasesRaw as ParityCase[]),
  ...(coordsVectorsVnormCasesRaw as ParityCase[]),
  ...(coordsVectorsVhatCasesRaw as ParityCase[]),
  ...(coordsVectorsVdotCasesRaw as ParityCase[]),
  ...(coordsVectorsVcrssCasesRaw as ParityCase[]),
  ...(coordsVectorsVaddCasesRaw as ParityCase[]),
  ...(coordsVectorsVsubCasesRaw as ParityCase[]),
  ...(coordsVectorsVminusCasesRaw as ParityCase[]),
  ...(coordsVectorsVsclCasesRaw as ParityCase[]),
  ...(coordsVectorsMxmCasesRaw as ParityCase[]),
  ...(coordsVectorsRotateCasesRaw as ParityCase[]),
  ...(coordsVectorsRotmatCasesRaw as ParityCase[]),
  ...(coordsVectorsAxisarCasesRaw as ParityCase[]),
  ...(coordsVectorsGeorecCasesRaw as ParityCase[]),
  ...(coordsVectorsRecgeoCasesRaw as ParityCase[]),
  ...(coordsVectorsMxvCasesRaw as ParityCase[]),
  ...(coordsVectorsMtxvCasesRaw as ParityCase[]),
];
export const cellsWindowsCases = cellsWindowsCasesRaw as ParityCase[];
export const kernelPoolCases = kernelPoolCasesRaw as ParityCase[];
export const kernelsCases = kernelsCasesRaw as ParityCase[];
export const ekCases = ekCasesRaw as ParityCase[];

export const allCases: ParityCase[] = [
  ...timeCases,
  ...idsNamesCases,
  ...coordsVectorsCases,
  ...cellsWindowsCases,
  ...kernelPoolCases,
  ...kernelsCases,
  ...ekCases,
];
