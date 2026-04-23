import type { DomainNormalizer } from "../types.js";

import { fileIoNormalizer } from "./file-io.js";
import { framesNormalizer } from "./frames.js";
import { kernelsNormalizer } from "./kernels.js";

export const normalizers: DomainNormalizer[] = [fileIoNormalizer, framesNormalizer, kernelsNormalizer];
