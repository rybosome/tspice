import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildRepoContext } from "../src/indexing/buildRepoContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures", "indexing-repo");
const fixtureRootNonSolution = path.join(__dirname, "fixtures", "indexing-repo-nonsolution");

function byPackageRoot(index: Awaited<ReturnType<typeof buildRepoContext>>["index"]):
  | Record<string, (typeof index.packages)[number]>
  | never {
  return Object.fromEntries(index.packages.map((p) => [p.packageRoot, p]));
}

describe("repo indexing layer", () => {
  it("builds a TS Program that can see multiple packages", { timeout: 20_000 }, async () => {
    const ctx = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a", "packages/pkg-b"]
    });

    expect(ctx.program.getProjectReferences()?.length ?? 0).toBeGreaterThan(0);

    const aIndexAbs = path.join(fixtureRoot, "packages/pkg-a/src/index.ts");
    const bIndexAbs = path.join(fixtureRoot, "packages/pkg-b/src/index.ts");

    expect(ctx.program.getSourceFile(aIndexAbs)).toBeDefined();
    expect(ctx.program.getSourceFile(bIndexAbs)).toBeDefined();
  });

  it("supports non-solution root tsconfig.json (falls back to fileNames)", { timeout: 20_000 }, async () => {
    const ctx = await buildRepoContext({
      repoRoot: fixtureRootNonSolution,
      packageRoots: ["packages/pkg-a", "packages/pkg-b"]
    });

    const aIndexAbs = path.join(fixtureRootNonSolution, "packages/pkg-a/src/index.ts");
    const bIndexAbs = path.join(fixtureRootNonSolution, "packages/pkg-b/src/index.ts");

    expect(ctx.program.getSourceFile(aIndexAbs)).toBeDefined();
    expect(ctx.program.getSourceFile(bIndexAbs)).toBeDefined();
  });

  it("resolves package entrypoints deterministically", async () => {
    const ctx = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a", "packages/pkg-b"]
    });

    const pkgs = byPackageRoot(ctx.index);

    expect(pkgs["packages/pkg-a"]?.entrypoints).toEqual([
      "packages/pkg-a/src/foo.ts",
      "packages/pkg-a/src/index.ts"
    ]);

    expect(pkgs["packages/pkg-b"]?.entrypoints).toEqual(["packages/pkg-b/src/index.ts"]);
  });

  it("walks the export graph with deterministic reachableSourceFiles", async () => {
    const ctx = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a"]
    });

    const [pkgA] = ctx.index.packages;
    expect(pkgA).toBeDefined();

    expect(pkgA?.reachableSourceFiles).toEqual([
      "packages/pkg-a/src/bar.ts",
      "packages/pkg-a/src/foo.ts",
      "packages/pkg-a/src/index.ts",
      "packages/pkg-a/src/qux.ts",
      "packages/pkg-a/src/reexport.ts",
      "packages/pkg-a/src/star.ts"
    ]);
  });

  it("builds exported-callable targets with stable ordering + original decl locations", async () => {
    const ctx = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a"]
    });

    const [pkgA] = ctx.index.packages;
    expect(pkgA).toBeDefined();

    expect(pkgA?.exportedCallables).toEqual([
      {
        exportName: "bar",
        originalName: "bar",
        callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/bar.ts:1:14:bar",
        location: {
          filePath: "packages/pkg-a/src/bar.ts",
          line: 1,
          col: 14
        }
      },
      {
        exportName: "foo",
        originalName: "foo",
        callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/foo.ts:1:17:foo",
        location: {
          filePath: "packages/pkg-a/src/foo.ts",
          line: 1,
          col: 17
        }
      },
      {
        exportName: "quxAlias",
        originalName: "qux",
        callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/qux.ts:1:17:quxAlias",
        location: {
          filePath: "packages/pkg-a/src/qux.ts",
          line: 1,
          col: 17
        }
      },
      {
        exportName: "baz",
        originalName: "baz",
        callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/star.ts:1:14:baz",
        location: {
          filePath: "packages/pkg-a/src/star.ts",
          line: 1,
          col: 14
        }
      }
    ]);
  });

  it("is deterministic across runs on identical repo state", async () => {
    const a = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a"]
    });

    const b = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a"]
    });

    expect(a.index).toEqual(b.index);
  });
});
