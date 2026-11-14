import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

import type { SpiceAsync, SpiceSync } from "@rybosome/tspice";
type DskReadArgs = Parameters<SpiceSync["raw"]["dskz02"]>;
async function readDskPages(
  sync: SpiceSync,
  asyncSpice: SpiceAsync,
  h: DskReadArgs[0],
  d: DskReadArgs[1],
) {
  const { nv, np } = sync.raw.dskz02(h, d);
  const points = await asyncSpice.raw.dskv02(h, d, 1, nv),
    triangles = sync.raw.dskp02(h, d, 1, np);
  const normal = sync.raw.dskn02(h, d, 1),
    doubles = sync.raw.dskd02(h, d, 19, 0, 3),
    ints = sync.raw.dski02(h, d, 9, 0, 3);
  sync.raw.dskcls(h, false);
  return [points, triangles, normal, doubles, ints];
}
void readDskPages;

function readRay(spice: import("@rybosome/tspice").SpiceSync, path: string) {
  const h = spice.raw.dasopr(path);
  try {
    const desc = spice.raw.dlabfs(h),
      v = [10, 1, 0.25] as const,
      d = [-1, 0, 0] as const;
    if (desc.found) {
      spice.raw.illum_pl02(h, desc.descr, "100101", 0, "NONE", "100102", v);
      spice.raw.illum_plid_pl02(
        h,
        desc.descr,
        "100101",
        0,
        "NONE",
        "100102",
        v,
        1,
      );
      spice.raw.limb_pl02(
        h,
        desc.descr,
        "100101",
        0,
        "AUDIT_GEOMETRY_FIXED",
        "NONE",
        "100102",
        4,
      );
      spice.raw.llgrid_pl02(h, desc.descr, [[0, 0]]);
      spice.raw.subpt_pl02(
        h,
        desc.descr,
        "INTERCEPT",
        "100101",
        0,
        "NONE",
        "100102",
      );
      spice.raw.subsol_pl02(
        h,
        desc.descr,
        "INTERCEPT",
        "100101",
        0,
        "NONE",
        "100102",
      );
      spice.raw.term_pl02(
        h,
        desc.descr,
        "UMBRAL",
        "SUN",
        "100101",
        0,
        "AUDIT_GEOMETRY_FIXED",
        "NONE",
        "100102",
        4,
      );
    }
    if (desc.found) spice.raw.dskx02(h, desc.descr, v, d);
    const src = spice.raw.dskxsi(
      false,
      "100101",
      [],
      0,
      "AUDIT_GEOMETRY_FIXED",
      v,
      d,
    );
    spice.raw.dskxv(false, "100101", [], 0, "AUDIT_GEOMETRY_FIXED", [v], [d]);
    const x = spice.raw.dskgtl(1);
    spice.raw.dskstl(1, x);
    return src.found ? src.dskdsc : undefined;
  } finally {
    spice.raw.dascls(h);
  }
}
void readRay;

/** Exercise all extended surface operations with immutable caller coordinates. */
export function extendedSurfaceTypes(raw: SpiceSync["raw"]) {
  const grid = [[0.3, 0.2]] as const;
  const points = raw.latsrf(
    "ELLIPSOID",
    "100101",
    0,
    "AUDIT_GEOMETRY_FIXED",
    grid,
  );
  const cut = [
    "100101",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "CENTER",
    "100102",
    [0, 0, 1],
    1,
    2,
    0.1,
    0.001,
    4,
  ] as const;
  return [
    raw.srfnrm("ELLIPSOID", "100101", 0, "AUDIT_GEOMETRY_FIXED", points),
    raw.limbpt("TANGENT/ELLIPSOID", ...cut).tangts,
    raw.termpt("UMBRAL/TANGENT/ELLIPSOID", "100103", ...cut).trmvcs,
  ];
}
