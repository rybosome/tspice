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

  it("allows a trailing -- (end of options)", () => {
    expect(parseCliArgs(["--"])).toEqual({
      kind: "run",
      options: {
        configPath: "repo-standards.yml",
        format: "pretty"
      }
    });
  });

  it("treats args after -- as positional (and errors)", () => {
    expect(() => parseCliArgs(["--", "--format", "json"]))
      .toThrowError(/unexpected positional arguments: --format json/);
  });

  it("normalizes --package the same as config paths", () => {
    expect(parseCliArgs(["--package", "./packages/backend-contract"])).toEqual({
      kind: "run",
      options: {
        configPath: "repo-standards.yml",
        format: "pretty",
        packageRoot: "packages/backend-contract"
      }
    });
  });
});
