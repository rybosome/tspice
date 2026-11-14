#include "SpiceUsr.h"
/* Load CSPICE declarations/casting macros before substituting the consumer. */
#undef dskw02_c
extern __typeof__(dskw02_c) observe_dskw02;
#define dskw02_c observe_dskw02
#include "../../../backend-shim-c/src/domains/file_io.c"
