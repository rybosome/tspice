import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { resolvePackageEntrypoints } from "../src/indexing/resolvePackageEntrypoints.js";
import { validatePackageRoots } from "../src/indexing/validatePackageRoots.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures", "entrypoints-repo");

describe("resolvePackageEntrypoints", () => {
  it("normalizes export targets before mapping dist -> src", async () => {
    const [pkg] = await validatePackageRoots({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-normalize"]
    });

    expect(pkg).toBeDefined();

    const entrypoints = await resolvePackageEntrypoints({
      repoRoot: fixtureRoot,
      pkg: pkg!
    });

    expect(entrypoints).toEqual(["packages/pkg-normalize/src/index.ts"]);
  });

  it("rejects export targets that contain parent traversal segments", async () => {
    const [pkg] = await validatePackageRoots({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-dotdot"]
    });

    expect(pkg).toBeDefined();

    await expect(
      resolvePackageEntrypoints({
        repoRoot: fixtureRoot,
        pkg: pkg!
      })
    ).rejects.toThrowError(/parent.*[.]{2}.*segments/i);
  });

  it("rejects export targets that traverse outside the package root", async () => {
    const [pkg] = await validatePackageRoots({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-traversal"]
    });

    expect(pkg).toBeDefined();

    await expect(
      resolvePackageEntrypoints({
        repoRoot: fixtureRoot,
        pkg: pkg!
      })
    ).rejects.toThrowError(/traverse outside package root/i);
  });
});
