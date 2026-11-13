#include "tspice_backend_shim.h"
#include "SpiceUsr.h"
#include "SpiceDSK.h"
#include <stdint.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int forwarded = 0;
/* This consumer substitutes only the unsafe downstream call. The actual shared
   shim is compiled and linked; malformed backing must be rejected before here. */
void observe_dskw02(SpiceInt handle, SpiceInt center, SpiceInt surfid,
    SpiceInt dclass, ConstSpiceChar *frame, SpiceInt corsys,
    ConstSpiceDouble corpar[], SpiceDouble mn1, SpiceDouble mx1,
    SpiceDouble mn2, SpiceDouble mx2, SpiceDouble mn3, SpiceDouble mx3,
    SpiceDouble first, SpiceDouble last, SpiceInt nv,
    ConstSpiceDouble vertices[][3], SpiceInt np, ConstSpiceInt plates[][3],
    ConstSpiceDouble spaixd[], ConstSpiceInt spaixi[]) {
  forwarded++;
}

static int invoke(int32_t *index, int length, int expect_ok) {
  const double corpar[10] = {0};
  const double vertices[9] = {0,0,0, 1,0,0, 0,1,0};
  const int32_t plates[3] = {1,2,3};
  const double spaixd[10] = {0};
  char err[1841] = {0};
  int before = forwarded;
  int code = tspice_dskw02(17, 399, 1, 2, "J2000", 3, corpar,
      0,1,0,1,-0.1,0.1,0,1,3,vertices,1,plates,spaixd,10,index,length,err,sizeof(err));
  if (expect_ok ? (code != 0 || forwarded != before + 1) :
      (code == 0 || forwarded != before || strstr(err, "spaixi") == NULL)) {
    fprintf(stderr, "length=%d code=%d forwarded=%d expected_ok=%d error=%s\n",
        length, code, forwarded-before, expect_ok, err);
    return 1;
  }
  return 0;
}
int main(void) {
  const int fixed = SPICE_DSK02_IXIFIX;
  const int full = fixed + 2 + 3 + 3 + 4;
  int32_t *index = calloc((size_t)full, sizeof(int32_t));
  if (!index) return 2;
  index[0]=1; index[1]=1; index[2]=1; index[3]=1;
  index[4]=2; index[5]=3; index[6]=4;
  if (invoke(index, fixed, 0) || invoke(index, full-1, 0) || invoke(index, full, 1)) return 1;
  index[4]=-1;
  if (invoke(index, full, 0)) return 1;
  index[4]=INT_MAX; index[5]=INT_MAX; index[6]=INT_MAX;
  if (invoke(index, full, 0)) return 1;
  /* N0067's writer reads NV vertex pointers even when no vertex-plate list
     was requested. Backing storage must cover those pointers as well. */
  index[4]=2; index[5]=3; index[6]=0;
  if (invoke(index, fixed+2+3+3-1, 0) || invoke(index, fixed+2+3+3, 1)) return 1;
  free(index);
  puts("validated fixed, variable, zero-list and overflow index backing");
  return 0;
}
