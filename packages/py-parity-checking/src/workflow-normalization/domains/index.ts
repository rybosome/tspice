import type { DomainNormalizer } from "../types.js";

import { ekNormalizer } from "./ek.js";
import { ephemerisNormalizer } from "./ephemeris.js";
import { kernelsNormalizer } from "./kernels.js";

export const normalizers: DomainNormalizer[] = [ekNormalizer, ephemerisNormalizer, kernelsNormalizer];
