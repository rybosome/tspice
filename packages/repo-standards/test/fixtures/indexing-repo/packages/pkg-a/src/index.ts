export { foo } from "./foo.js";

import { bar } from "./bar.js";
export { bar };

export { qux as quxAlias } from "./reexport.js";

export * from "./star.js";
