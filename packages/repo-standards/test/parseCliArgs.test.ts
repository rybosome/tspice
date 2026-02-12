import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../src/cli.js";

describe("parseCliArgs", () => {
  it("parses defaults", () => {
    expect(parseCliArgs([])).toEqual({
      kind: "run",
      options: {
        configPath: "repo-standards.yml",
        format: "pretty"
      }
    });
  });

  it("supports --format json", () => {
    expect(parseCliArgs(["--format", "json"])).toEqual({
      kind: "run",
      options: {
        configPath: "repo-standards.yml",
        format: "json"
      }
    });
  });

  it("ignores standalone --", () => {
    expect(parseCliArgs(["--", "--format", "json"])).toEqual({
      kind: "run",
      options: {
        configPath: "repo-standards.yml",
        format: "json"
      }
    });
  });
});
