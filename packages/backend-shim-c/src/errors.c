#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <stdbool.h>
#include <string.h>

static bool g_initialized = false;

void tspice_init_cspice_error_handling_once(void) {
  if (g_initialized) {
    return;
  }

  erract_c("SET", 0, "RETURN");
  errprt_c("SET", 0, "NONE");
  g_initialized = true;
}

int tspice_get_spice_error_message_and_reset(char *out, int outMaxBytes) {
  if (outMaxBytes <= 0 || out == NULL) {
    reset_c();
    return 0;
  }

  out[0] = '\0';

  SpiceChar shortMsg[1841];
  SpiceChar longMsg[1841];
  getmsg_c("SHORT", (SpiceInt)sizeof(shortMsg), shortMsg);
  getmsg_c("LONG", (SpiceInt)sizeof(longMsg), longMsg);
  reset_c();

  const char *sep = "\n";
  const size_t sepLen = strlen(sep);

  size_t shortLen = strlen(shortMsg);
  size_t longLen = strlen(longMsg);
  size_t maxPayload = (size_t)outMaxBytes - 1;

  size_t pos = 0;

  if (shortLen > 0) {
    size_t n = shortLen > maxPayload ? maxPayload : shortLen;
    memcpy(out + pos, shortMsg, n);
    pos += n;
  }

  if (pos + sepLen < maxPayload && longLen > 0) {
    memcpy(out + pos, sep, sepLen);
    pos += sepLen;
  }

  if (longLen > 0 && pos < maxPayload) {
    size_t remaining = maxPayload - pos;
    size_t n = longLen > remaining ? remaining : longLen;
    memcpy(out + pos, longMsg, n);
    pos += n;
  }

  out[pos] = '\0';
  return 0;
}
