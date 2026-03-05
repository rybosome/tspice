/* eslint-disable */
// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/registry/functions.registry.yml

export type FunctionArgKind =
  | "cellOrWindowRef"
  | "cellRef"
  | "dasHandleRef"
  | "dlaDescriptorRef"
  | "expr"
  | "intExpr"
  | "pathExpr"
;

export type FunctionResultMode =
  | "asDskDescriptor"
  | "asSpiceInt"
  | "forbidden"
  | "outNamedDskb02"
  | "return"
;

export type FunctionInvokeKind = "backendMethod" | "spice";

export type FunctionRegistryEntry = {
  id: string;
  aliases: readonly string[];
  impl: {
    contractMethod: string;
    cSymbol: string;
    invoke: FunctionInvokeKind;
  };
  arity: number;
  argKinds: readonly FunctionArgKind[];
  nonNegativeIntArgMask?: number;
  result: { mode: FunctionResultMode };
};

export const functionRegistry: readonly FunctionRegistryEntry[] = [
  {
    id: "cells-windows.card",
    aliases: ["card_c"],
    impl: {
      contractMethod: "cells-windows.card",
      cSymbol: "card_c",
      invoke: "spice",
    },
    arity: 1,
    argKinds: ["cellOrWindowRef"],
    result: { mode: "asSpiceInt" },
  },
  {
    id: "cells-windows.insrtc",
    aliases: ["insrtc_c"],
    impl: {
      contractMethod: "cells-windows.insrtc",
      cSymbol: "insrtc_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "cells-windows.insrtd",
    aliases: ["insrtd_c"],
    impl: {
      contractMethod: "cells-windows.insrtd",
      cSymbol: "insrtd_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "cells-windows.insrti",
    aliases: ["insrti_c"],
    impl: {
      contractMethod: "cells-windows.insrti",
      cSymbol: "insrti_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "cells-windows.scard",
    aliases: ["scard_c"],
    impl: {
      contractMethod: "cells-windows.scard",
      cSymbol: "scard_c",
      invoke: "spice",
    },
    arity: 2,
    argKinds: ["intExpr","cellOrWindowRef"],
    nonNegativeIntArgMask: 1,
    result: { mode: "forbidden" },
  },
  {
    id: "cells-windows.size",
    aliases: ["size_c"],
    impl: {
      contractMethod: "cells-windows.size",
      cSymbol: "size_c",
      invoke: "spice",
    },
    arity: 1,
    argKinds: ["cellOrWindowRef"],
    result: { mode: "asSpiceInt" },
  },
  {
    id: "cells-windows.ssize",
    aliases: ["ssize_c"],
    impl: {
      contractMethod: "cells-windows.ssize",
      cSymbol: "ssize_c",
      invoke: "spice",
    },
    arity: 2,
    argKinds: ["intExpr","cellOrWindowRef"],
    nonNegativeIntArgMask: 1,
    result: { mode: "forbidden" },
  },
  {
    id: "cells-windows.valid",
    aliases: ["valid_c"],
    impl: {
      contractMethod: "cells-windows.valid",
      cSymbol: "valid_c",
      invoke: "spice",
    },
    arity: 3,
    argKinds: ["intExpr","intExpr","cellOrWindowRef"],
    nonNegativeIntArgMask: 3,
    result: { mode: "forbidden" },
  },
  {
    id: "cells-windows.wncard",
    aliases: ["wncard_c"],
    impl: {
      contractMethod: "cells-windows.wncard",
      cSymbol: "wncard_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "cells-windows.wnfetd",
    aliases: ["wnfetd_c"],
    impl: {
      contractMethod: "cells-windows.wnfetd",
      cSymbol: "wnfetd_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "cells-windows.wninsd",
    aliases: ["wninsd_c"],
    impl: {
      contractMethod: "cells-windows.wninsd",
      cSymbol: "wninsd_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "cells-windows.wnvald",
    aliases: ["wnvald_c"],
    impl: {
      contractMethod: "cells-windows.wnvald",
      cSymbol: "wnvald_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.axisar",
    aliases: ["axisar_c"],
    impl: {
      contractMethod: "coords-vectors.axisar",
      cSymbol: "axisar_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.georec",
    aliases: ["georec_c"],
    impl: {
      contractMethod: "coords-vectors.georec",
      cSymbol: "georec_c",
      invoke: "backendMethod",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.latrec",
    aliases: ["latrec_c"],
    impl: {
      contractMethod: "coords-vectors.latrec",
      cSymbol: "latrec_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.mtxv",
    aliases: ["mtxv_c"],
    impl: {
      contractMethod: "coords-vectors.mtxv",
      cSymbol: "mtxv_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.mxm",
    aliases: ["mxm_c"],
    impl: {
      contractMethod: "coords-vectors.mxm",
      cSymbol: "mxm_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.mxv",
    aliases: ["mxv_c"],
    impl: {
      contractMethod: "coords-vectors.mxv",
      cSymbol: "mxv_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.recgeo",
    aliases: ["recgeo_c"],
    impl: {
      contractMethod: "coords-vectors.recgeo",
      cSymbol: "recgeo_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.reclat",
    aliases: ["reclat_c"],
    impl: {
      contractMethod: "coords-vectors.reclat",
      cSymbol: "reclat_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.recsph",
    aliases: ["recsph_c"],
    impl: {
      contractMethod: "coords-vectors.recsph",
      cSymbol: "recsph_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.rotate",
    aliases: ["rotate_c"],
    impl: {
      contractMethod: "coords-vectors.rotate",
      cSymbol: "rotate_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.rotmat",
    aliases: ["rotmat_c"],
    impl: {
      contractMethod: "coords-vectors.rotmat",
      cSymbol: "rotmat_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.sphrec",
    aliases: ["sphrec_c"],
    impl: {
      contractMethod: "coords-vectors.sphrec",
      cSymbol: "sphrec_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vadd",
    aliases: ["vadd_c"],
    impl: {
      contractMethod: "coords-vectors.vadd",
      cSymbol: "vadd_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vcrss",
    aliases: ["vcrss_c"],
    impl: {
      contractMethod: "coords-vectors.vcrss",
      cSymbol: "vcrss_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vdot",
    aliases: ["vdot_c"],
    impl: {
      contractMethod: "coords-vectors.vdot",
      cSymbol: "vdot_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vhat",
    aliases: ["vhat_c"],
    impl: {
      contractMethod: "coords-vectors.vhat",
      cSymbol: "vhat_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vminus",
    aliases: ["vminus_c"],
    impl: {
      contractMethod: "coords-vectors.vminus",
      cSymbol: "vminus_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vnorm",
    aliases: ["vnorm_c"],
    impl: {
      contractMethod: "coords-vectors.vnorm",
      cSymbol: "vnorm_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vscl",
    aliases: ["vscl_c"],
    impl: {
      contractMethod: "coords-vectors.vscl",
      cSymbol: "vscl_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "coords-vectors.vsub",
    aliases: ["vsub_c"],
    impl: {
      contractMethod: "coords-vectors.vsub",
      cSymbol: "vsub_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "dsk.dskb02",
    aliases: ["dskb02_c"],
    impl: {
      contractMethod: "dsk.dskb02",
      cSymbol: "dskb02_c",
      invoke: "spice",
    },
    arity: 2,
    argKinds: ["dasHandleRef","dlaDescriptorRef"],
    result: { mode: "outNamedDskb02" },
  },
  {
    id: "dsk.dskgd",
    aliases: ["dskgd_c"],
    impl: {
      contractMethod: "dsk.dskgd",
      cSymbol: "dskgd_c",
      invoke: "spice",
    },
    arity: 2,
    argKinds: ["dasHandleRef","dlaDescriptorRef"],
    result: { mode: "asDskDescriptor" },
  },
  {
    id: "dsk.dskobj",
    aliases: ["dskobj_c"],
    impl: {
      contractMethod: "dsk.dskobj",
      cSymbol: "dskobj_c",
      invoke: "spice",
    },
    arity: 2,
    argKinds: ["pathExpr","cellRef"],
    result: { mode: "forbidden" },
  },
  {
    id: "dsk.dsksrf",
    aliases: ["dsksrf_c"],
    impl: {
      contractMethod: "dsk.dsksrf",
      cSymbol: "dsksrf_c",
      invoke: "spice",
    },
    arity: 3,
    argKinds: ["pathExpr","intExpr","cellRef"],
    result: { mode: "forbidden" },
  },
  {
    id: "ephemeris.spkez",
    aliases: ["spkez_c"],
    impl: {
      contractMethod: "ephemeris.spkez",
      cSymbol: "spkez_c",
      invoke: "backendMethod",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spkezp",
    aliases: ["spkezp_c"],
    impl: {
      contractMethod: "ephemeris.spkezp",
      cSymbol: "spkezp_c",
      invoke: "backendMethod",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spkezr",
    aliases: ["spkezr_c"],
    impl: {
      contractMethod: "ephemeris.spkezr",
      cSymbol: "spkezr_c",
      invoke: "backendMethod",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spkgeo",
    aliases: ["spkgeo_c"],
    impl: {
      contractMethod: "ephemeris.spkgeo",
      cSymbol: "spkgeo_c",
      invoke: "backendMethod",
    },
    arity: 4,
    argKinds: ["expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spkgps",
    aliases: ["spkgps_c"],
    impl: {
      contractMethod: "ephemeris.spkgps",
      cSymbol: "spkgps_c",
      invoke: "backendMethod",
    },
    arity: 4,
    argKinds: ["expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spkpds",
    aliases: ["spkpds_c"],
    impl: {
      contractMethod: "ephemeris.spkpds",
      cSymbol: "spkpds_c",
      invoke: "backendMethod",
    },
    arity: 6,
    argKinds: ["expr","expr","expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spkpos",
    aliases: ["spkpos_c"],
    impl: {
      contractMethod: "ephemeris.spkpos",
      cSymbol: "spkpos_c",
      invoke: "backendMethod",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spksfs",
    aliases: ["spksfs_c"],
    impl: {
      contractMethod: "ephemeris.spksfs",
      cSymbol: "spksfs_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ephemeris.spkssb",
    aliases: ["spkssb_c"],
    impl: {
      contractMethod: "ephemeris.spkssb",
      cSymbol: "spkssb_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dafbfs",
    aliases: ["dafbfs_c"],
    impl: {
      contractMethod: "file-io.dafbfs",
      cSymbol: "dafbfs_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dafcls",
    aliases: ["dafcls_c"],
    impl: {
      contractMethod: "file-io.dafcls",
      cSymbol: "dafcls_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.daffna",
    aliases: ["daffna_c"],
    impl: {
      contractMethod: "file-io.daffna",
      cSymbol: "daffna_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dafopr",
    aliases: ["dafopr_c"],
    impl: {
      contractMethod: "file-io.dafopr",
      cSymbol: "dafopr_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dascls",
    aliases: ["dascls_c"],
    impl: {
      contractMethod: "file-io.dascls",
      cSymbol: "dascls_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dasopr",
    aliases: ["dasopr_c"],
    impl: {
      contractMethod: "file-io.dasopr",
      cSymbol: "dasopr_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dlabfs",
    aliases: ["dlabfs_c"],
    impl: {
      contractMethod: "file-io.dlabfs",
      cSymbol: "dlabfs_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dlacls",
    aliases: ["dlacls_c"],
    impl: {
      contractMethod: "file-io.dlacls",
      cSymbol: "dascls_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dlafns",
    aliases: ["dlafns_c"],
    impl: {
      contractMethod: "file-io.dlafns",
      cSymbol: "dlafns_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dlaopn",
    aliases: ["dlaopn_c"],
    impl: {
      contractMethod: "file-io.dlaopn",
      cSymbol: "dlaopn_c",
      invoke: "backendMethod",
    },
    arity: 4,
    argKinds: ["expr","expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.dskmi2",
    aliases: ["dskmi2_c"],
    impl: {
      contractMethod: "file-io.dskmi2",
      cSymbol: "dskmi2_c",
      invoke: "spice",
    },
    arity: 0,
    argKinds: [],
    result: { mode: "forbidden" },
  },
  {
    id: "file-io.dskopn",
    aliases: ["dskopn_c"],
    impl: {
      contractMethod: "file-io.dskopn",
      cSymbol: "dskopn_c",
      invoke: "spice",
    },
    arity: 0,
    argKinds: [],
    result: { mode: "forbidden" },
  },
  {
    id: "file-io.dskw02",
    aliases: ["dskw02_c"],
    impl: {
      contractMethod: "file-io.dskw02",
      cSymbol: "dskw02_c",
      invoke: "spice",
    },
    arity: 0,
    argKinds: [],
    result: { mode: "forbidden" },
  },
  {
    id: "file-io.exists",
    aliases: ["exists_c"],
    impl: {
      contractMethod: "file-io.exists",
      cSymbol: "exists_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "file-io.getfat",
    aliases: ["getfat_c"],
    impl: {
      contractMethod: "file-io.getfat",
      cSymbol: "getfat_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.ccifrm",
    aliases: ["ccifrm_c"],
    impl: {
      contractMethod: "frames.ccifrm",
      cSymbol: "ccifrm_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.cidfrm",
    aliases: ["cidfrm_c"],
    impl: {
      contractMethod: "frames.cidfrm",
      cSymbol: "cidfrm_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.cnmfrm",
    aliases: ["cnmfrm_c"],
    impl: {
      contractMethod: "frames.cnmfrm",
      cSymbol: "cnmfrm_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.frinfo",
    aliases: ["frinfo_c"],
    impl: {
      contractMethod: "frames.frinfo",
      cSymbol: "frinfo_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.frmnam",
    aliases: ["frmnam_c"],
    impl: {
      contractMethod: "frames.frmnam",
      cSymbol: "frmnam_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.namfrm",
    aliases: ["namfrm_c"],
    impl: {
      contractMethod: "frames.namfrm",
      cSymbol: "namfrm_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.pxform",
    aliases: ["pxform_c"],
    impl: {
      contractMethod: "frames.pxform",
      cSymbol: "pxform_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "frames.sxform",
    aliases: ["sxform_c"],
    impl: {
      contractMethod: "frames.sxform",
      cSymbol: "sxform_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ids-names.bodc2n",
    aliases: ["bodc2n_c"],
    impl: {
      contractMethod: "ids-names.bodc2n",
      cSymbol: "bodc2n_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "ids-names.bodc2s",
    aliases: ["bodc2s_c"],
    impl: {
      contractMethod: "ids-names.bodc2s",
      cSymbol: "bodc2s_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "ids-names.boddef",
    aliases: ["boddef_c"],
    impl: {
      contractMethod: "ids-names.boddef",
      cSymbol: "boddef_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ids-names.bodfnd",
    aliases: ["bodfnd_c"],
    impl: {
      contractMethod: "ids-names.bodfnd",
      cSymbol: "bodfnd_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "ids-names.bodn2c",
    aliases: ["bodn2c_c"],
    impl: {
      contractMethod: "ids-names.bodn2c",
      cSymbol: "bodn2c_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "ids-names.bods2c",
    aliases: ["bods2c_c"],
    impl: {
      contractMethod: "ids-names.bods2c",
      cSymbol: "bods2c_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "ids-names.bodvar",
    aliases: ["bodvar_c","bodvcd_c"],
    impl: {
      contractMethod: "ids-names.bodvar",
      cSymbol: "bodvcd_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.cvpool",
    aliases: ["cvpool_c"],
    impl: {
      contractMethod: "kernel-pool.cvpool",
      cSymbol: "cvpool_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.dtpool",
    aliases: ["dtpool_c"],
    impl: {
      contractMethod: "kernel-pool.dtpool",
      cSymbol: "dtpool_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.expool",
    aliases: ["expool_c"],
    impl: {
      contractMethod: "kernel-pool.expool",
      cSymbol: "expool_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.gcpool",
    aliases: ["gcpool_c"],
    impl: {
      contractMethod: "kernel-pool.gcpool",
      cSymbol: "gcpool_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.gdpool",
    aliases: ["gdpool_c"],
    impl: {
      contractMethod: "kernel-pool.gdpool",
      cSymbol: "gdpool_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.gipool",
    aliases: ["gipool_c"],
    impl: {
      contractMethod: "kernel-pool.gipool",
      cSymbol: "gipool_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.gnpool",
    aliases: ["gnpool_c"],
    impl: {
      contractMethod: "kernel-pool.gnpool",
      cSymbol: "gnpool_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.pcpool",
    aliases: ["pcpool_c"],
    impl: {
      contractMethod: "kernel-pool.pcpool",
      cSymbol: "pcpool_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.pdpool",
    aliases: ["pdpool_c"],
    impl: {
      contractMethod: "kernel-pool.pdpool",
      cSymbol: "pdpool_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.pipool",
    aliases: ["pipool_c"],
    impl: {
      contractMethod: "kernel-pool.pipool",
      cSymbol: "pipool_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernel-pool.swpool",
    aliases: ["swpool_c"],
    impl: {
      contractMethod: "kernel-pool.swpool",
      cSymbol: "swpool_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernels.furnsh",
    aliases: ["furnsh_c"],
    impl: {
      contractMethod: "kernels.furnsh",
      cSymbol: "furnsh_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "kernels.kclear",
    aliases: ["kclear_c"],
    impl: {
      contractMethod: "kernels.kclear",
      cSymbol: "kclear_c",
      invoke: "backendMethod",
    },
    arity: 0,
    argKinds: [],
    result: { mode: "return" },
  },
  {
    id: "kernels.kdata",
    aliases: ["kdata_c"],
    impl: {
      contractMethod: "kernels.kdata",
      cSymbol: "kdata_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernels.kinfo",
    aliases: ["kinfo_c"],
    impl: {
      contractMethod: "kernels.kinfo",
      cSymbol: "kinfo_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "kernels.kplfrm",
    aliases: ["kplfrm_c"],
    impl: {
      contractMethod: "kernels.kplfrm",
      cSymbol: "kplfrm_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "kernels.ktotal",
    aliases: ["ktotal_c"],
    impl: {
      contractMethod: "kernels.ktotal",
      cSymbol: "ktotal_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "kernels.kxtrct",
    aliases: ["kxtrct_c"],
    impl: {
      contractMethod: "kernels.kxtrct",
      cSymbol: "kxtrct_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "kernels.unload",
    aliases: ["unload_c"],
    impl: {
      contractMethod: "kernels.unload",
      cSymbol: "unload_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "time.deltet",
    aliases: ["deltet_c"],
    impl: {
      contractMethod: "time.deltet",
      cSymbol: "deltet_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "time.et2utc",
    aliases: ["et2utc_c"],
    impl: {
      contractMethod: "time.et2utc",
      cSymbol: "et2utc_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "time.str2et",
    aliases: ["str2et_c"],
    impl: {
      contractMethod: "time.str2et",
      cSymbol: "str2et_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "time.timdef",
    aliases: ["timdef_c"],
    impl: {
      contractMethod: "time.timdef",
      cSymbol: "timdef_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "time.timout",
    aliases: ["timout_c"],
    impl: {
      contractMethod: "time.timout",
      cSymbol: "timout_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "time.tkvrsn",
    aliases: ["tkvrsn_c"],
    impl: {
      contractMethod: "time.tkvrsn",
      cSymbol: "tkvrsn_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "time.tparse",
    aliases: ["tparse_c"],
    impl: {
      contractMethod: "time.tparse",
      cSymbol: "tparse_c",
      invoke: "backendMethod",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return" },
  },
  {
    id: "time.tpictr",
    aliases: ["tpictr_c"],
    impl: {
      contractMethod: "time.tpictr",
      cSymbol: "tpictr_c",
      invoke: "backendMethod",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return" },
  },
  {
    id: "time.unitim",
    aliases: ["unitim_c"],
    impl: {
      contractMethod: "time.unitim",
      cSymbol: "unitim_c",
      invoke: "backendMethod",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return" },
  },
];

const functionRegistryByName = new Map<string, FunctionRegistryEntry>();
for (const entry of functionRegistry) {
  functionRegistryByName.set(entry.id, entry);
  for (const alias of entry.aliases) {
    functionRegistryByName.set(alias, entry);
  }
}

export function lookupFunctionRegistryEntry(fn: string): FunctionRegistryEntry | undefined {
  return functionRegistryByName.get(fn);
}

