import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";
import type { CaseRunner, RunCaseInputV2 } from "../../src/runners/types.js";

function createInput(method: string, args: unknown[]): RunCaseInputV2 {
  const inRefs = args.map((_, index) => `$args.${index}`);

  return {
    schemaVersion: 3,
    manifest: {
      id: `methods/${method.replaceAll(".", "/")}@v3`,
      kind: "method",
    },
    contract: {
      contractMethod: method,
      canonicalMethod: method,
      aliases: [],
      result: { const: null },
      errors: [{ code: "invalid_args" }, { code: "spice_error" }],
    },
    args,
    workflow: {
      steps: [{ op: "call", fn: method, in: inRefs }],
    },
  };
}

type InvalidRecipeCase = {
  method: string;
  args: unknown[];
  expectedMessage: string;
};

const tupleParseFailureCases: InvalidRecipeCase[] = [
  {
    method: "cells-windows.insrti",
    args: [1, ["int", -1]],
    expectedMessage: "cells-windows.insrti expects args[1] to be an int recipe tuple",
  },
  {
    method: "cells-windows.insrtd",
    args: [1.25, ["double", -1]],
    expectedMessage: "cells-windows.insrtd expects args[1] to be a double recipe tuple",
  },
  {
    method: "cells-windows.insrtc",
    args: ["x", ["char", 8, 0]],
    expectedMessage: "cells-windows.insrtc expects args[1] to be a char recipe tuple",
  },
  {
    method: "cells-windows.cellGeti",
    args: [["int", -1], 0],
    expectedMessage: "cells-windows.cellGeti expects args[0] to be an int recipe tuple",
  },
  {
    method: "cells-windows.cellGetd",
    args: [["double", -1], 0],
    expectedMessage: "cells-windows.cellGetd expects args[0] to be a double recipe tuple",
  },
  {
    method: "cells-windows.cellGetc",
    args: [["char", 8, 0], 0],
    expectedMessage: "cells-windows.cellGetc expects args[0] to be a char recipe tuple",
  },
  {
    method: "cells-windows.wninsd",
    args: [0, 1, ["window", -1]],
    expectedMessage: "cells-windows.wninsd expects args[2] to be a window recipe tuple",
  },
  {
    method: "cells-windows.wncard",
    args: [["window", -1]],
    expectedMessage: "cells-windows.wncard expects args[0] to be a window recipe tuple",
  },
  {
    method: "cells-windows.wnfetd",
    args: [["window", -1], 0],
    expectedMessage: "cells-windows.wnfetd expects args[0] to be a window recipe tuple",
  },
  {
    method: "cells-windows.wnvald",
    args: [0, 0, ["window", -1]],
    expectedMessage: "cells-windows.wnvald expects args[2] to be a window recipe tuple",
  },
];

const wrongKindCases: InvalidRecipeCase[] = [
  {
    method: "cells-windows.insrti",
    args: [1, ["double", 8]],
    expectedMessage: 'cells-windows.insrti expects args[1] to be ["int",size]',
  },
  {
    method: "cells-windows.insrtd",
    args: [1.25, ["int", 8]],
    expectedMessage: 'cells-windows.insrtd expects args[1] to be ["double",size]',
  },
  {
    method: "cells-windows.insrtc",
    args: ["x", ["int", 8]],
    expectedMessage: 'cells-windows.insrtc expects args[1] to be ["char",size,length]',
  },
  {
    method: "cells-windows.cellGeti",
    args: [["double", 8], 0],
    expectedMessage: 'cells-windows.cellGeti expects args[0] to be ["int",size]',
  },
  {
    method: "cells-windows.cellGetd",
    args: [["int", 8], 0],
    expectedMessage: 'cells-windows.cellGetd expects args[0] to be ["double",size]',
  },
  {
    method: "cells-windows.cellGetc",
    args: [["int", 8], 0],
    expectedMessage: 'cells-windows.cellGetc expects args[0] to be ["char",size,length]',
  },
  {
    method: "cells-windows.wninsd",
    args: [0, 1, ["int", 8]],
    expectedMessage: 'cells-windows.wninsd expects args[2] to be ["window",maxIntervals]',
  },
  {
    method: "cells-windows.wncard",
    args: [["int", 8]],
    expectedMessage: 'cells-windows.wncard expects args[0] to be ["window",maxIntervals]',
  },
  {
    method: "cells-windows.wnfetd",
    args: [["int", 8], 0],
    expectedMessage: 'cells-windows.wnfetd expects args[0] to be ["window",maxIntervals]',
  },
  {
    method: "cells-windows.wnvald",
    args: [0, 0, ["int", 8]],
    expectedMessage: 'cells-windows.wnvald expects args[2] to be ["window",maxIntervals]',
  },
];

