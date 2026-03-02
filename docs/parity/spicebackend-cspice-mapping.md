# Raw `SpiceRawBackend` ↔ CSPICE mapping matrix

This matrix is the canonical raw mapping inventory for `SpiceRawBackend` methods.
Every canonical method from `packages/parity-checking/catalogs/contract-methods.json` has exactly one explicit mapping entry:

- `direct`: maps to a concrete CSPICE routine symbol.
- `non-direct/composite`: no 1:1 CSPICE routine; rationale is required.

## Canonical sources

- Contract method inventory: `packages/parity-checking/catalogs/contract-methods.json`
- Mapping matrix (machine-readable): `packages/parity-checking/catalogs/cspice-mapping-matrix.json`
- Validation command: `pnpm -C packages/parity-checking run check:cspice-mapping`

## Totals

- Total methods: **162**
- Direct mappings: **161**
- Non-direct/composite mappings: **1**
- Unmapped methods: **0** (validated by script)

## Domain: `cells-windows`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `cells-windows.card` | direct | `card_c` | — |
| `cells-windows.insrtc` | direct | `insrtc_c` | — |
| `cells-windows.insrtd` | direct | `insrtd_c` | — |
| `cells-windows.insrti` | direct | `insrti_c` | — |
| `cells-windows.scard` | direct | `scard_c` | — |
| `cells-windows.size` | direct | `size_c` | — |
| `cells-windows.ssize` | direct | `ssize_c` | — |
| `cells-windows.valid` | direct | `valid_c` | — |
| `cells-windows.wncard` | direct | `wncard_c` | — |
| `cells-windows.wnfetd` | direct | `wnfetd_c` | — |
| `cells-windows.wninsd` | direct | `wninsd_c` | — |
| `cells-windows.wnvald` | direct | `wnvald_c` | — |

## Domain: `coords-vectors`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `coords-vectors.axisar` | direct | `axisar_c` | — |
| `coords-vectors.georec` | direct | `georec_c` | — |
| `coords-vectors.latrec` | direct | `latrec_c` | — |
| `coords-vectors.mtxv` | direct | `mtxv_c` | — |
| `coords-vectors.mxm` | direct | `mxm_c` | — |
| `coords-vectors.mxv` | direct | `mxv_c` | — |
| `coords-vectors.recgeo` | direct | `recgeo_c` | — |
| `coords-vectors.reclat` | direct | `reclat_c` | — |
| `coords-vectors.recsph` | direct | `recsph_c` | — |
| `coords-vectors.rotate` | direct | `rotate_c` | — |
| `coords-vectors.rotmat` | direct | `rotmat_c` | — |
| `coords-vectors.sphrec` | direct | `sphrec_c` | — |
| `coords-vectors.vadd` | direct | `vadd_c` | — |
| `coords-vectors.vcrss` | direct | `vcrss_c` | — |
| `coords-vectors.vdot` | direct | `vdot_c` | — |
| `coords-vectors.vhat` | direct | `vhat_c` | — |
| `coords-vectors.vminus` | direct | `vminus_c` | — |
| `coords-vectors.vnorm` | direct | `vnorm_c` | — |
| `coords-vectors.vscl` | direct | `vscl_c` | — |
| `coords-vectors.vsub` | direct | `vsub_c` | — |

## Domain: `dsk`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `dsk.dskb02` | direct | `dskb02_c` | — |
| `dsk.dskgd` | direct | `dskgd_c` | — |
| `dsk.dskobj` | direct | `dskobj_c` | — |
| `dsk.dsksrf` | direct | `dsksrf_c` | — |

## Domain: `ek`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `ek.ekaclc` | direct | `ekaclc_c` | — |
| `ek.ekacld` | direct | `ekacld_c` | — |
| `ek.ekacli` | direct | `ekacli_c` | — |
| `ek.ekcls` | direct | `ekcls_c` | — |
| `ek.ekffld` | direct | `ekffld_c` | — |
| `ek.ekfind` | direct | `ekfind_c` | — |
| `ek.ekgc` | direct | `ekgc_c` | — |
| `ek.ekgd` | direct | `ekgd_c` | — |
| `ek.ekgi` | direct | `ekgi_c` | — |
| `ek.ekifld` | direct | `ekifld_c` | — |
| `ek.eknseg` | direct | `eknseg_c` | — |
| `ek.ekntab` | direct | `ekntab_c` | — |
| `ek.ekopn` | direct | `ekopn_c` | — |
| `ek.ekopr` | direct | `ekopr_c` | — |
| `ek.ekopw` | direct | `ekopw_c` | — |
| `ek.ektnam` | direct | `ektnam_c` | — |

