import { readAliasMap } from "../generated/readAliasMap.js";
import { readContractCatalog } from "../generated/readContractCatalog.js";

export type DispatchAliasCoverageSummary = {
  aliasCount: number;
};

export function validateDispatchAliasCoverage(): DispatchAliasCoverageSummary {
  const aliasMap = readAliasMap();
  const contractCatalog = new Set(readContractCatalog());

  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (alias.includes(".")) {
      throw new Error(`Alias key must be a short alias without domain prefix: ${alias}`);
    }

    if (!contractCatalog.has(canonical)) {
      throw new Error(`Alias ${alias} points to unknown canonical method ${canonical}`);
    }
  }

  return {
    aliasCount: Object.keys(aliasMap).length,
  };
}
