import type { ParityCase } from "../case-types.js";

export const coordsVectorsCases: ParityCase[] = [
  {
    caseId: "coords-vectors-mxm-success",
    description: "mxm matrix multiplication fixed case",
    workflow: [
      {
        op: "coords-vectors.mxm",
        m1: [
          [1, 2, 3],
          [0, 1, 4],
          [5, 6, 0],
        ],
        m2: [
          [7, 8, 9],
          [2, 3, 4],
          [1, 0, 1],
        ],
      },
    ],
    expectation: { kind: "success" },
  },
  {
    caseId: "coords-vectors-recgeo-success",
    description: "recgeo deterministic axis-aligned case",
    workflow: [
      {
        op: "coords-vectors.recgeo",
        rectan: [1, 0, 0],
        re: 1,
        f: 0,
      },
    ],
    expectation: { kind: "success" },
  },
  {
    caseId: "coords-vectors-recgeo-invalid-error",
    description: "Representative recgeo invalid flattening error",
    workflow: [
      {
        op: "coords-vectors.recgeo",
        rectan: [1, 0, 0],
        re: 1,
        f: 1.5,
      },
    ],
    expectation: { kind: "error" },
  },
];