## Domain: `ephemeris`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `ephemeris.spkcls` | direct | `spkcls_c` | — |
| `ephemeris.spkcov` | direct | `spkcov_c` | — |
| `ephemeris.spkez` | direct | `spkez_c` | — |
| `ephemeris.spkezp` | direct | `spkezp_c` | — |
| `ephemeris.spkezr` | direct | `spkezr_c` | — |
| `ephemeris.spkgeo` | direct | `spkgeo_c` | — |
| `ephemeris.spkgps` | direct | `spkgps_c` | — |
| `ephemeris.spkobj` | direct | `spkobj_c` | — |
| `ephemeris.spkopa` | direct | `spkopa_c` | — |
| `ephemeris.spkopn` | direct | `spkopn_c` | — |
| `ephemeris.spkpds` | direct | `spkpds_c` | — |
| `ephemeris.spkpos` | direct | `spkpos_c` | — |
| `ephemeris.spksfs` | direct | `spksfs_c` | — |
| `ephemeris.spkssb` | direct | `spkssb_c` | — |
| `ephemeris.spkuds` | direct | `spkuds_c` | — |
| `ephemeris.spkw08` | direct | `spkw08_c` | — |

## Domain: `error`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `error.chkin` | direct | `chkin_c` | — |
| `error.chkout` | direct | `chkout_c` | — |
| `error.failed` | direct | `failed_c` | — |
| `error.getmsg` | direct | `getmsg_c` | — |
| `error.reset` | direct | `reset_c` | — |
| `error.setmsg` | direct | `setmsg_c` | — |
| `error.sigerr` | direct | `sigerr_c` | — |

## Domain: `file-io`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `file-io.dafbfs` | direct | `dafbfs_c` | — |
| `file-io.dafcls` | direct | `dafcls_c` | — |
| `file-io.daffna` | direct | `daffna_c` | — |
| `file-io.dafopr` | direct | `dafopr_c` | — |
| `file-io.dascls` | direct | `dascls_c` | — |
| `file-io.dasopr` | direct | `dasopr_c` | — |
| `file-io.dlabfs` | direct | `dlabfs_c` | — |
| `file-io.dlacls` | direct | `dlacls_c` | — |
| `file-io.dlafns` | direct | `dlafns_c` | — |
| `file-io.dlaopn` | direct | `dlaopn_c` | — |
| `file-io.dskmi2` | direct | `dskmi2_c` | — |
| `file-io.dskopn` | direct | `dskopn_c` | — |
| `file-io.dskw02` | direct | `dskw02_c` | — |
| `file-io.exists` | non-direct/composite | — | Filesystem existence preflight is implemented via host runtime file APIs; CSPICE has no `exists_c` routine. |
| `file-io.getfat` | direct | `getfat_c` | — |

## Domain: `frames`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `frames.ccifrm` | direct | `ccifrm_c` | — |
| `frames.cidfrm` | direct | `cidfrm_c` | — |
| `frames.ckcov` | direct | `ckcov_c` | — |
| `frames.ckgp` | direct | `ckgp_c` | — |
| `frames.ckgpav` | direct | `ckgpav_c` | — |
| `frames.cklpf` | direct | `cklpf_c` | — |
| `frames.ckobj` | direct | `ckobj_c` | — |
| `frames.ckupf` | direct | `ckupf_c` | — |
| `frames.cnmfrm` | direct | `cnmfrm_c` | — |
| `frames.frinfo` | direct | `frinfo_c` | — |
| `frames.frmnam` | direct | `frmnam_c` | — |
| `frames.namfrm` | direct | `namfrm_c` | — |
| `frames.pxform` | direct | `pxform_c` | — |
| `frames.sxform` | direct | `sxform_c` | — |

