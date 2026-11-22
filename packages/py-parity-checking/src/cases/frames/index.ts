import type { ParityCase } from "../../case-types.js";

import ccifrmCasesRaw from "./ccifrm.cases.json" with { type: "json" };
import cidfrmCasesRaw from "./cidfrm.cases.json" with { type: "json" };
import ckcovCasesRaw from "./ckcov.cases.json" with { type: "json" };
import ckgpCasesRaw from "./ckgp.cases.json" with { type: "json" };
import ckgpavCasesRaw from "./ckgpav.cases.json" with { type: "json" };
import cklpfCasesRaw from "./cklpf.cases.json" with { type: "json" };
import ckobjCasesRaw from "./ckobj.cases.json" with { type: "json" };
import ckupfCasesRaw from "./ckupf.cases.json" with { type: "json" };
import cnmfrmCasesRaw from "./cnmfrm.cases.json" with { type: "json" };
import frinfoCasesRaw from "./frinfo.cases.json" with { type: "json" };
import frmnamCasesRaw from "./frmnam.cases.json" with { type: "json" };
import namfrmCasesRaw from "./namfrm.cases.json" with { type: "json" };
import pxformCasesRaw from "./pxform.cases.json" with { type: "json" };
import frameCasesRaw from "./frame.cases.json" with { type: "json" };
import twovecCasesRaw from "./twovec.cases.json" with { type: "json" };
import twovxfCasesRaw from "./twovxf.cases.json" with { type: "json" };
import eul2xfCasesRaw from "./eul2xf.cases.json" with { type: "json" };
import xf2eulCasesRaw from "./xf2eul.cases.json" with { type: "json" };
import xf2ravCasesRaw from "./xf2rav.cases.json" with { type: "json" };
import rav2xfCasesRaw from "./rav2xf.cases.json" with { type: "json" };
import invstmCasesRaw from "./invstm.cases.json" with { type: "json" };
import xpose6CasesRaw from "./xpose6.cases.json" with { type: "json" };
import sxformCasesRaw from "./sxform.cases.json" with { type: "json" };

export const framesCcifrmCases = ccifrmCasesRaw as ParityCase[];
export const framesCidfrmCases = cidfrmCasesRaw as ParityCase[];
export const framesCkcovCases = ckcovCasesRaw as ParityCase[];
export const framesCkgpCases = ckgpCasesRaw as ParityCase[];
export const framesCkgpavCases = ckgpavCasesRaw as ParityCase[];
export const framesCklpfCases = cklpfCasesRaw as ParityCase[];
export const framesCkobjCases = ckobjCasesRaw as ParityCase[];
export const framesCkupfCases = ckupfCasesRaw as ParityCase[];
export const framesCnmfrmCases = cnmfrmCasesRaw as ParityCase[];
export const framesFrinfoCases = frinfoCasesRaw as ParityCase[];
export const framesFrmnamCases = frmnamCasesRaw as ParityCase[];
export const framesNamfrmCases = namfrmCasesRaw as ParityCase[];
export const framesPxformCases = pxformCasesRaw as ParityCase[];
export const framesSxformCases = sxformCasesRaw as ParityCase[];

export const framesCases: ParityCase[] = [
  ...framesCcifrmCases,
  ...framesCidfrmCases,
  ...framesCkcovCases,
  ...framesCkgpCases,
  ...framesCkgpavCases,
  ...framesCklpfCases,
  ...framesCkobjCases,
  ...framesCkupfCases,
  ...framesCnmfrmCases,
  ...framesFrinfoCases,
  ...framesFrmnamCases,
  ...framesNamfrmCases,
  ...framesPxformCases,
  ...(frameCasesRaw as ParityCase[]),
  ...(twovecCasesRaw as ParityCase[]),
  ...(twovxfCasesRaw as ParityCase[]),
  ...(eul2xfCasesRaw as ParityCase[]),
  ...(xf2eulCasesRaw as ParityCase[]),
  ...(xf2ravCasesRaw as ParityCase[]),
  ...(rav2xfCasesRaw as ParityCase[]),
  ...(invstmCasesRaw as ParityCase[]),
  ...(xpose6CasesRaw as ParityCase[]),
  ...framesSxformCases,
];
