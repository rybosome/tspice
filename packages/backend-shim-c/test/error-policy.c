// Exercise operation precedence with a genuinely pending failure; policy
// mutations and irreversible TRCOFF are confined to this executable.
#include "SpiceUsr.h"
#include "tspice_backend_shim.h"
#include <assert.h>
#include <string.h>

int main(void) {
  char err[2048] = {0}, output[256] = {0}, empty[] = "";
  tspice_init_cspice_error_handling_once();
  chkin_c("CALLER");
  setmsg_c("pending");
  sigerr_c("SPICE(B07PENDING)");
  assert(failed_c() && return_c());
  assert(tspice_errdev("GET", empty, 1, output, err, sizeof(err)) == 0 && output[0] == 0);
  assert(tspice_errprt("GET", empty, sizeof(output), output, err, sizeof(err)) == 0 && output[0] == 0);
  assert(failed_c() && return_c());
  assert(tspice_errdev("SET", empty, 0, output, err, sizeof(err)) == 0);
  getmsg_c("SHORT", sizeof(output), output);
  assert(strcmp(output, "SPICE(B07PENDING)") == 0);
  assert(tspice_trcoff(err, sizeof(err)) == 0);
  assert(failed_c());
  reset_c();
  chkin_c("AFTER");
  SpiceInt depth = -1;
  trcdep_c(&depth);
  assert(depth == 0);
  return 0;
}
