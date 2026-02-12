import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/loadConfig.js";

describe("loadConfig", () => {
  it("loads and normalizes rule package paths", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repo-standards-"));

    await fs.writeFile(
      path.join(dir, "repo-standards.yml"),
      [
        "schemaVersion: 1",
        "rules:",
        "  require-jsdoc-on-exported-callables:",
        "    packages:",
        "      - ./packages/backend-contract",
        "  require-parity-scenario-for-backend-method:",
        "    packages: []",
        "  require-perf-benchmark-for-backend-method:",
        "    packages: []"
      ].join("\n"),
      "utf8"
    );

    const loaded = await loadConfig({ repoRoot: dir, configPath: "repo-standards.yml" });

    expect(loaded.config.schemaVersion).toBe(1);
    expect(loaded.config.rules["require-jsdoc-on-exported-callables"].packages).toEqual([
      "packages/backend-contract"
    ]);
  });
});
