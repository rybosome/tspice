#ifndef TSPICE_BACKEND_SHIM_H
#define TSPICE_BACKEND_SHIM_H

#include "SpiceUsr.h"

#ifdef __cplusplus
extern "C" {
#endif

int tspice_tkvrsn_toolkit(char *out, int outMaxBytes, char *err, int errMaxBytes);

int tspice_furnsh(const char *path, char *err, int errMaxBytes);

int tspice_unload(const char *path, char *err, int errMaxBytes);

int tspice_ktotal_all(SpiceInt *outCount, char *err, int errMaxBytes);

#ifdef __cplusplus
}
#endif

#endif
