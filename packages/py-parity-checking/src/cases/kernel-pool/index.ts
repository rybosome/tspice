import type { ParityCase } from "../../case-types.js";

import badkpvCasesRaw from "./badkpv.cases.json" with { type: "json" };
import bodvcdCasesRaw from "./bodvcd.cases.json" with { type: "json" };
import bodvrdCasesRaw from "./bodvrd.cases.json" with { type: "json" };
import clpoolCasesRaw from "./clpool.cases.json" with { type: "json" };
import dvpoolCasesRaw from "./dvpool.cases.json" with { type: "json" };
import ldpoolCasesRaw from "./ldpool.cases.json" with { type: "json" };
import lmpoolCasesRaw from "./lmpool.cases.json" with { type: "json" };
import stpoolCasesRaw from "./stpool.cases.json" with { type: "json" };
import szpoolCasesRaw from "./szpool.cases.json" with { type: "json" };
import cvpoolCasesRaw from "./cvpool.cases.json" with { type: "json" };
import dtpoolCasesRaw from "./dtpool.cases.json" with { type: "json" };
import expoolCasesRaw from "./expool.cases.json" with { type: "json" };
import gcpoolCasesRaw from "./gcpool.cases.json" with { type: "json" };
import gdpoolCasesRaw from "./gdpool.cases.json" with { type: "json" };
import gipoolCasesRaw from "./gipool.cases.json" with { type: "json" };
import gnpoolCasesRaw from "./gnpool.cases.json" with { type: "json" };
import pcpoolCasesRaw from "./pcpool.cases.json" with { type: "json" };
import pdpoolCasesRaw from "./pdpool.cases.json" with { type: "json" };
import pipoolCasesRaw from "./pipool.cases.json" with { type: "json" };
import swpoolCasesRaw from "./swpool.cases.json" with { type: "json" };

export const kernelPoolBadkpvCases = badkpvCasesRaw as ParityCase[];
export const kernelPoolBodvcdCases = bodvcdCasesRaw as ParityCase[];
export const kernelPoolBodvrdCases = bodvrdCasesRaw as ParityCase[];
export const kernelPoolClpoolCases = clpoolCasesRaw as ParityCase[];
export const kernelPoolDvpoolCases = dvpoolCasesRaw as ParityCase[];
export const kernelPoolLdpoolCases = ldpoolCasesRaw as ParityCase[];
export const kernelPoolLmpoolCases = lmpoolCasesRaw as ParityCase[];
export const kernelPoolStpoolCases = stpoolCasesRaw as ParityCase[];
export const kernelPoolSzpoolCases = szpoolCasesRaw as ParityCase[];
export const kernelPoolCvpoolCases = cvpoolCasesRaw as ParityCase[];
export const kernelPoolDtpoolCases = dtpoolCasesRaw as ParityCase[];
export const kernelPoolExpoolCases = expoolCasesRaw as ParityCase[];
export const kernelPoolGcpoolCases = gcpoolCasesRaw as ParityCase[];
export const kernelPoolGdpoolCases = gdpoolCasesRaw as ParityCase[];
export const kernelPoolGipoolCases = gipoolCasesRaw as ParityCase[];
export const kernelPoolGnpoolCases = gnpoolCasesRaw as ParityCase[];
export const kernelPoolPcpoolCases = pcpoolCasesRaw as ParityCase[];
export const kernelPoolPdpoolCases = pdpoolCasesRaw as ParityCase[];
export const kernelPoolPipoolCases = pipoolCasesRaw as ParityCase[];
export const kernelPoolSwpoolCases = swpoolCasesRaw as ParityCase[];

export const kernelPoolCases: ParityCase[] = [
  ...kernelPoolBadkpvCases,
  ...kernelPoolBodvcdCases,
  ...kernelPoolBodvrdCases,
  ...kernelPoolClpoolCases,
  ...kernelPoolDvpoolCases,
  ...kernelPoolLdpoolCases,
  ...kernelPoolLmpoolCases,
  ...kernelPoolStpoolCases,
  ...kernelPoolSzpoolCases,
  ...kernelPoolGdpoolCases,
  ...kernelPoolGipoolCases,
  ...kernelPoolGcpoolCases,
  ...kernelPoolGnpoolCases,
  ...kernelPoolDtpoolCases,
  ...kernelPoolPdpoolCases,
  ...kernelPoolPipoolCases,
  ...kernelPoolPcpoolCases,
  ...kernelPoolSwpoolCases,
  ...kernelPoolCvpoolCases,
  ...kernelPoolExpoolCases,
];
