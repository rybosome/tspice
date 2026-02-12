import { describe, expect, it } from "vitest";

import { normalizeRepoRelativePath } from "../src/util/paths.js";

describe("normalizeRepoRelativePath", () => {
  it("normalizes leading ./ and collapses segments", () => {
    expect(normalizeRepoRelativePath("./packages/backend-contract")).toBe(
      "packages/backend-contract"
    );

    expect(normalizeRepoRelativePath("packages/backend-contract/../core")).toBe("packages/core");
  });

  it("normalizes Windows-style separators", () => {
    expect(normalizeRepoRelativePath("packages\\backend-contract")).toBe("packages/backend-contract");
    expect(normalizeRepoRelativePath(".\\packages\\backend-contract")).toBe(
      "packages/backend-contract"
    );
  });

  it("rejects absolute paths", () => {
    expect(() => normalizeRepoRelativePath("/tmp/x")).toThrowError(/repo-relative/);
    expect(() => normalizeRepoRelativePath("C:\\tmp\\x")).toThrowError(/repo-relative/);
  });

  it("rejects traversal that escapes the repo", () => {
    expect(() => normalizeRepoRelativePath("../packages/core")).toThrowError(/traverse/);
    expect(() => normalizeRepoRelativePath("packages/../../core")).toThrowError(/traverse/);
  });
});
