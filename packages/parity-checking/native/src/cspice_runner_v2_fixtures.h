#ifndef CSPICE_RUNNER_V2_FIXTURES_H
#define CSPICE_RUNNER_V2_FIXTURES_H

#include "cspice_runner_common.h"

// Minimal triangle mesh used by DSK parity scenarios.
#define DSK_MINIMAL_NV 3
#define DSK_MINIMAL_NP 1
// Keep these comfortably above documented dskmi2 lower bounds for the
// 1-plate fixture while avoiding the much larger stress-test sizing used
// elsewhere.
#define DSK_MINIMAL_WORKSZ 4096
#define DSK_MINIMAL_VOXPSZ 4096
#define DSK_MINIMAL_VOXLSZ 1024
#define DSK_MINIMAL_SPXISZ 131072

extern const SpiceDouble DSK_MINIMAL_VERTICES[DSK_MINIMAL_NV][3];
extern const SpiceInt DSK_MINIMAL_PLATES[DSK_MINIMAL_NP][3];
extern const SpiceDouble DSK_MINIMAL_CORPAR[SPICE_DSK_NSYPAR];
extern const SpiceDouble READ_VIRTUAL_OUTPUT_STATES[2][6];

bool v2_write_minimal_dsk_file(const char *tag, char *outPath,
                               size_t outPathBytes);

#endif
