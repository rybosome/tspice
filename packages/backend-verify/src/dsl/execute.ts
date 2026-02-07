import type { ScenarioAst, ScenarioCaseAst, ScenarioSetupAst } from "./types.js";
import type { CaseRunner, RunCaseResult } from "../runners/types.js";

export type ExecutedCase = {
  case: ScenarioCaseAst;
  outcome: RunCaseResult;
};

export type ExecuteScenarioResult = {
  scenario: ScenarioAst;
  cases: ExecutedCase[];
};

function mergeSetup(a: ScenarioSetupAst | undefined, b: ScenarioSetupAst | undefined): ScenarioSetupAst {
  const kernels = [...(a?.kernels ?? []), ...(b?.kernels ?? [])];
  return kernels.length === 0 ? {} : { kernels };
}

export async function executeScenario(scenario: ScenarioAst, runner: CaseRunner): Promise<ExecuteScenarioResult> {
  const executed: ExecutedCase[] = [];

  for (const c of scenario.cases) {
    const setup = mergeSetup(scenario.setup, c.setup);
    const outcome = await runner.runCase({
      setup,
      call: c.call,
      args: c.args ?? [],
    });

    executed.push({ case: c, outcome });
  }

  return { scenario, cases: executed };
}
