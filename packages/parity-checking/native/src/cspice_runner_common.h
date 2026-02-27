#ifndef CSPICE_RUNNER_COMMON_H
#define CSPICE_RUNNER_COMMON_H

#include "SpiceUsr.h"
#include "SpiceZmc.h"

#ifndef NULLCHAR
#define NULLCHAR ((SpiceChar)0)
#endif

#include <math.h>

#include <ctype.h>
#include <errno.h>
#include <inttypes.h>
#include <limits.h>
#include <locale.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>

#ifndef PATH_MAX
#define PATH_MAX 4096
#endif

// Kernel pool fixed-width string sizes (match tspice backends).
#define KPOOL_STRING_MAX_BYTES 2048
#define KPOOL_NAME_MAX_BYTES 64

// Guardrail: cap kernel-pool scratch allocations derived from untrusted `room`.
// This keeps the runner deterministic (invalid_args) instead of OOM/overflow.
#define CSPICE_RUNNER_MAX_KPOOL_ALLOC_BYTES (64 * 1024 * 1024)

#endif
