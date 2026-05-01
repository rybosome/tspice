import type { ParityCase } from "../../case-types.js";

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
