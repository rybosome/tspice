import type { ParityCase } from "../../case-types.js";

import furnshCasesRaw from "./furnsh.cases.json" with { type: "json" };
import kclearCasesRaw from "./kclear.cases.json" with { type: "json" };
import kdataCasesRaw from "./kdata.cases.json" with { type: "json" };
import kinfoCasesRaw from "./kinfo.cases.json" with { type: "json" };
import kplfrmCasesRaw from "./kplfrm.cases.json" with { type: "json" };
import ktotalCasesRaw from "./ktotal.cases.json" with { type: "json" };
import kxtrctCasesRaw from "./kxtrct.cases.json" with { type: "json" };
import unloadCasesRaw from "./unload.cases.json" with { type: "json" };

export const kernelsFurnshCases = furnshCasesRaw as ParityCase[];
export const kernelsKclearCases = kclearCasesRaw as ParityCase[];
export const kernelsKinfoCases = kinfoCasesRaw as ParityCase[];
export const kernelsKplfrmCases = kplfrmCasesRaw as ParityCase[];
export const kernelsKtotalCases = ktotalCasesRaw as ParityCase[];
export const kernelsKdataCases = kdataCasesRaw as ParityCase[];
export const kernelsKxtrctCases = kxtrctCasesRaw as ParityCase[];
export const kernelsUnloadCases = unloadCasesRaw as ParityCase[];

export const kernelsCases: ParityCase[] = [
  ...kernelsFurnshCases,
  ...kernelsKclearCases,
  ...kernelsKinfoCases,
  ...kernelsKplfrmCases,
  ...kernelsKtotalCases,
  ...kernelsKdataCases,
  ...kernelsKxtrctCases,
  ...kernelsUnloadCases,
];
