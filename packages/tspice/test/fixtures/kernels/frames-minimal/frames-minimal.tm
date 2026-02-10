KPL/MK

   frames-minimal.tm

   Minimal frame + station ephemeris kernels.

\begindata

   PATH_VALUES  = ( '.' )
   PATH_SYMBOLS = ( 'PACK' )

   KERNELS_TO_LOAD = (
      '$PACK/earth_topo_201023.tf'
      '$PACK/earthstns_itrf93_201023.bsp'
   )

\begintext

   This meta-kernel is intended for unit tests and local verification only.
