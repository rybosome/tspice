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
import dskDskb02CasesRaw from "./dsk/dskb02.cases.json" with { type: "json" };
import dskDskgdCasesRaw from "./dsk/dskgd.cases.json" with { type: "json" };
import dskDskobjCasesRaw from "./dsk/dskobj.cases.json" with { type: "json" };
import dskDsksrfCasesRaw from "./dsk/dsksrf.cases.json" with { type: "json" };
import ekEkaclcCasesRaw from "./ek/ekaclc.cases.json" with { type: "json" };
import ekEkacldCasesRaw from "./ek/ekacld.cases.json" with { type: "json" };
import ekEkacliCasesRaw from "./ek/ekacli.cases.json" with { type: "json" };
import ekEkclsCasesRaw from "./ek/ekcls.cases.json" with { type: "json" };
import ekEkgcCasesRaw from "./ek/ekgc.cases.json" with { type: "json" };
import ekEkgdCasesRaw from "./ek/ekgd.cases.json" with { type: "json" };
import ekEkffldCasesRaw from "./ek/ekffld.cases.json" with { type: "json" };
import ekEkfindCasesRaw from "./ek/ekfind.cases.json" with { type: "json" };
import ekEkgiCasesRaw from "./ek/ekgi.cases.json" with { type: "json" };
import ekEkifldCasesRaw from "./ek/ekifld.cases.json" with { type: "json" };
import ekEknsegCasesRaw from "./ek/eknseg.cases.json" with { type: "json" };
import ekEkntabCasesRaw from "./ek/ekntab.cases.json" with { type: "json" };
import ekEkopnCasesRaw from "./ek/ekopn.cases.json" with { type: "json" };
import ekEkoprCasesRaw from "./ek/ekopr.cases.json" with { type: "json" };
import ekEkopwCasesRaw from "./ek/ekopw.cases.json" with { type: "json" };
import ekEktnamCasesRaw from "./ek/ektnam.cases.json" with { type: "json" };
import ephemerisSpkclsCasesRaw from "./ephemeris/spkcls.cases.json" with { type: "json" };
import ephemerisSpkcovCasesRaw from "./ephemeris/spkcov.cases.json" with { type: "json" };
import ephemerisSpkezCasesRaw from "./ephemeris/spkez.cases.json" with { type: "json" };
import ephemerisSpkezpCasesRaw from "./ephemeris/spkezp.cases.json" with { type: "json" };
import ephemerisSpkezrCasesRaw from "./ephemeris/spkezr.cases.json" with { type: "json" };
import ephemerisSpkgeoCasesRaw from "./ephemeris/spkgeo.cases.json" with { type: "json" };
import ephemerisSpkgpsCasesRaw from "./ephemeris/spkgps.cases.json" with { type: "json" };
import ephemerisSpkobjCasesRaw from "./ephemeris/spkobj.cases.json" with { type: "json" };
import ephemerisSpkopaCasesRaw from "./ephemeris/spkopa.cases.json" with { type: "json" };
import ephemerisSpkopnCasesRaw from "./ephemeris/spkopn.cases.json" with { type: "json" };
import ephemerisSpkpdsCasesRaw from "./ephemeris/spkpds.cases.json" with { type: "json" };
import ephemerisSpkposCasesRaw from "./ephemeris/spkpos.cases.json" with { type: "json" };
import ephemerisSpksfsCasesRaw from "./ephemeris/spksfs.cases.json" with { type: "json" };
import ephemerisSpkssbCasesRaw from "./ephemeris/spkssb.cases.json" with { type: "json" };
import ephemerisSpkudsCasesRaw from "./ephemeris/spkuds.cases.json" with { type: "json" };
import ephemerisSpkw08CasesRaw from "./ephemeris/spkw08.cases.json" with { type: "json" };
import { errorCases } from "./error/index.js";
import { framesCases } from "./frames/index.js";
import geometryGfGfdistCasesRaw from "./geometry-gf/gfdist.cases.json" with { type: "json" };
import geometryGfGfrefnCasesRaw from "./geometry-gf/gfrefn.cases.json" with { type: "json" };
import geometryGfGfrepfCasesRaw from "./geometry-gf/gfrepf.cases.json" with { type: "json" };
import geometryGfGfrepiCasesRaw from "./geometry-gf/gfrepi.cases.json" with { type: "json" };
import geometryGfGfsepCasesRaw from "./geometry-gf/gfsep.cases.json" with { type: "json" };
import geometryGfGfsstpCasesRaw from "./geometry-gf/gfsstp.cases.json" with { type: "json" };
import geometryGfGfstepCasesRaw from "./geometry-gf/gfstep.cases.json" with { type: "json" };
import geometryGfGfstolCasesRaw from "./geometry-gf/gfstol.cases.json" with { type: "json" };
import fileIoDafbfsCasesRaw from "./file-io/dafbfs.cases.json" with { type: "json" };
import fileIoDafclsCasesRaw from "./file-io/dafcls.cases.json" with { type: "json" };
import fileIoDaffnaCasesRaw from "./file-io/daffna.cases.json" with { type: "json" };
import fileIoDafoprCasesRaw from "./file-io/dafopr.cases.json" with { type: "json" };
import fileIoDasclsCasesRaw from "./file-io/dascls.cases.json" with { type: "json" };
import fileIoDasoprCasesRaw from "./file-io/dasopr.cases.json" with { type: "json" };
import fileIoDlabfsCasesRaw from "./file-io/dlabfs.cases.json" with { type: "json" };
import fileIoDlaclsCasesRaw from "./file-io/dlacls.cases.json" with { type: "json" };
import fileIoDlafnsCasesRaw from "./file-io/dlafns.cases.json" with { type: "json" };
import fileIoDlaopnCasesRaw from "./file-io/dlaopn.cases.json" with { type: "json" };
import fileIoDskmi2CasesRaw from "./file-io/dskmi2.cases.json" with { type: "json" };
import fileIoDskopnCasesRaw from "./file-io/dskopn.cases.json" with { type: "json" };
import fileIoDskw02CasesRaw from "./file-io/dskw02.cases.json" with { type: "json" };
import fileIoExistsCasesRaw from "./file-io/exists.cases.json" with { type: "json" };
import fileIoGetfatCasesRaw from "./file-io/getfat.cases.json" with { type: "json" };
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
import { kernelPoolCases } from "./kernel-pool/index.js";
import { kernelsCases } from "./kernels/index.js";
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

