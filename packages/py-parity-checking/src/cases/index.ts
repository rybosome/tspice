import type { ParityCase } from "../case-types.js";

import { cellsWindowsCases } from "./cells-windows.cases.js";
import { coordsVectorsCases } from "./coords-vectors.cases.js";
import { ekCases } from "./ek.cases.js";
import { idsNamesCases } from "./ids-names.cases.js";
import { kernelPoolCases } from "./kernel-pool.cases.js";
import { kernelsCases } from "./kernels.cases.js";
import { timeCases } from "./time.cases.js";

export { timeCases } from "./time.cases.js";
export { idsNamesCases } from "./ids-names.cases.js";
export { coordsVectorsCases } from "./coords-vectors.cases.js";
export { cellsWindowsCases } from "./cells-windows.cases.js";
export { kernelPoolCases } from "./kernel-pool.cases.js";
export { kernelsCases } from "./kernels.cases.js";
export { ekCases } from "./ek.cases.js";

export const allCases: ParityCase[] = [
  ...timeCases,
  ...idsNamesCases,
  ...coordsVectorsCases,
  ...cellsWindowsCases,
  ...kernelPoolCases,
  ...kernelsCases,
  ...ekCases,
];
