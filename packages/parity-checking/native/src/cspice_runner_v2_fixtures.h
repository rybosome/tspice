#ifndef CSPICE_RUNNER_V2_FIXTURES_H
#define CSPICE_RUNNER_V2_FIXTURES_H

#include "cspice_runner_common.h"

// Minimal triangle mesh used by DSK parity scenarios.
#define DSK_MINIMAL_NV 3
#define DSK_MINIMAL_NP 1
// Match the proven minimal sizing used by backend round-trip tests.
#define DSK_MINIMAL_WORKSZ 100000
#define DSK_MINIMAL_VOXPSZ 5000
#define DSK_MINIMAL_VOXLSZ 5000
#define DSK_MINIMAL_SPXISZ 200000

extern const SpiceDouble DSK_MINIMAL_VERTICES[DSK_MINIMAL_NV][3];
extern const SpiceInt DSK_MINIMAL_PLATES[DSK_MINIMAL_NP][3];
extern const SpiceDouble DSK_MINIMAL_CORPAR[SPICE_DSK_NSYPAR];
extern const SpiceDouble READ_VIRTUAL_OUTPUT_STATES[2][6];

bool v2_write_minimal_dsk_file(const char *tag, char *outPath,
                               size_t outPathBytes);

#endif