export const fileIoCases: ParityCase[] = [
  ...(fileIoDafbfsCasesRaw as ParityCase[]),
  ...(fileIoDafclsCasesRaw as ParityCase[]),
  ...(fileIoDaffnaCasesRaw as ParityCase[]),
  ...(fileIoDafoprCasesRaw as ParityCase[]),
  ...(fileIoDasclsCasesRaw as ParityCase[]),
  ...(fileIoDasoprCasesRaw as ParityCase[]),
  ...(fileIoDlabfsCasesRaw as ParityCase[]),
  ...(fileIoDlaclsCasesRaw as ParityCase[]),
  ...(fileIoDlafnsCasesRaw as ParityCase[]),
  ...(fileIoDlaopnCasesRaw as ParityCase[]),
  ...(fileIoDskmi2CasesRaw as ParityCase[]),
  ...(fileIoDskopnCasesRaw as ParityCase[]),
  ...(fileIoDskw02CasesRaw as ParityCase[]),
  ...(fileIoExistsCasesRaw as ParityCase[]),
  ...(fileIoGetfatCasesRaw as ParityCase[]),
];
export { kernelPoolCases };
export const ephemerisCases: ParityCase[] = [
  ...(ephemerisSpkclsCasesRaw as ParityCase[]),
  ...(ephemerisSpkcovCasesRaw as ParityCase[]),
  ...(ephemerisSpkezCasesRaw as ParityCase[]),
  ...(ephemerisSpkezpCasesRaw as ParityCase[]),
  ...(ephemerisSpkezrCasesRaw as ParityCase[]),
  ...(ephemerisSpkgeoCasesRaw as ParityCase[]),
  ...(ephemerisSpkgpsCasesRaw as ParityCase[]),
  ...(ephemerisSpkobjCasesRaw as ParityCase[]),
  ...(ephemerisSpkopaCasesRaw as ParityCase[]),
  ...(ephemerisSpkopnCasesRaw as ParityCase[]),
  ...(ephemerisSpkpdsCasesRaw as ParityCase[]),
  ...(ephemerisSpkposCasesRaw as ParityCase[]),
  ...(ephemerisSpksfsCasesRaw as ParityCase[]),
  ...(ephemerisSpkssbCasesRaw as ParityCase[]),
  ...(ephemerisSpkudsCasesRaw as ParityCase[]),
  ...(ephemerisSpkw08CasesRaw as ParityCase[]),
];
export const ekCases: ParityCase[] = [
  ...(ekEkopnCasesRaw as ParityCase[]),
  ...(ekEkoprCasesRaw as ParityCase[]),
  ...(ekEkopwCasesRaw as ParityCase[]),
  ...(ekEkclsCasesRaw as ParityCase[]),
  ...(ekEkntabCasesRaw as ParityCase[]),
  ...(ekEktnamCasesRaw as ParityCase[]),
  ...(ekEknsegCasesRaw as ParityCase[]),
  ...(ekEkfindCasesRaw as ParityCase[]),
  ...(ekEkgcCasesRaw as ParityCase[]),
  ...(ekEkgdCasesRaw as ParityCase[]),
  ...(ekEkgiCasesRaw as ParityCase[]),
  ...(ekEkifldCasesRaw as ParityCase[]),
  ...(ekEkacliCasesRaw as ParityCase[]),
  ...(ekEkacldCasesRaw as ParityCase[]),
  ...(ekEkaclcCasesRaw as ParityCase[]),
  ...(ekEkffldCasesRaw as ParityCase[]),
];
export const dskCases: ParityCase[] = [
  ...(dskDskobjCasesRaw as ParityCase[]),
  ...(dskDsksrfCasesRaw as ParityCase[]),
  ...(dskDskgdCasesRaw as ParityCase[]),
  ...(dskDskb02CasesRaw as ParityCase[]),
];
export { errorCases };
export { framesCases };
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