## Domain: `geometry`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `geometry.illumf` | direct | `illumf_c` | — |
| `geometry.illumg` | direct | `illumg_c` | — |
| `geometry.ilumin` | direct | `ilumin_c` | — |
| `geometry.nvc2pl` | direct | `nvc2pl_c` | — |
| `geometry.occult` | direct | `occult_c` | — |
| `geometry.pl2nvc` | direct | `pl2nvc_c` | — |
| `geometry.sincpt` | direct | `sincpt_c` | — |
| `geometry.subpnt` | direct | `subpnt_c` | — |
| `geometry.subslr` | direct | `subslr_c` | — |

## Domain: `geometry-gf`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `geometry-gf.gfdist` | direct | `gfdist_c` | — |
| `geometry-gf.gfrefn` | direct | `gfrefn_c` | — |
| `geometry-gf.gfrepf` | direct | `gfrepf_c` | — |
| `geometry-gf.gfrepi` | direct | `gfrepi_c` | — |
| `geometry-gf.gfsep` | direct | `gfsep_c` | — |
| `geometry-gf.gfsstp` | direct | `gfsstp_c` | — |
| `geometry-gf.gfstep` | direct | `gfstep_c` | — |
| `geometry-gf.gfstol` | direct | `gfstol_c` | — |

## Domain: `ids-names`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `ids-names.bodc2n` | direct | `bodc2n_c` | — |
| `ids-names.bodc2s` | direct | `bodc2s_c` | — |
| `ids-names.boddef` | direct | `boddef_c` | — |
| `ids-names.bodfnd` | direct | `bodfnd_c` | — |
| `ids-names.bodn2c` | direct | `bodn2c_c` | — |
| `ids-names.bods2c` | direct | `bods2c_c` | — |
| `ids-names.bodvar` | direct | `bodvar_c` | — |

## Domain: `kernel-pool`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `kernel-pool.cvpool` | direct | `cvpool_c` | — |
| `kernel-pool.dtpool` | direct | `dtpool_c` | — |
| `kernel-pool.expool` | direct | `expool_c` | — |
| `kernel-pool.gcpool` | direct | `gcpool_c` | — |
| `kernel-pool.gdpool` | direct | `gdpool_c` | — |
| `kernel-pool.gipool` | direct | `gipool_c` | — |
| `kernel-pool.gnpool` | direct | `gnpool_c` | — |
| `kernel-pool.pcpool` | direct | `pcpool_c` | — |
| `kernel-pool.pdpool` | direct | `pdpool_c` | — |
| `kernel-pool.pipool` | direct | `pipool_c` | — |
| `kernel-pool.swpool` | direct | `swpool_c` | — |

## Domain: `kernels`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `kernels.furnsh` | direct | `furnsh_c` | — |
| `kernels.kclear` | direct | `kclear_c` | — |
| `kernels.kdata` | direct | `kdata_c` | — |
| `kernels.kinfo` | direct | `kinfo_c` | — |
| `kernels.kplfrm` | direct | `kplfrm_c` | — |
| `kernels.ktotal` | direct | `ktotal_c` | — |
| `kernels.kxtrct` | direct | `kxtrct_c` | — |
| `kernels.unload` | direct | `unload_c` | — |

## Domain: `time`

| method | mapping status | CSPICE entrypoint | rationale |
| --- | --- | --- | --- |
| `time.deltet` | direct | `deltet_c` | — |
| `time.et2utc` | direct | `et2utc_c` | — |
| `time.scdecd` | direct | `scdecd_c` | — |
| `time.sce2c` | direct | `sce2c_c` | — |
| `time.sce2s` | direct | `sce2s_c` | — |
| `time.scencd` | direct | `scencd_c` | — |
| `time.scs2e` | direct | `scs2e_c` | — |
| `time.sct2e` | direct | `sct2e_c` | — |
| `time.str2et` | direct | `str2et_c` | — |
| `time.timdef` | direct | `timdef_c` | — |
| `time.timout` | direct | `timout_c` | — |
| `time.tkvrsn` | direct | `tkvrsn_c` | — |
| `time.tparse` | direct | `tparse_c` | — |
| `time.tpictr` | direct | `tpictr_c` | — |
| `time.unitim` | direct | `unitim_c` | — |

