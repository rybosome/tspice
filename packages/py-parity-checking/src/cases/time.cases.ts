import type { ParityCase } from "../case-types.js";

export const timeCases: ParityCase[] = [
  {
    caseId: "time-str2et-et2utc-success",
    description: "Loads LSK and validates str2et + et2utc outputs",
    workflow: [
      { op: "kernels.furnsh", file: "kernels/naif0012.tls" },
      { op: "time.str2et", time: "2000 JAN 01 12:00:00 TDB" },
      { op: "time.et2utc", et: 0, format: "ISOC", prec: 3 },
    ],
    expectation: { kind: "success" },
  },
  {
    caseId: "time-timdef-stateful-success",
    description: "Exercises timdef state transitions (GET/SET)",
    workflow: [
      { op: "time.timdef", action: "GET", item: "SYSTEM" },
      { op: "time.timdef", action: "SET", item: "SYSTEM", value: "TDB" },
      { op: "time.timdef", action: "GET", item: "SYSTEM" },
      { op: "time.timdef", action: "SET", item: "SYSTEM", value: "UTC" },
      { op: "time.timdef", action: "GET", item: "SYSTEM" },
      { op: "time.timdef", action: "GET", item: "CALENDAR" },
      { op: "time.timdef", action: "SET", item: "CALENDAR", value: "GREGORIAN" },
      { op: "time.timdef", action: "GET", item: "CALENDAR" },
    ],
    expectation: { kind: "success" },
  },
  {
    caseId: "time-str2et-invalid-error",
    description: "Representative error path for invalid time parsing",
    workflow: [{ op: "time.str2et", time: "NOT_A_VALID_TIME_LITERAL" }],
    expectation: { kind: "error" },
  },
];