export const geometryGfGfdistCases = geometryGfGfdistCasesRaw as ParityCase[];
export const geometryGfGfrefnCases = geometryGfGfrefnCasesRaw as ParityCase[];
export const geometryGfGfrepfCases = geometryGfGfrepfCasesRaw as ParityCase[];
export const geometryGfGfrepiCases = geometryGfGfrepiCasesRaw as ParityCase[];
export const geometryGfGfsepCases = geometryGfGfsepCasesRaw as ParityCase[];
export const geometryGfGfsstpCases = geometryGfGfsstpCasesRaw as ParityCase[];
export const geometryGfGfstepCases = geometryGfGfstepCasesRaw as ParityCase[];
export const geometryGfGfstolCases = geometryGfGfstolCasesRaw as ParityCase[];

export const geometryGfCases: ParityCase[] = [
  ...geometryGfGfstepCases,
  ...geometryGfGfsstpCases,
  ...geometryGfGfstolCases,
  ...geometryGfGfrefnCases,
  ...geometryGfGfrepfCases,
  ...geometryGfGfrepiCases,
  ...geometryGfGfsepCases,
  ...geometryGfGfdistCases,
];

export const allCases: ParityCase[] = [
  ...timeCases,
  ...idsNamesCases,
  ...coordsVectorsCases,
  ...cellsWindowsCases,
  ...kernelPoolCases,
  ...kernelsCases,
  ...ephemerisCases,
  ...fileIoCases,
  ...ekCases,
  ...dskCases,
  ...geometryCases,
  ...geometryGfCases,
  ...errorCases,
  ...framesCases,
];
