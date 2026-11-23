import type { ParityCase } from "../../case-types.js";

import ccifrmCasesRaw from "./ccifrm.cases.json" with { type: "json" };
import cidfrmCasesRaw from "./cidfrm.cases.json" with { type: "json" };
import ckcovCasesRaw from "./ckcov.cases.json" with { type: "json" };
import ckgpCasesRaw from "./ckgp.cases.json" with { type: "json" };
import ckgpavCasesRaw from "./ckgpav.cases.json" with { type: "json" };
import pckclsCasesRaw from "./pckcls.cases.json" with { type: "json" };
import pckcovCasesRaw from "./pckcov.cases.json" with { type: "json" };
import pckfrmCasesRaw from "./pckfrm.cases.json" with { type: "json" };
import pcklofCasesRaw from "./pcklof.cases.json" with { type: "json" };
import pckopnCasesRaw from "./pckopn.cases.json" with { type: "json" };
import pckuofCasesRaw from "./pckuof.cases.json" with { type: "json" };
import pckw02CasesRaw from "./pckw02.cases.json" with { type: "json" };
import ckopnCasesRaw from "./ckopn.cases.json" with { type: "json" };
import ckclsCasesRaw from "./ckcls.cases.json" with { type: "json" };
import ckw01CasesRaw from "./ckw01.cases.json" with { type: "json" };
import ckw02CasesRaw from "./ckw02.cases.json" with { type: "json" };
import ckw03CasesRaw from "./ckw03.cases.json" with { type: "json" };
import ckw05CasesRaw from "./ckw05.cases.json" with { type: "json" };
import ckfrotCasesRaw from "./ckfrot.cases.json" with { type: "json" };
import ckfxfmCasesRaw from "./ckfxfm.cases.json" with { type: "json" };
import ckgr02CasesRaw from "./ckgr02.cases.json" with { type: "json" };
import ckgr03CasesRaw from "./ckgr03.cases.json" with { type: "json" };
import ckmetaCasesRaw from "./ckmeta.cases.json" with { type: "json" };
import cknr02CasesRaw from "./cknr02.cases.json" with { type: "json" };
import cknr03CasesRaw from "./cknr03.cases.json" with { type: "json" };
import cklpfCasesRaw from "./cklpf.cases.json" with { type: "json" };
import ckobjCasesRaw from "./ckobj.cases.json" with { type: "json" };
import ckupfCasesRaw from "./ckupf.cases.json" with { type: "json" };
import cnmfrmCasesRaw from "./cnmfrm.cases.json" with { type: "json" };
import frinfoCasesRaw from "./frinfo.cases.json" with { type: "json" };
import frmnamCasesRaw from "./frmnam.cases.json" with { type: "json" };
import namfrmCasesRaw from "./namfrm.cases.json" with { type: "json" };
import bltfrmCasesRaw from "./bltfrm.cases.json" with { type: "json" };
import pxfrm2CasesRaw from "./pxfrm2.cases.json" with { type: "json" };
import tipbodCasesRaw from "./tipbod.cases.json" with { type: "json" };
import tisbodCasesRaw from "./tisbod.cases.json" with { type: "json" };
import tkframCasesRaw from "./tkfram.cases.json" with { type: "json" };
import xfmstaCasesRaw from "./xfmsta.cases.json" with { type: "json" };
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
export const framesBltfrmCases = bltfrmCasesRaw as ParityCase[];
export const framesPxfrm2Cases = pxfrm2CasesRaw as ParityCase[];
export const framesTipbodCases = tipbodCasesRaw as ParityCase[];
export const framesTisbodCases = tisbodCasesRaw as ParityCase[];
export const framesTkframCases = tkframCasesRaw as ParityCase[];
export const framesXfmstaCases = xfmstaCasesRaw as ParityCase[];
export const framesPxformCases = pxformCasesRaw as ParityCase[];
export const framesSxformCases = sxformCasesRaw as ParityCase[];

export const framesCases: ParityCase[] = [
  ...framesCcifrmCases,
  ...framesCidfrmCases,
  ...framesCkcovCases,
  ...framesCkgpCases,
  ...framesCkgpavCases,
  ...(pckclsCasesRaw as ParityCase[]),
  ...(pckcovCasesRaw as ParityCase[]),
  ...(pckfrmCasesRaw as ParityCase[]),
  ...(pcklofCasesRaw as ParityCase[]),
  ...(pckopnCasesRaw as ParityCase[]),
  ...(pckuofCasesRaw as ParityCase[]),
  ...(pckw02CasesRaw as ParityCase[]),
  ...(ckopnCasesRaw as ParityCase[]),
  ...(ckclsCasesRaw as ParityCase[]),
  ...(ckw01CasesRaw as ParityCase[]),
  ...(ckw02CasesRaw as ParityCase[]),
  ...(ckw03CasesRaw as ParityCase[]),
  ...(ckw05CasesRaw as ParityCase[]),
  ...(ckfrotCasesRaw as ParityCase[]),
  ...(ckfxfmCasesRaw as ParityCase[]),
  ...(ckgr02CasesRaw as ParityCase[]),
  ...(ckgr03CasesRaw as ParityCase[]),
  ...(ckmetaCasesRaw as ParityCase[]),
  ...(cknr02CasesRaw as ParityCase[]),
  ...(cknr03CasesRaw as ParityCase[]),
  ...framesCklpfCases,
  ...framesCkobjCases,
  ...framesCkupfCases,
  ...framesCnmfrmCases,
  ...framesFrinfoCases,
  ...framesFrmnamCases,
  ...framesNamfrmCases,
  ...framesBltfrmCases,
  ...framesPxfrm2Cases,
  ...framesTipbodCases,
  ...framesTisbodCases,
  ...framesTkframCases,
  ...framesXfmstaCases,
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
