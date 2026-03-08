/* eslint-disable */
// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/catalogs/spice-function-registry.v2.yml

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

export type FunctionResultDelivery =
  | "none"
  | "outArg"
  | "returnValue"
;

export type OutputBindingPolicy =
  | "forbidden"
;

export type FunctionRegistryEntry = {
  id: string;
  impl: {
    contractMethod: string;
    cSymbol: string;
    nativeInvoker: string;
    returnBinding?: {
      kind:
        | "exprSpiceIntToJsonStringViaSizedOutBuffer"
        | "exprStringToJsonString"
        | "generatedReturnBindingLane"
      ;
    };
  };
  arity: number;
  argKinds: readonly FunctionArgKind[];
  nonNegativeIntArgMask?: number;
  result: {
    mode: FunctionResultMode;
    delivery: FunctionResultDelivery;
    outputBindingPolicy?: OutputBindingPolicy;
  };
};

export const functionRegistry: readonly FunctionRegistryEntry[] = [
  {
    id: "cells-windows.card",
    impl: {
      contractMethod: "cells-windows.card",
      cSymbol: "card_c",
      nativeInvoker: "v2_invoke_contract_as_spice_int",
    },
    arity: 1,
    argKinds: ["cellOrWindowRef"],
    result: { mode: "asSpiceInt", delivery: "outArg" },
  },
  {
    id: "cells-windows.insrtc",
    impl: {
      contractMethod: "cells-windows.insrtc",
      cSymbol: "insrtc_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "cells-windows.insrtd",
    impl: {
      contractMethod: "cells-windows.insrtd",
      cSymbol: "insrtd_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "cells-windows.insrti",
    impl: {
      contractMethod: "cells-windows.insrti",
      cSymbol: "insrti_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "cells-windows.scard",
    impl: {
      contractMethod: "cells-windows.scard",
      cSymbol: "scard_c",
      nativeInvoker: "v2_invoke_contract_forbidden",
    },
    arity: 2,
    argKinds: ["intExpr","cellOrWindowRef"],
    nonNegativeIntArgMask: 1,
    result: {
      mode: "forbidden",
      delivery: "none",
      outputBindingPolicy: "forbidden",
    },
  },
  {
    id: "cells-windows.size",
    impl: {
      contractMethod: "cells-windows.size",
      cSymbol: "size_c",
      nativeInvoker: "v2_invoke_contract_as_spice_int",
    },
    arity: 1,
    argKinds: ["cellOrWindowRef"],
    result: { mode: "asSpiceInt", delivery: "outArg" },
  },
  {
    id: "cells-windows.ssize",
    impl: {
      contractMethod: "cells-windows.ssize",
      cSymbol: "ssize_c",
      nativeInvoker: "v2_invoke_contract_forbidden",
    },
    arity: 2,
    argKinds: ["intExpr","cellOrWindowRef"],
    nonNegativeIntArgMask: 1,
    result: {
      mode: "forbidden",
      delivery: "none",
      outputBindingPolicy: "forbidden",
    },
  },
  {
    id: "cells-windows.valid",
    impl: {
      contractMethod: "cells-windows.valid",
      cSymbol: "valid_c",
      nativeInvoker: "v2_invoke_contract_forbidden",
    },
    arity: 3,
    argKinds: ["intExpr","intExpr","cellOrWindowRef"],
    nonNegativeIntArgMask: 3,
    result: {
      mode: "forbidden",
      delivery: "none",
      outputBindingPolicy: "forbidden",
    },
  },
  {
    id: "cells-windows.wncard",
    impl: {
      contractMethod: "cells-windows.wncard",
      cSymbol: "wncard_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "cells-windows.wnfetd",
    impl: {
      contractMethod: "cells-windows.wnfetd",
      cSymbol: "wnfetd_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "cells-windows.wninsd",
    impl: {
      contractMethod: "cells-windows.wninsd",
      cSymbol: "wninsd_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "cells-windows.wnvald",
    impl: {
      contractMethod: "cells-windows.wnvald",
      cSymbol: "wnvald_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.axisar",
    impl: {
      contractMethod: "coords-vectors.axisar",
      cSymbol: "axisar_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.georec",
    impl: {
      contractMethod: "coords-vectors.georec",
      cSymbol: "georec_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.latrec",
    impl: {
      contractMethod: "coords-vectors.latrec",
      cSymbol: "latrec_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.mtxv",
    impl: {
      contractMethod: "coords-vectors.mtxv",
      cSymbol: "mtxv_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.mxm",
    impl: {
      contractMethod: "coords-vectors.mxm",
      cSymbol: "mxm_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.mxv",
    impl: {
      contractMethod: "coords-vectors.mxv",
      cSymbol: "mxv_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.recgeo",
    impl: {
      contractMethod: "coords-vectors.recgeo",
      cSymbol: "recgeo_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.reclat",
    impl: {
      contractMethod: "coords-vectors.reclat",
      cSymbol: "reclat_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.recsph",
    impl: {
      contractMethod: "coords-vectors.recsph",
      cSymbol: "recsph_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.rotate",
    impl: {
      contractMethod: "coords-vectors.rotate",
      cSymbol: "rotate_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.rotmat",
    impl: {
      contractMethod: "coords-vectors.rotmat",
      cSymbol: "rotmat_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.sphrec",
    impl: {
      contractMethod: "coords-vectors.sphrec",
      cSymbol: "sphrec_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vadd",
    impl: {
      contractMethod: "coords-vectors.vadd",
      cSymbol: "vadd_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vcrss",
    impl: {
      contractMethod: "coords-vectors.vcrss",
      cSymbol: "vcrss_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vdot",
    impl: {
      contractMethod: "coords-vectors.vdot",
      cSymbol: "vdot_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vhat",
    impl: {
      contractMethod: "coords-vectors.vhat",
      cSymbol: "vhat_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vminus",
    impl: {
      contractMethod: "coords-vectors.vminus",
      cSymbol: "vminus_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vnorm",
    impl: {
      contractMethod: "coords-vectors.vnorm",
      cSymbol: "vnorm_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vscl",
    impl: {
      contractMethod: "coords-vectors.vscl",
      cSymbol: "vscl_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "coords-vectors.vsub",
    impl: {
      contractMethod: "coords-vectors.vsub",
      cSymbol: "vsub_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "dsk.dskb02",
    impl: {
      contractMethod: "dsk.dskb02",
      cSymbol: "dskb02_c",
      nativeInvoker: "v2_invoke_sig_das_handle_ref_dla_descriptor_ref_to_out_named_dskb02",
    },
    arity: 2,
    argKinds: ["dasHandleRef","dlaDescriptorRef"],
    result: { mode: "outNamedDskb02", delivery: "outArg" },
  },
  {
    id: "dsk.dskgd",
    impl: {
      contractMethod: "dsk.dskgd",
      cSymbol: "dskgd_c",
      nativeInvoker: "v2_invoke_sig_das_handle_ref_dla_descriptor_ref_to_as_dsk_descriptor",
    },
    arity: 2,
    argKinds: ["dasHandleRef","dlaDescriptorRef"],
    result: { mode: "asDskDescriptor", delivery: "outArg" },
  },
  {
    id: "dsk.dskobj",
    impl: {
      contractMethod: "dsk.dskobj",
      cSymbol: "dskobj_c",
      nativeInvoker: "v2_invoke_contract_forbidden",
    },
    arity: 2,
    argKinds: ["pathExpr","cellRef"],
    result: {
      mode: "forbidden",
      delivery: "none",
      outputBindingPolicy: "forbidden",
    },
  },
  {
    id: "dsk.dsksrf",
    impl: {
      contractMethod: "dsk.dsksrf",
      cSymbol: "dsksrf_c",
      nativeInvoker: "v2_invoke_contract_forbidden",
    },
    arity: 3,
    argKinds: ["pathExpr","intExpr","cellRef"],
    result: {
      mode: "forbidden",
      delivery: "none",
      outputBindingPolicy: "forbidden",
    },
  },
  {
    id: "ephemeris.spkez",
    impl: {
      contractMethod: "ephemeris.spkez",
      cSymbol: "spkez_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spkezp",
    impl: {
      contractMethod: "ephemeris.spkezp",
      cSymbol: "spkezp_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spkezr",
    impl: {
      contractMethod: "ephemeris.spkezr",
      cSymbol: "spkezr_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spkgeo",
    impl: {
      contractMethod: "ephemeris.spkgeo",
      cSymbol: "spkgeo_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 4,
    argKinds: ["expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spkgps",
    impl: {
      contractMethod: "ephemeris.spkgps",
      cSymbol: "spkgps_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 4,
    argKinds: ["expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spkpds",
    impl: {
      contractMethod: "ephemeris.spkpds",
      cSymbol: "spkpds_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 6,
    argKinds: ["expr","expr","expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spkpos",
    impl: {
      contractMethod: "ephemeris.spkpos",
      cSymbol: "spkpos_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 5,
    argKinds: ["expr","expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spksfs",
    impl: {
      contractMethod: "ephemeris.spksfs",
      cSymbol: "spksfs_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ephemeris.spkssb",
    impl: {
      contractMethod: "ephemeris.spkssb",
      cSymbol: "spkssb_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dafbfs",
    impl: {
      contractMethod: "file-io.dafbfs",
      cSymbol: "dafbfs_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dafcls",
    impl: {
      contractMethod: "file-io.dafcls",
      cSymbol: "dafcls_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.daffna",
    impl: {
      contractMethod: "file-io.daffna",
      cSymbol: "daffna_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dafopr",
    impl: {
      contractMethod: "file-io.dafopr",
      cSymbol: "dafopr_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dascls",
    impl: {
      contractMethod: "file-io.dascls",
      cSymbol: "dascls_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dasopr",
    impl: {
      contractMethod: "file-io.dasopr",
      cSymbol: "dasopr_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dlabfs",
    impl: {
      contractMethod: "file-io.dlabfs",
      cSymbol: "dlabfs_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dlacls",
    impl: {
      contractMethod: "file-io.dlacls",
      cSymbol: "dlacls_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dlafns",
    impl: {
      contractMethod: "file-io.dlafns",
      cSymbol: "dlafns_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.dlaopn",
    impl: {
      contractMethod: "file-io.dlaopn",
      cSymbol: "dlaopn_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 4,
    argKinds: ["expr","expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.exists",
    impl: {
      contractMethod: "file-io.exists",
      cSymbol: "exists_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "file-io.getfat",
    impl: {
      contractMethod: "file-io.getfat",
      cSymbol: "getfat_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.ccifrm",
    impl: {
      contractMethod: "frames.ccifrm",
      cSymbol: "ccifrm_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.cidfrm",
    impl: {
      contractMethod: "frames.cidfrm",
      cSymbol: "cidfrm_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.cnmfrm",
    impl: {
      contractMethod: "frames.cnmfrm",
      cSymbol: "cnmfrm_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.frinfo",
    impl: {
      contractMethod: "frames.frinfo",
      cSymbol: "frinfo_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.frmnam",
    impl: {
      contractMethod: "frames.frmnam",
      cSymbol: "frmnam_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.namfrm",
    impl: {
      contractMethod: "frames.namfrm",
      cSymbol: "namfrm_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.pxform",
    impl: {
      contractMethod: "frames.pxform",
      cSymbol: "pxform_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "frames.sxform",
    impl: {
      contractMethod: "frames.sxform",
      cSymbol: "sxform_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ids-names.bodc2n",
    impl: {
      contractMethod: "ids-names.bodc2n",
      cSymbol: "bodc2n_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ids-names.bodc2s",
    impl: {
      contractMethod: "ids-names.bodc2s",
      cSymbol: "bodc2s_c",
      nativeInvoker: "v2_invoke_contract_return",
      returnBinding: {
        kind: "exprSpiceIntToJsonStringViaSizedOutBuffer",
      },
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ids-names.boddef",
    impl: {
      contractMethod: "ids-names.boddef",
      cSymbol: "boddef_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ids-names.bodfnd",
    impl: {
      contractMethod: "ids-names.bodfnd",
      cSymbol: "bodfnd_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ids-names.bodn2c",
    impl: {
      contractMethod: "ids-names.bodn2c",
      cSymbol: "bodn2c_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ids-names.bods2c",
    impl: {
      contractMethod: "ids-names.bods2c",
      cSymbol: "bods2c_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "ids-names.bodvar",
    impl: {
      contractMethod: "ids-names.bodvar",
      cSymbol: "bodvcd_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.cvpool",
    impl: {
      contractMethod: "kernel-pool.cvpool",
      cSymbol: "cvpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.dtpool",
    impl: {
      contractMethod: "kernel-pool.dtpool",
      cSymbol: "dtpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.expool",
    impl: {
      contractMethod: "kernel-pool.expool",
      cSymbol: "expool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.gcpool",
    impl: {
      contractMethod: "kernel-pool.gcpool",
      cSymbol: "gcpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.gdpool",
    impl: {
      contractMethod: "kernel-pool.gdpool",
      cSymbol: "gdpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.gipool",
    impl: {
      contractMethod: "kernel-pool.gipool",
      cSymbol: "gipool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.gnpool",
    impl: {
      contractMethod: "kernel-pool.gnpool",
      cSymbol: "gnpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.pcpool",
    impl: {
      contractMethod: "kernel-pool.pcpool",
      cSymbol: "pcpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.pdpool",
    impl: {
      contractMethod: "kernel-pool.pdpool",
      cSymbol: "pdpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.pipool",
    impl: {
      contractMethod: "kernel-pool.pipool",
      cSymbol: "pipool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernel-pool.swpool",
    impl: {
      contractMethod: "kernel-pool.swpool",
      cSymbol: "swpool_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.furnsh",
    impl: {
      contractMethod: "kernels.furnsh",
      cSymbol: "furnsh_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.kclear",
    impl: {
      contractMethod: "kernels.kclear",
      cSymbol: "kclear_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 0,
    argKinds: [],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.kdata",
    impl: {
      contractMethod: "kernels.kdata",
      cSymbol: "kdata_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.kinfo",
    impl: {
      contractMethod: "kernels.kinfo",
      cSymbol: "kinfo_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.kplfrm",
    impl: {
      contractMethod: "kernels.kplfrm",
      cSymbol: "kplfrm_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.ktotal",
    impl: {
      contractMethod: "kernels.ktotal",
      cSymbol: "ktotal_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.kxtrct",
    impl: {
      contractMethod: "kernels.kxtrct",
      cSymbol: "kxtrct_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "kernels.unload",
    impl: {
      contractMethod: "kernels.unload",
      cSymbol: "unload_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.deltet",
    impl: {
      contractMethod: "time.deltet",
      cSymbol: "deltet_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.et2utc",
    impl: {
      contractMethod: "time.et2utc",
      cSymbol: "et2utc_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.str2et",
    impl: {
      contractMethod: "time.str2et",
      cSymbol: "str2et_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.timdef",
    impl: {
      contractMethod: "time.timdef",
      cSymbol: "timdef_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.timout",
    impl: {
      contractMethod: "time.timout",
      cSymbol: "timout_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.tkvrsn",
    impl: {
      contractMethod: "time.tkvrsn",
      cSymbol: "tkvrsn_c",
      nativeInvoker: "v2_invoke_contract_return",
      returnBinding: {
        kind: "exprStringToJsonString",
      },
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.tparse",
    impl: {
      contractMethod: "time.tparse",
      cSymbol: "tparse_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 1,
    argKinds: ["expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.tpictr",
    impl: {
      contractMethod: "time.tpictr",
      cSymbol: "tpictr_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 2,
    argKinds: ["expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
  {
    id: "time.unitim",
    impl: {
      contractMethod: "time.unitim",
      cSymbol: "unitim_c",
      nativeInvoker: "v2_invoke_contract_return",
    },
    arity: 3,
    argKinds: ["expr","expr","expr"],
    result: { mode: "return", delivery: "returnValue" },
  },
];

const functionRegistryByName = new Map<string, FunctionRegistryEntry>();
for (const entry of functionRegistry) {
  functionRegistryByName.set(entry.id, entry);
}

export function lookupFunctionRegistryEntry(fn: string): FunctionRegistryEntry | undefined {
  return functionRegistryByName.get(fn);
}

