import type { ParityCase } from "../case-types.js";

import cellsWindowsCasesRaw from "./cells-windows.cases.json" with { type: "json" };
import coordsVectorsCasesRaw from "./coords-vectors.cases.json" with { type: "json" };
import ekCasesRaw from "./ek.cases.json" with { type: "json" };
import idsNamesCasesRaw from "./ids-names.cases.json" with { type: "json" };
import kernelPoolCasesRaw from "./kernel-pool.cases.json" with { type: "json" };
import kernelsCasesRaw from "./kernels.cases.json" with { type: "json" };
import timeCasesRaw from "./time.cases.json" with { type: "json" };

export const timeCases = timeCasesRaw as ParityCase[];
export const idsNamesCases = idsNamesCasesRaw as ParityCase[];
export const coordsVectorsCases = coordsVectorsCasesRaw as ParityCase[];
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
