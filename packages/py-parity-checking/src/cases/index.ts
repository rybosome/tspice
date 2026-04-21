import type { ParityCase } from "../case-types.js";

import canonicalAutoCasesRaw from "./canonical-auto.cases.json" with { type: "json" };

export const canonicalAutoCases = canonicalAutoCasesRaw as ParityCase[];

export const allCases: ParityCase[] = [...canonicalAutoCases];
