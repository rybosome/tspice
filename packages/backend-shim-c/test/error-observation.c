// Exercise a genuinely pending failure before the JavaScript boundary captures it.
#include "SpiceUsr.h"
#include "tspice_backend_shim.h"
#include <assert.h>
#include <string.h>

int main(void) {
  int indicator = -1, depth = -1;
  char err[2048] = {0}, text[128] = {0};
  tspice_init_cspice_error_handling_once();
  chkin_c("OUTER");
  chkin_c("INNER");
  setmsg_c("prepared @");
  assert(tspice_errint("@", -13, err, sizeof(err)) == 0);
  sigerr_c("SPICE(PENDING)");
  assert(tspice_return(&indicator, err, sizeof(err)) == 0 && indicator == 1);
  assert(tspice_trcdep(&depth, err, sizeof(err)) == 0 && depth == 2);
  assert(tspice_trcnam(1, sizeof(text), text, err, sizeof(err)) == 0 && strcmp(text,"INNER") == 0);
  assert(tspice_qcktrc(sizeof(text), text, err, sizeof(err)) == 0 && strcmp(text,"OUTER --> INNER") == 0);
  assert(tspice_errch("prepared", "changed", err, sizeof(err)) == 0);
  assert(tspice_errint("13", 2, err, sizeof(err)) == 0);
  assert(tspice_errdp("13", 0.5, err, sizeof(err)) == 0);
  getmsg_c("LONG", sizeof(text), text);
  assert(strcmp(text, "prepared -13") == 0 && failed_c());
  assert(tspice_trcnam(2, sizeof(text), text, err, sizeof(err)) != 0);
  assert(strstr(err, "SPICE(INDEXOUTOFRANGE)") != NULL && !failed_c());
  assert(tspice_return(&indicator, err, sizeof(err)) == 0 && indicator == 0);
  chkout_c("INNER");
  chkout_c("OUTER");
  assert(tspice_trcdep(&depth, err, sizeof(err)) == 0 && depth == 0);
  return 0;
}
