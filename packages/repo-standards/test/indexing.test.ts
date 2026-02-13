import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildRepoContext } from "../src/indexing/buildRepoContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures", "indexing-repo");

function byPackageRoot(index: Awaited<ReturnType<typeof buildRepoContext>>["index"]):
  | Record<string, (typeof index.packages)[number]>
  | never {
  return Object.fromEntries(index.packages.map((p) => [p.packageRoot, p]));
}

describe("repo indexing layer", () => {
  it("builds a TS Program that can see multiple packages", async () => {
    const ctx = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a", "packages/pkg-b"]
    });

    const aIndexAbs = path.join(fixtureRoot, "packages/pkg-a/src/index.ts");
    const bIndexAbs = path.join(fixtureRoot, "packages/pkg-b/src/index.ts");

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
        callId: "exported-callable:packages/pkg-a/src/bar.ts:bar",
        location: {
          filePath: "packages/pkg-a/src/bar.ts",
          line: 1,
          col: 14
        }
      },
      {
        exportName: "foo",
        originalName: "foo",
        callId: "exported-callable:packages/pkg-a/src/foo.ts:foo",
        location: {
          filePath: "packages/pkg-a/src/foo.ts",
          line: 1,
          col: 17
        }
      },
      {
        exportName: "quxAlias",
        originalName: "qux",
        callId: "exported-callable:packages/pkg-a/src/qux.ts:quxAlias",
        location: {
          filePath: "packages/pkg-a/src/qux.ts",
          line: 1,
          col: 17
        }
      },
      {
        exportName: "baz",
        originalName: "baz",
        callId: "exported-callable:packages/pkg-a/src/star.ts:baz",
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
