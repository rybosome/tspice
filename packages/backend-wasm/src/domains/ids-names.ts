import type { IdsNamesApi } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { tspiceCallFoundInt, tspiceCallFoundString } from "../codec/found.js";

export function createIdsNamesApi(module: EmscriptenModule): IdsNamesApi {
  return {
    bodn2c: (name: string) => {
      const out = tspiceCallFoundInt(module, module._tspice_bodn2c, name);
      if (!out.found) return { found: false };
      return { found: true, code: out.value };
    },
    bodc2n: (code: number) => {
      const out = tspiceCallFoundString(module, module._tspice_bodc2n, code);
      if (!out.found) return { found: false };
      return { found: true, name: out.value };
    },
  };
}
