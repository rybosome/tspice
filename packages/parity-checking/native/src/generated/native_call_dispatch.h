#ifndef PARITY_CHECKING_GENERATED_NATIVE_CALL_DISPATCH_H
#define PARITY_CHECKING_GENERATED_NATIVE_CALL_DISPATCH_H

// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/registry/functions.registry.yml

// X-macro rows for native spice call dispatch.
// Usage: V2_NATIVE_CALL_DISPATCH_ROWS(MY_ROW_MACRO)
#define V2_NATIVE_CALL_DISPATCH_ROWS(X) \
  X(V2_FUNCTION_ID_CELLS_WINDOWS_CARD, v2_invoke_card_c) \
  X(V2_FUNCTION_ID_CELLS_WINDOWS_SCARD, v2_invoke_scard_c) \
  X(V2_FUNCTION_ID_CELLS_WINDOWS_SIZE, v2_invoke_size_c) \
  X(V2_FUNCTION_ID_CELLS_WINDOWS_SSIZE, v2_invoke_ssize_c) \
  X(V2_FUNCTION_ID_CELLS_WINDOWS_VALID, v2_invoke_valid_c) \
  X(V2_FUNCTION_ID_DSK_DSKB02, v2_invoke_dskb02_c) \
  X(V2_FUNCTION_ID_DSK_DSKGD, v2_invoke_dskgd_c) \
  X(V2_FUNCTION_ID_DSK_DSKOBJ, v2_invoke_dskobj_c) \
  X(V2_FUNCTION_ID_DSK_DSKSRF, v2_invoke_dsksrf_c) \
  X(V2_FUNCTION_ID_FILE_IO_DSKMI2, v2_invoke_dskmi2_c) \
  X(V2_FUNCTION_ID_FILE_IO_DSKOPN, v2_invoke_dskopn_c) \
  X(V2_FUNCTION_ID_FILE_IO_DSKW02, v2_invoke_dskw02_c)

#endif
