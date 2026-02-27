#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"

void write_unsupported_spiceint_width_error(void) {
  char detail[128];
  snprintf(detail, sizeof(detail), "sizeof(SpiceInt)=%zu (expected <= sizeof(long long)=%zu)",
           sizeof(SpiceInt), sizeof(long long));
  write_error_json_ex(
      "unsupported_spiceint_width",
      "Unsupported platform ABI: unsupported SpiceInt width",
      detail,
      NULL,
      NULL,
      NULL);
}

void capture_spice_error(char *shortMsg, size_t shortBytes,
                                char *longMsg, size_t longBytes,
                                char *traceMsg, size_t traceBytes) {
  if (shortMsg && shortBytes > 0) {
    shortMsg[0] = '\0';
    getmsg_c("SHORT", (SpiceInt)shortBytes, shortMsg);
  }
  if (longMsg && longBytes > 0) {
    longMsg[0] = '\0';
    getmsg_c("LONG", (SpiceInt)longBytes, longMsg);
  }
  if (traceMsg && traceBytes > 0) {
    traceMsg[0] = '\0';
    qcktrc_c((SpiceInt)traceBytes, traceMsg);
  }
}
