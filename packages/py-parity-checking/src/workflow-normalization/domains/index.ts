import type { DomainNormalizer } from "../types.js";

import { kernelsNormalizer } from "./kernels.js";

export const normalizers: DomainNormalizer[] = [kernelsNormalizer];