const spiceIntValidationCases: InvalidRecipeCase[] = [
  {
    method: "cells-windows.insrti",
    args: [0.5, ["int", 8]],
    expectedMessage: "cells-windows.insrti expects args[0] to be an integer (SpiceInt range)",
  },
  {
    method: "cells-windows.cellGeti",
    args: [["int", 8], 0.5],
    expectedMessage: "cells-windows.cellGeti expects args[1] to be an integer (SpiceInt range)",
  },
  {
    method: "cells-windows.cellGetd",
    args: [["double", 8], 0.5],
    expectedMessage: "cells-windows.cellGetd expects args[1] to be an integer (SpiceInt range)",
  },
  {
    method: "cells-windows.cellGetc",
    args: [["char", 8, 8], 0.5],
    expectedMessage: "cells-windows.cellGetc expects args[1] to be an integer (SpiceInt range)",
  },
  {
    method: "cells-windows.wnfetd",
    args: [["window", 8], 0.5],
    expectedMessage: "cells-windows.wnfetd expects args[1] to be an integer (SpiceInt range)",
  },
  {
    method: "cells-windows.wnvald",
    args: [0.5, 8, ["window", 8]],
    expectedMessage: "cells-windows.wnvald expects args[0] to be an integer (SpiceInt range)",
  },
  {
    method: "cells-windows.wnvald",
    args: [8, 0.5, ["window", 8]],
    expectedMessage: "cells-windows.wnvald expects args[1] to be an integer (SpiceInt range)",
  },
  {
    method: "cells-windows.cellGetd",
    args: [["double", 8], 2147483648],
    expectedMessage: "cells-windows.cellGetd expects args[1] to be an integer (SpiceInt range)",
  },
];

const scalarTypeValidationCases: InvalidRecipeCase[] = [
  {
    method: "cells-windows.insrtd",
    args: ["bad", ["double", 8]],
    expectedMessage: "cells-windows.insrtd expects args[0] to be a number",
  },
  {
    method: "cells-windows.insrtc",
    args: [1, ["char", 8, 8]],
    expectedMessage: "cells-windows.insrtc expects args[0] to be a string",
  },
  {
    method: "cells-windows.wninsd",
    args: ["bad", 2.5, ["window", 4]],
    expectedMessage: "cells-windows.wninsd expects args[0] to be a number",
  },
  {
    method: "cells-windows.wninsd",
    args: [0.5, "bad", ["window", 4]],
    expectedMessage: "cells-windows.wninsd expects args[1] to be a number",
  },
];

const minArgValidationCases: InvalidRecipeCase[] = [
  {
    method: "cells-windows.insrti",
    args: [1],
    expectedMessage: "cells-windows.insrti expects args[0]=integer item args[1]=int recipe tuple",
  },
  {
    method: "cells-windows.insrtd",
    args: [1.25],
    expectedMessage: "cells-windows.insrtd expects args[0]=number item args[1]=double recipe tuple",
  },
  {
    method: "cells-windows.insrtc",
    args: ["x"],
    expectedMessage: "cells-windows.insrtc expects args[0]=string item args[1]=char recipe tuple",
  },
  {
    method: "cells-windows.cellGeti",
    args: [["int", 8]],
    expectedMessage: "cells-windows.cellGeti expects args[0]=int recipe tuple args[1]=integer index",
  },
  {
    method: "cells-windows.cellGetd",
    args: [["double", 8]],
    expectedMessage: "cells-windows.cellGetd expects args[0]=double recipe tuple args[1]=integer index",
  },
  {
    method: "cells-windows.cellGetc",
    args: [["char", 8, 8]],
    expectedMessage: "cells-windows.cellGetc expects args[0]=char recipe tuple args[1]=integer index",
  },
  {
    method: "cells-windows.wninsd",
    args: [0.5, 2.5],
    expectedMessage:
      "cells-windows.wninsd expects args[0]=number left args[1]=number right args[2]=window recipe tuple",
  },
  {
    method: "cells-windows.wncard",
    args: [],
    expectedMessage: "cells-windows.wncard expects args[0]=window recipe tuple",
  },
  {
    method: "cells-windows.wnfetd",
    args: [["window", 4]],
    expectedMessage: "cells-windows.wnfetd expects args[0]=window recipe tuple args[1]=integer index",
  },
  {
    method: "cells-windows.wnvald",
    args: [8, 0],
    expectedMessage:
      "cells-windows.wnvald expects args[0]=integer size args[1]=integer n args[2]=window recipe tuple",
  },
];

describe("tspiceRunner cells-windows tuple validation", () => {
  let tspice: CaseRunner;

  beforeAll(async () => {
    tspice = await createTspiceRunner();
  });

  afterAll(async () => {
    await tspice.dispose?.();
  });

  async function expectInvalidArgsMessage(testCase: InvalidRecipeCase): Promise<void> {
    const out = await tspice.runCase(createInput(testCase.method, testCase.args));

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("invalid_args");
      expect(out.error.message).toBe(testCase.expectedMessage);
    }
  }

  for (const testCase of tupleParseFailureCases) {
    it(`returns broad tuple parse message for ${testCase.method}`, async () => {
      await expectInvalidArgsMessage(testCase);
    });
  }

  for (const testCase of wrongKindCases) {
    it(`returns exact wrong-kind tuple shape for ${testCase.method}`, async () => {
      await expectInvalidArgsMessage(testCase);
    });
  }

  for (const testCase of spiceIntValidationCases) {
    it(`returns SpiceInt-style integer validation for ${testCase.method}`, async () => {
      await expectInvalidArgsMessage(testCase);
    });
  }

  for (const testCase of scalarTypeValidationCases) {
    it(`returns scalar arg type message for ${testCase.method}`, async () => {
      await expectInvalidArgsMessage(testCase);
    });
  }

  for (const testCase of minArgValidationCases) {
    it(`returns minimum-args message for ${testCase.method}`, async () => {
      await expectInvalidArgsMessage(testCase);
    });
  }
});
