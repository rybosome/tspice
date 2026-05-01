import type { ParityCase } from "../../case-types.js";

import chkinCasesRaw from "./chkin.cases.json" with { type: "json" };
import chkoutCasesRaw from "./chkout.cases.json" with { type: "json" };
import failedCasesRaw from "./failed.cases.json" with { type: "json" };
import getmsgCasesRaw from "./getmsg.cases.json" with { type: "json" };
import resetCasesRaw from "./reset.cases.json" with { type: "json" };
import setmsgCasesRaw from "./setmsg.cases.json" with { type: "json" };
import sigerrCasesRaw from "./sigerr.cases.json" with { type: "json" };

export const errorChkinCases = chkinCasesRaw as ParityCase[];
export const errorChkoutCases = chkoutCasesRaw as ParityCase[];
export const errorFailedCases = failedCasesRaw as ParityCase[];
export const errorGetmsgCases = getmsgCasesRaw as ParityCase[];
export const errorResetCases = resetCasesRaw as ParityCase[];
export const errorSetmsgCases = setmsgCasesRaw as ParityCase[];
export const errorSigerrCases = sigerrCasesRaw as ParityCase[];

export const errorCases: ParityCase[] = [
  ...errorChkinCases,
  ...errorChkoutCases,
  ...errorFailedCases,
  ...errorGetmsgCases,
  ...errorResetCases,
  ...errorSetmsgCases,
  ...errorSigerrCases,
];
