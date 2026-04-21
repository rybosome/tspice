import type { ParityCase } from "../case-types.js";

import cellsWindowsCardCasesRaw from "./cells-windows/card.cases.json" with { type: "json" };
import cellsWindowsInsrtcCasesRaw from "./cells-windows/insrtc.cases.json" with { type: "json" };
import cellsWindowsInsrtdCasesRaw from "./cells-windows/insrtd.cases.json" with { type: "json" };
import cellsWindowsInsrtiCasesRaw from "./cells-windows/insrti.cases.json" with { type: "json" };
import cellsWindowsScardCasesRaw from "./cells-windows/scard.cases.json" with { type: "json" };
import cellsWindowsSizeCasesRaw from "./cells-windows/size.cases.json" with { type: "json" };
import cellsWindowsSsizeCasesRaw from "./cells-windows/ssize.cases.json" with { type: "json" };
import cellsWindowsValidCasesRaw from "./cells-windows/valid.cases.json" with { type: "json" };
import cellsWindowsWncardCasesRaw from "./cells-windows/wncard.cases.json" with { type: "json" };
import cellsWindowsWnfetdCasesRaw from "./cells-windows/wnfetd.cases.json" with { type: "json" };
import cellsWindowsWninsdCasesRaw from "./cells-windows/wninsd.cases.json" with { type: "json" };
import cellsWindowsWnvaldCasesRaw from "./cells-windows/wnvald.cases.json" with { type: "json" };
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
import { errorCases } from "./error/index.js";
import geometryIllumfCasesRaw from "./geometry/illumf.cases.json" with { type: "json" };
import geometryIllumgCasesRaw from "./geometry/illumg.cases.json" with { type: "json" };
import geometryIluminCasesRaw from "./geometry/ilumin.cases.json" with { type: "json" };
import geometryNvc2plCasesRaw from "./geometry/nvc2pl.cases.json" with { type: "json" };
import geometryOccultCasesRaw from "./geometry/occult.cases.json" with { type: "json" };
import geometryPl2nvcCasesRaw from "./geometry/pl2nvc.cases.json" with { type: "json" };
import geometrySincptCasesRaw from "./geometry/sincpt.cases.json" with { type: "json" };
import geometrySubpntCasesRaw from "./geometry/subpnt.cases.json" with { type: "json" };
import geometrySubslrCasesRaw from "./geometry/subslr.cases.json" with { type: "json" };
import idsNamesBodc2nCasesRaw from "./ids-names/bodc2n.cases.json" with { type: "json" };
import idsNamesBodc2sCasesRaw from "./ids-names/bodc2s.cases.json" with { type: "json" };
import idsNamesBoddefCasesRaw from "./ids-names/boddef.cases.json" with { type: "json" };
import idsNamesBodfndCasesRaw from "./ids-names/bodfnd.cases.json" with { type: "json" };
import idsNamesBodn2cCasesRaw from "./ids-names/bodn2c.cases.json" with { type: "json" };
import idsNamesBods2cCasesRaw from "./ids-names/bods2c.cases.json" with { type: "json" };
import idsNamesBodvarCasesRaw from "./ids-names/bodvar.cases.json" with { type: "json" };
import { kernelsCases } from "./kernels/index.js";
import { kernelPoolCases } from "./kernel-pool/index.js";
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

export const idsNamesCases: ParityCase[] = [
  ...(idsNamesBodn2cCasesRaw as ParityCase[]),
  ...(idsNamesBodc2nCasesRaw as ParityCase[]),
  ...(idsNamesBodc2sCasesRaw as ParityCase[]),
  ...(idsNamesBoddefCasesRaw as ParityCase[]),
  ...(idsNamesBodfndCasesRaw as ParityCase[]),
  ...(idsNamesBods2cCasesRaw as ParityCase[]),
  ...(idsNamesBodvarCasesRaw as ParityCase[]),
];
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
export const cellsWindowsCases: ParityCase[] = [
  ...(cellsWindowsCardCasesRaw as ParityCase[]),
  ...(cellsWindowsInsrtcCasesRaw as ParityCase[]),
  ...(cellsWindowsInsrtdCasesRaw as ParityCase[]),
  ...(cellsWindowsInsrtiCasesRaw as ParityCase[]),
  ...(cellsWindowsScardCasesRaw as ParityCase[]),
  ...(cellsWindowsSizeCasesRaw as ParityCase[]),
  ...(cellsWindowsSsizeCasesRaw as ParityCase[]),
  ...(cellsWindowsValidCasesRaw as ParityCase[]),
  ...(cellsWindowsWncardCasesRaw as ParityCase[]),
  ...(cellsWindowsWninsdCasesRaw as ParityCase[]),
  ...(cellsWindowsWnfetdCasesRaw as ParityCase[]),
  ...(cellsWindowsWnvaldCasesRaw as ParityCase[]),
];
export { kernelPoolCases };
export const ekCases = ekCasesRaw as ParityCase[];
export { errorCases };
export const geometryCases: ParityCase[] = [
  ...(geometrySubpntCasesRaw as ParityCase[]),
  ...(geometrySubslrCasesRaw as ParityCase[]),
  ...(geometrySincptCasesRaw as ParityCase[]),
  ...(geometryIluminCasesRaw as ParityCase[]),
  ...(geometryIllumgCasesRaw as ParityCase[]),
  ...(geometryIllumfCasesRaw as ParityCase[]),
  ...(geometryOccultCasesRaw as ParityCase[]),
  ...(geometryNvc2plCasesRaw as ParityCase[]),
  ...(geometryPl2nvcCasesRaw as ParityCase[]),
];

export const allCases: ParityCase[] = [
  ...timeCases,
  ...idsNamesCases,
  ...coordsVectorsCases,
  ...cellsWindowsCases,
  ...kernelPoolCases,
  ...kernelsCases,
  ...ekCases,
  ...geometryCases,
  ...errorCases,
];
