#include "cspice_runner_call_registry.h"

typedef struct {
  const char *name;
  CallId id;
} CallDispatchEntry;

CallId parse_call_id(const char *call) {
  static const CallDispatchEntry table[] = {
      {"time.str2et", CALL_TIME_STR2ET},
      {"str2et", CALL_TIME_STR2ET},
      {"time.et2utc", CALL_TIME_ET2UTC},
      {"et2utc", CALL_TIME_ET2UTC},

      // time (misc)
      {"time.spiceVersion", CALL_TIME_SPICE_VERSION},
      {"time.tkvrsn", CALL_TIME_TKVRSN},
      {"time.timout", CALL_TIME_TIMOUT},
      {"time.deltet", CALL_TIME_DELTET},
      {"time.unitim", CALL_TIME_UNITIM},
      {"time.tparse", CALL_TIME_TPARSE},
      {"time.tpictr", CALL_TIME_TPICTR},
      {"time.timdef", CALL_TIME_TIMDEF},

      // ids-names
      {"ids-names.bodn2c", CALL_BODN2C},
      {"bodn2c", CALL_BODN2C},
      {"ids-names.bodc2n", CALL_BODC2N},
      {"bodc2n", CALL_BODC2N},
      {"ids-names.bodc2s", CALL_BODC2S},
      {"bodc2s", CALL_BODC2S},
      {"ids-names.bods2c", CALL_BODS2C},
      {"bods2c", CALL_BODS2C},
      {"ids-names.boddef", CALL_BODDEF},
      {"boddef", CALL_BODDEF},
      {"ids-names.bodfnd", CALL_BODFND},
      {"bodfnd", CALL_BODFND},
      {"ids-names.bodvar", CALL_BODVAR},
      {"bodvar", CALL_BODVAR},

      // frames
      {"frames.namfrm", CALL_NAMFRM},
      {"namfrm", CALL_NAMFRM},
      {"frames.frmnam", CALL_FRMNAM},
      {"frmnam", CALL_FRMNAM},
      {"frames.cidfrm", CALL_CIDFRM},
      {"cidfrm", CALL_CIDFRM},
      {"frames.cnmfrm", CALL_CNMFRM},
      {"cnmfrm", CALL_CNMFRM},
      {"frames.frinfo", CALL_FRINFO},
      {"frinfo", CALL_FRINFO},
      {"frames.ccifrm", CALL_CCIFRM},
      {"ccifrm", CALL_CCIFRM},
      {"frames.pxform", CALL_PXFORM},
      {"pxform", CALL_PXFORM},
      {"frames.sxform", CALL_SXFORM},
      {"sxform", CALL_SXFORM},

      // coords-vectors
      {"coords-vectors.axisar", CALL_AXISAR},
      {"coords-vectors.georec", CALL_GEOREC},
      {"coords-vectors.latrec", CALL_LATREC},
      {"coords-vectors.mtxv", CALL_MTXV},
      {"coords-vectors.mxm", CALL_MXM},
      {"coords-vectors.mxv", CALL_MXV},
      {"coords-vectors.recgeo", CALL_RECGEO},
      {"coords-vectors.reclat", CALL_RECLAT},
      {"coords-vectors.recsph", CALL_RECSPH},
      {"coords-vectors.rotate", CALL_ROTATE},
      {"coords-vectors.rotmat", CALL_ROTMAT},
      {"coords-vectors.sphrec", CALL_SPHREC},
      {"coords-vectors.vadd", CALL_VADD},
      {"coords-vectors.vcrss", CALL_VCRSS},
      {"coords-vectors.vdot", CALL_VDOT},
      {"coords-vectors.vhat", CALL_VHAT},
      {"coords-vectors.vminus", CALL_VMINUS},
      {"coords-vectors.vnorm", CALL_VNORM},
      {"coords-vectors.vscl", CALL_VSCL},
      {"coords-vectors.vsub", CALL_VSUB},

      // ephemeris
      {"ephemeris.spkezr", CALL_SPKEZR},
      {"ephemeris.spkpos", CALL_SPKPOS},
      {"ephemeris.spkez", CALL_SPKEZ},
      {"ephemeris.spkezp", CALL_SPKEZP},
      {"ephemeris.spkgeo", CALL_SPKGEO},
      {"ephemeris.spkgps", CALL_SPKGPS},
      {"ephemeris.spkssb", CALL_SPKSSB},
      {"ephemeris.spkpds", CALL_SPKPDS},
      {"ephemeris.spkuds", CALL_SPKUDS},
      {"ephemeris.spksfs", CALL_SPKSFS},

      // file-io
      {"file-io.exists", CALL_FILE_IO_EXISTS},
      {"file-io.getfat", CALL_FILE_IO_GETFAT},
      {"file-io.dafopr", CALL_FILE_IO_DAFOPR},
      {"file-io.dafcls", CALL_FILE_IO_DAFCLS},
      {"file-io.dafbfs", CALL_FILE_IO_DAFBFS},
      {"file-io.daffna", CALL_FILE_IO_DAFFNA},
      {"file-io.dasopr", CALL_FILE_IO_DASOPR},
      {"file-io.dascls", CALL_FILE_IO_DASCLS},
      {"file-io.dlaopn", CALL_FILE_IO_DLAOPN},
      {"file-io.dlabfs", CALL_FILE_IO_DLABFS},
      {"file-io.dlafns", CALL_FILE_IO_DLAFNS},
      {"file-io.dlacls", CALL_FILE_IO_DLACLS},



      // kernels
      {"kernels.furnsh", CALL_KERNELS_FURNSH},
      {"kernels.unload", CALL_KERNELS_UNLOAD},
      {"kernels.kclear", CALL_KERNELS_KCLEAR},
      {"kernels.ktotal", CALL_KERNELS_KTOTAL},
      {"kernels.kdata", CALL_KERNELS_KDATA},
      {"kernels.kinfo", CALL_KERNELS_KINFO},
      {"kernels.kxtrct", CALL_KERNELS_KXTRCT},
      {"kernels.kplfrm", CALL_KERNELS_KPLFRM},

      // cells-windows
      {"cells-windows.insrti", CALL_CELLS_WINDOWS_INSRTI},
      {"cells-windows.insrtd", CALL_CELLS_WINDOWS_INSRTD},
      {"cells-windows.insrtc", CALL_CELLS_WINDOWS_INSRTC},
      {"cells-windows.cellGeti", CALL_CELLS_WINDOWS_CELL_GETI},
      {"cells-windows.cellGetd", CALL_CELLS_WINDOWS_CELL_GETD},
      {"cells-windows.cellGetc", CALL_CELLS_WINDOWS_CELL_GETC},
      {"cells-windows.wninsd", CALL_CELLS_WINDOWS_WNINSD},
      {"cells-windows.wncard", CALL_CELLS_WINDOWS_WNCARD},
      {"cells-windows.wnfetd", CALL_CELLS_WINDOWS_WNFETD},
      {"cells-windows.wnvald", CALL_CELLS_WINDOWS_WNVALD},

      // kernel-pool
      {"kernel-pool.gdpool", CALL_GDPOOL},
      {"kernel-pool.gipool", CALL_GIPOOL},
      {"kernel-pool.gcpool", CALL_GCPOOL},
      {"kernel-pool.gnpool", CALL_GNPOOL},
      {"kernel-pool.dtpool", CALL_DTPOOL},
      {"kernel-pool.pdpool", CALL_PDPOOL},
      {"kernel-pool.pipool", CALL_PIPOOL},
      {"kernel-pool.pcpool", CALL_PCPOOL},
      {"kernel-pool.swpool", CALL_SWPOOL},
      {"kernel-pool.cvpool", CALL_CVPOOL},
      {"kernel-pool.expool", CALL_EXPOOL},
  };

  for (size_t i = 0; i < sizeof(table) / sizeof(table[0]); i++) {
    if (strcmp(call, table[i].name) == 0) {
      return table[i].id;
    }
  }

  return CALL_NONE;
}