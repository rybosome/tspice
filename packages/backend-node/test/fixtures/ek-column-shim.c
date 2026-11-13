#include "SpiceUsr.h"
#include <stdlib.h>
void *audit_malloc(size_t);
void *audit_calloc(size_t,size_t);
void *audit_realloc(void*,size_t);
void audit_free(void*);
#undef ekacli_c
#undef ekacld_c
#undef ekaclc_c
#undef ekffld_c
extern __typeof__(ekacli_c) observe_ekacli;
extern __typeof__(ekacld_c) observe_ekacld;
extern __typeof__(ekaclc_c) observe_ekaclc;
extern __typeof__(ekffld_c) observe_ekffld;
#define ekacli_c observe_ekacli
#define ekacld_c observe_ekacld
#define ekaclc_c observe_ekaclc
#define ekffld_c observe_ekffld
#define malloc audit_malloc
#define calloc audit_calloc
#define realloc audit_realloc
#define free audit_free
#include "../../../backend-shim-c/src/domains/ek.c"
void audit_clear_workspace(void) {
 free(tspice_ek_wkindx_cache); tspice_ek_wkindx_cache=NULL; tspice_ek_wkindx_cache_cap=0;
}

