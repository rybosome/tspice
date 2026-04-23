import type { DomainNormalizer } from "../types.js";

import { ekNormalizer } from "./ek.js";
import { fileIoNormalizer } from "./file-io.js";
import { framesNormalizer } from "./frames.js";
import { kernelsNormalizer } from "./kernels.js";

export const normalizers: DomainNormalizer[] = [
  ekNormalizer,
  fileIoNormalizer,
  framesNormalizer,
  kernelsNormalizer,
];
