import type { Found } from "../shared/types.js";

export interface IdsNamesApi {
  bodn2c(name: string): Found<{ code: number }>;
  bodc2n(code: number): Found<{ name: string }>;
}
