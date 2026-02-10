KPL/MK

   mgs-minimal.tm

   Minimal Mars Global Surveyor (MGS) kernels for CK-related tests.

\begindata

   PATH_VALUES  = ( '.' )
   PATH_SYMBOLS = ( 'PACK' )

   KERNELS_TO_LOAD = (
      '$PACK/mgs_sclkscet_00061.tsc'
      '$PACK/mgs_hga_hinge_v2.bc'
   )

\begintext

   This meta-kernel is intended for unit tests and local verification only.
