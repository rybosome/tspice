#ifndef TSPICE_BACKEND_SHIM_H
#define TSPICE_BACKEND_SHIM_H

#ifdef __cplusplus
extern "C" {
#endif

int tspice_tkvrsn_toolkit(char *out, int outMaxBytes, char *err, int errMaxBytes);

int tspice_furnsh(const char *path, char *err, int errMaxBytes);

int tspice_unload(const char *path, char *err, int errMaxBytes);

// Returns the number of loaded kernels, or -1 on error (with message in `err`).
int tspice_ktotal_all(char *err, int errMaxBytes);

#ifdef __cplusplus
}
#endif

#endif
