#ifndef CSPICE_RUNNER_JSON_EMIT_H
#define CSPICE_RUNNER_JSON_EMIT_H

#include "cspice_runner_common.h"

void json_print_escaped(const char *s);
void trim_fixed_width_c_string_end(char *s, size_t maxBytes);
void json_print_double_array(const SpiceDouble *arr, int n);
void json_print_spiceint_array(const SpiceInt *arr, int n);
void json_print_mat3_rowmajor(const SpiceDouble m[3][3]);
void json_print_string_field(const char *key, const char *value, bool *first);

void write_error_json_ex_with_call(const char *code, const char *message,
                                   const char *detail, const char *spiceShort,
                                   const char *spiceLong,
                                   const char *spiceTrace,
                                   const char *detailsCall);
void write_error_json_ex(const char *code, const char *message,
                         const char *detail, const char *spiceShort,
                         const char *spiceLong, const char *spiceTrace);
void write_error_json(const char *message, const char *spiceShort,
                      const char *spiceLong, const char *spiceTrace);

#endif
