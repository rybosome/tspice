#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include "SpiceZfc.h"
#include <limits.h>
#include <math.h>
#include "../handle_validation.h"

#include <stddef.h>
#include <stdio.h>
#include <string.h>

static int tspice_ephemeris_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // Stable ABI boundary: never invoke CSPICE with invalid pointers/lengths.
  // Also clear structured last-error buffers so higher-level callers don't
  // accidentally attach stale SPICE fields to these validation errors.
  tspice_clear_last_error_buffers();

  if (err && errMaxBytes > 0) {
    if (msg) {
      strncpy(err, msg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    } else {
      err[0] = '\0';
    }
  }

  return 1;
}

static int tspice_int_to_spice_int_checked(
    int value,
    SpiceInt *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_int_to_spice_int_checked(): out must be non-null");
  }

  const SpiceInt v = (SpiceInt)value;
  if ((int)v != value) {
    char buf[200];
    snprintf(buf, sizeof(buf), "%s: int value out of SpiceInt range (%d)", ctx, value);
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, buf);
  }

  *out = v;
  return 0;
}

static int tspice_spice_int_to_int_checked(
    SpiceInt value,
    int *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spice_int_to_int_checked(): out must be non-null");
  }

  const int v = (int)value;
  if ((SpiceInt)v != value) {
    char buf[220];
    snprintf(buf, sizeof(buf), "%s: SpiceInt value out of int range (%ld)", ctx, (long)value);
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, buf);
  }

  *out = v;
  return 0;
}

int tspice_spkezr(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkezr_c(target, (SpiceDouble)et, ref, abcorr, observer, state, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkpos(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkpos_c(target, (SpiceDouble)et, ref, abcorr, observer, pos, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPos3) {
    outPos3[0] = (double)pos[0];
    outPos3[1] = (double)pos[1];
    outPos3[2] = (double)pos[2];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkez(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkez()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkez()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkez_c(targ, (SpiceDouble)et, ref, abcorr, obs, state, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkezp(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkezp()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkezp()", err, errMaxBytes) != 0) return 1;

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkezp_c(targ, (SpiceDouble)et, ref, abcorr, obs, pos, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPos3) {
    outPos3[0] = (double)pos[0];
    outPos3[1] = (double)pos[1];
    outPos3[2] = (double)pos[2];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkgeo(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkgeo()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkgeo()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkgeo_c(targ, (SpiceDouble)et, ref, obs, state, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkgps(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkgps()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkgps()", err, errMaxBytes) != 0) return 1;

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkgps_c(targ, (SpiceDouble)et, ref, obs, pos, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPos3) {
    outPos3[0] = (double)pos[0];
    outPos3[1] = (double)pos[1];
    outPos3[2] = (double)pos[2];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkssb(
    int target,
    double et,
    const char *ref,
    double *outState6,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkssb()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  spkssb_c(targ, (SpiceDouble)et, ref, state);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }

  return 0;
}

int tspice_spkcov(
    const char *spk,
    int idcode,
    uintptr_t coverWindowHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cover = tspice_validate_handle(coverWindowHandle, "window", "tspice_spkcov()", err, errMaxBytes);
  if (!cover) {
    return 1;
  }
  if (cover->dtype != SPICE_DP) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkcov(): expected SPICE_DP window");
  }

  SpiceInt code = 0;
  if (tspice_int_to_spice_int_checked(idcode, &code, "tspice_spkcov()", err, errMaxBytes) != 0) return 1;

  spkcov_c(spk, code, cover);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spkobj(
    const char *spk,
    uintptr_t idsCellHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *ids = tspice_validate_handle(idsCellHandle, "cell", "tspice_spkobj()", err, errMaxBytes);
  if (!ids) {
    return 1;
  }
  if (ids->dtype != SPICE_INT) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkobj(): expected SPICE_INT cell");
  }

  spkobj_c(spk, ids);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

// SPKBSR stores at most 5000 distinct physical files and de-duplicates
// repeated loads. Generations keep old local tokens from acting on a later
// registration, even when an independent DAF link kept the physical handle.
enum { SPK_LOAD_CAPACITY = 5000 };
typedef struct {
  int handle;
  int generation;
  int inKeeper;
} SpkRegistration;
static SpkRegistration spk_loads[SPK_LOAD_CAPACITY];
static int next_spk_generation;

static int spk_status(char *err, int cap) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err,cap);
  return 1;
}

static int spk_generation(int handle, int *out, char *err, int cap) {
  int vacant = -1;
  for (int i=0; i<SPK_LOAD_CAPACITY; ++i) {
    if (spk_loads[i].generation && spk_loads[i].handle == handle) {
      *out = spk_loads[i].generation;
      return 0;
    }
    if (!spk_loads[i].generation && vacant < 0) vacant = i;
  }
  if (vacant < 0 || next_spk_generation == INT_MAX)
    return tspice_ephemeris_invalid_arg(err,cap,"SPK registration limit reached");
  spk_loads[vacant] = (SpkRegistration){handle, ++next_spk_generation, 0};
  *out = next_spk_generation;
  return 0;
}

// KEEPER may unload a directly registered file. Take snapshots around its
// actual mutation. A direct-only load survives a KEEPER clear. A duplicate
// KEEPER link still present after unload keeps its existing generation.
void tspice_spk_keeper_snapshot(int after) {
  int active = 0;
  for (int i=0; i<SPK_LOAD_CAPACITY; ++i) {
    if (spk_loads[i].generation) {
      active = 1;
      if (!after) spk_loads[i].inKeeper = 0;
    }
  }
  if (!active) return;
  SpiceInt count = 0;
  ktotal_c("SPK", &count);
  for (int row=0; row<count; ++row) {
    char file[256], type[9], source[256];
    SpiceInt handle = 0;
    SpiceBoolean found = SPICEFALSE;
    kdata_c(row,"SPK",sizeof(file),sizeof(type),sizeof(source),file,type,source,&handle,&found);
    if (!found || failed_c()) continue;
    for (int i=0; i<SPK_LOAD_CAPACITY; ++i)
      if (spk_loads[i].generation && spk_loads[i].handle == handle)
        spk_loads[i].inKeeper = after ? 0 : 1;
  }
  if (after) {
    for (int i=0; i<SPK_LOAD_CAPACITY; ++i)
      if (spk_loads[i].inKeeper) spk_loads[i] = (SpkRegistration){0};
  }
}

static SpkRegistration *spk_registration(int generation) {
  for (int i=0; generation>0 && i<SPK_LOAD_CAPACITY; ++i)
    if (spk_loads[i].generation == generation) return &spk_loads[i];
  return NULL;
}

int tspice_spklef(const char *path, int *generation, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!path || !generation || next_spk_generation == INT_MAX)
    return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK load path, generation or result");
  SpiceInt handle = 0;
  spklef_c(path, &handle);
  if (spk_status(err,cap)) return 1;
  return spk_generation(handle,generation,err,cap);
}

int tspice_spkuef(int generation, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  SpkRegistration *entry = spk_registration(generation);
  // The canonical unload of a file absent from SPKBSR is a no-op. Zero
  // cannot be a physical DAF handle and cannot unload a replacement.
  spkuef_c(entry ? entry->handle : 0);
  if (spk_status(err,cap)) return 1;
  if (entry) *entry = (SpkRegistration){0};
  return 0;
}

static int spk_reader(int source, int isRegistration, int *handle, char *err, int cap) {
  if (!isRegistration) { *handle = source; return 0; }
  SpkRegistration *entry = spk_registration(source);
  if (!entry) return tspice_ephemeris_invalid_arg(err,cap,"SPK registration is no longer active");
  *handle = entry->handle;
  return 0;
}

// Authenticate the entire native-word descriptor against real DAF summary
// records without disturbing the user's current DAF search or selection.
static int spk_file_descriptor(int handle, const void *input, int size, double words[5],
                               int integers[6], char *err, int cap) {
  if (!input || size != 40)
    return tspice_ephemeris_invalid_arg(err,cap,"Expected exactly 40 packed SPK descriptor bytes");
  char arch[9] = {0}, kind[9] = {0}, path[256] = {0};
  dafhfn_(&handle,path,255);
  if (spk_status(err,cap)) return 1;
  for (int i=254; i>=0 && path[i]==' '; --i) path[i]=0;
  getfat_c(path,sizeof(arch),sizeof(kind),arch,kind);
  if (spk_status(err,cap)) return 1;
  if (strcmp(arch,"DAF") || strcmp(kind,"SPK"))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected a readable SPK DAF");
  char name[61] = {0};
  int fields[5] = {0};
  if (tspice_dafrfr(handle,sizeof(name),name,sizeof(name),fields,err,cap)) return 1;
  if (fields[0]!=2 || fields[1]!=6 || fields[4]<2)
    return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK DAF file record");
  const int limit = (fields[4]-2)/128+1;
  int record=fields[2], previous=0;
  for (int visited=0; record && visited<limit; ++visited) {
    double row[128]={0};
    int found=0;
    if (record<2 || record>limit) break;
    if (tspice_dafgsr(handle,record,1,128,(unsigned char*)row,sizeof(row),&found,err,cap)) return 1;
    if (!found || row[1]!=previous || !(row[0]>=0 && row[0]<=limit && trunc(row[0])==row[0]) ||
        !(row[2]>=0 && row[2]<=25 && trunc(row[2])==row[2])) break;
    for (int i=0; i<(int)row[2]; ++i) {
      if (memcmp(row+3+5*i,input,40)) continue;
      memcpy(words,input,40);
      double endpoints[2];
      dafus_c(words,2,6,endpoints,integers);
      if (spk_status(err,cap)) return 1;
      if (integers[4]>0 && integers[4]<=integers[5] && integers[5]<fields[4] &&
          isfinite(endpoints[0]) && isfinite(endpoints[1]) && endpoints[0]<=endpoints[1]) return 0;
      return tspice_ephemeris_invalid_arg(err,cap,"Invalid source SPK segment bounds");
    }
    previous=record;
    record=(int)row[0];
  }
  return tspice_ephemeris_invalid_arg(err,cap,"Packed SPK descriptor does not belong to this file");
}

int tspice_spkpvn(int source, int isRegistration, const void *descr, int size, double et,
                  int *ref, double *state6, int *center, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  int handle, fields[6];
  double words[5];
  if (!ref || !state6 || !center || !isfinite(et))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected a finite epoch and SPK result storage");
  if (spk_reader(source,isRegistration,&handle,err,cap) ||
      spk_file_descriptor(handle,descr,size,words,fields,err,cap)) return 1;
  // SPKR08/09/12/13/14/18/19 diagnose out-of-coverage epochs themselves.
  // Other readers extrapolate. Check only the actual record address or f2c
  // integer conversion that would be unsafe for the selected storage layout.
  if (fields[3]==2 || fields[3]==3 || fields[3]==20) {
    const int type=fields[3], tail=type==20 ? 7 : 4;
    if (fields[5]-fields[4]+1<tail)
      return tspice_ephemeris_invalid_arg(err,cap,"Incomplete SPK coefficient segment trailer");
    double controls[7]={0};
    dafgda_c(handle,fields[5]-tail+1,fields[5],controls);
    if (spk_status(err,cap)) return 1;
    const double start=type==20 ? (controls[2]-j2000_c()+controls[3])*spd_c() : controls[0];
    const double step=type==20 ? controls[4]*spd_c() : controls[1];
    const double width=controls[tail-2], count=controls[tail-1];
    const int extent=fields[5]-fields[4]+1-tail;
    if (!(width>=1 && width<=(type==20?195:197) && trunc(width)==width &&
          count>=1 && count<=INT_MAX && trunc(count)==count &&
          width*count==extent && isfinite(start) && isfinite(step) && step>0))
      return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK coefficient record extent");
    const double ordinal=trunc((et-start)/step);
    if (!(ordinal>=INT_MIN && ordinal<=INT_MAX-1) || (type!=20 && ordinal<0))
      return tspice_ephemeris_invalid_arg(err,cap,"Epoch exceeds addressable SPK coefficient records");
  } else if ((fields[3]==1 || fields[3]==21) && et>words[1]) {
    // These readers select the first record endpoint at or above ET. Unlike
    // a DAF descriptor, its last physical record may extend past coverage.
    const int trailer=fields[3]==1 ? 1 : 2;
    double n=0,finalEpoch=0;
    dafgda_c(handle,fields[5],fields[5],&n);
    if (spk_status(err,cap)) return 1;
    if (!(n>=1 && n<=fields[5]-fields[4]+1 && trunc(n)==n))
      return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK difference record count");
    const int addr=fields[5]-(int)n/100-trailer;
    if (addr<fields[4]) return tspice_ephemeris_invalid_arg(err,cap,"Invalid SPK epoch directory");
    dafgda_c(handle,addr,addr,&finalEpoch);
    if (spk_status(err,cap)) return 1;
    if (!(et<=finalEpoch)) return tspice_ephemeris_invalid_arg(err,cap,"Epoch exceeds the last SPK difference record");
  } else if (fields[3]==10) {
    // SPKR10 chooses the closest one or two element sets even beyond the
    // descriptor endpoints. Check the selected packets before propagation.
    double record[198]={0};
    spkr10_(&handle,words,&et,record);
    if (spk_status(err,cap)) return 1;
    for (int offset=8; offset<=22; offset+=14) {
      double *elements=record+offset;
      if (!isfinite(elements[9]) || fabs(elements[9])>1.6e14)
        return tspice_ephemeris_invalid_arg(err,cap,"SPK element epoch exceeds signed calendar-day range");
      // Only a resonant orbit uses N0067's unbounded 720-minute loop.
      // ZZINIL computes the corrected mean motion used by the actual driver.
      if (fabs(et-elements[9])>=43200000000.0) {
        int mode=2;
        double epoch=0, ecc=elements[5], incl=elements[3], motion=elements[8], aux[13]={0};
        zzinil_(record,&mode,&ecc,&epoch,&incl,&motion,&aux[0],&aux[1],&aux[2],&aux[3],
                &aux[4],&aux[5],&aux[6],&aux[7],&aux[8],&aux[9],&aux[10],&aux[11],&aux[12]);
        if (spk_status(err,cap)) return 1;
        if ((motion>.0034906585 && motion<.0052359877) ||
            (motion>=.00826 && motion<=.00924 && ecc>=.5)) {
          // Preserve initialization errors (including missing leap seconds)
          // before imposing the execution-work limit.
          mode=1;
          chkin_c("spkpvn_c"); chkin_c("SPKPVN"); chkin_c("SPKE10");
          xxsgp4i_(record,elements,&mode);
          chkout_c("SPKE10"); chkout_c("SPKPVN"); chkout_c("spkpvn_c");
          if (spk_status(err,cap)) return 1;
          return tspice_ephemeris_invalid_arg(err,cap,"SPK resonant interval reaches one million integration steps");
        }
      }
      if (record[17]==record[31]) break;
    }
  }
  spkpvn_c(handle,words,et,ref,state6,center);
  return spk_status(err,cap);
}

int tspice_spksub(int source, int isRegistration, const void *descr, int size, const char *ident,
                  double begin, double end, int writer, char *err, int cap) {
  tspice_init_cspice_error_handling_once();
  int handle, fields[6];
  double words[5];
  if (!ident || !isfinite(begin) || !isfinite(end))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected a segment ID and finite subset epochs");
  if (spk_reader(source,isRegistration,&handle,err,cap) ||
      spk_file_descriptor(handle,descr,size,words,fields,err,cap)) return 1;
  if (handle==writer) return tspice_ephemeris_invalid_arg(err,cap,"An SPK subset requires a separate writer");
  // Authenticate the write-mode handle even for direct native callers.
  dafsih_(&writer,"WRITE",5);
  if (spk_status(err,cap)) return 1;
  char idword[8], ifname[60];
  int nd=0, ni=0, fward=0, bward=0, freeAddress=0, found=0;
  zzdafgfr_(&writer,idword,&nd,&ni,ifname,&fward,&bward,&freeAddress,&found,8,60);
  if (spk_status(err,cap)) return 1;
  if (!found || nd!=2 || ni!=6 ||
      (memcmp(idword,"DAF/",4)==0 && memcmp(idword,"DAF/SPK ",8)!=0))
    return tspice_ephemeris_invalid_arg(err,cap,"Expected an SPK subset writer");
  spksub_c(handle,words,ident,begin,end,writer);
  return spk_status(err,cap);
}

int tspice_spksfs(
    int body,
    double et,
    int *outHandle,
    int *outGeneration,
    double *outDescr5,
    char *outIdent,
    int outIdentMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (outHandle) {
    *outHandle = 0;
  }
  if (outIdentMaxBytes > 0 && outIdent) {
    outIdent[0] = '\0';
  }
  if (outDescr5) {
    for (int i = 0; i < 5; i++) {
      outDescr5[i] = 0.0;
    }
  }

  if (outIdentMaxBytes > 0 && !outIdent) {
    return tspice_ephemeris_invalid_arg(
        err,
        errMaxBytes,
        "tspice_spksfs(): outIdent must not be NULL when outIdentMaxBytes > 0");
  }

  // NAIF SIDLEN is 40 characters (excluding NUL).
  // Caller must provide SIDLEN+1 bytes.
  const int kMinIdentBytes = 41;
  if (outIdentMaxBytes < kMinIdentBytes) {
    return tspice_ephemeris_invalid_arg(
        err,
        errMaxBytes,
        "tspice_spksfs(): outIdentMaxBytes must be >= 41 (SIDLEN+1) to avoid truncation");
  }

  SpiceInt b = 0;
  if (tspice_int_to_spice_int_checked(body, &b, "tspice_spksfs()", err, errMaxBytes) != 0) return 1;

  SpiceInt handle = 0;
  SpiceDouble descr[5];
  SpiceBoolean found = SPICEFALSE;

  spksfs_c(b, (SpiceDouble)et, (SpiceInt)outIdentMaxBytes, &handle, descr, outIdent, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = found ? 1 : 0;
  }

  if (!found) {
    return 0;
  }

  if (!outGeneration || spk_generation(handle,outGeneration,err,errMaxBytes)) return 1;
  if (outHandle) {
    if (tspice_spice_int_to_int_checked(handle, outHandle, "tspice_spksfs()", err, errMaxBytes) != 0) {
      return 1;
    }
  }

  if (outDescr5) {
    outDescr5[0] = (double)descr[0];
    outDescr5[1] = (double)descr[1];
    outDescr5[2] = (double)descr[2];
    outDescr5[3] = (double)descr[3];
    outDescr5[4] = (double)descr[4];
  }

  // `outIdent` is already filled.
  return 0;
}

int tspice_spkpds(
    int body,
    int center,
    const char *frame,
    int type,
    double first,
    double last,
    double *outDescr5,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDescr5) {
    for (int i = 0; i < 5; i++) {
      outDescr5[i] = 0.0;
    }
  }

  SpiceInt b = 0;
  SpiceInt c = 0;
  SpiceInt t = 0;
  if (tspice_int_to_spice_int_checked(body, &b, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(center, &c, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(type, &t, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;

  SpiceDouble descr[5];
  spkpds_c(b, c, frame, t, (SpiceDouble)first, (SpiceDouble)last, descr);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outDescr5) {
    outDescr5[0] = (double)descr[0];
    outDescr5[1] = (double)descr[1];
    outDescr5[2] = (double)descr[2];
    outDescr5[3] = (double)descr[3];
    outDescr5[4] = (double)descr[4];
  }

  return 0;
}

int tspice_spkuds(
    const double *descr5,
    int *outBody,
    int *outCenter,
    int *outFrame,
    int *outType,
    double *outFirst,
    double *outLast,
    int *outBaddr,
    int *outEaddr,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!descr5) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkuds(): descr5 must not be NULL");
  }

  SpiceInt body = 0;
  SpiceInt center = 0;
  SpiceInt frame = 0;
  SpiceInt type = 0;
  SpiceDouble first = 0.0;
  SpiceDouble last = 0.0;
  SpiceInt baddrs = 0;
  SpiceInt eaddrs = 0;

  spkuds_c((ConstSpiceDouble *)descr5, &body, &center, &frame, &type, &first, &last, &baddrs, &eaddrs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outBody) {
    if (tspice_spice_int_to_int_checked(body, outBody, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outCenter) {
    if (tspice_spice_int_to_int_checked(center, outCenter, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outFrame) {
    if (tspice_spice_int_to_int_checked(frame, outFrame, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outType) {
    if (tspice_spice_int_to_int_checked(type, outType, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outFirst) {
    *outFirst = (double)first;
  }
  if (outLast) {
    *outLast = (double)last;
  }
  if (outBaddr) {
    if (tspice_spice_int_to_int_checked(baddrs, outBaddr, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outEaddr) {
    if (tspice_spice_int_to_int_checked(eaddrs, outEaddr, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }

  return 0;
}

// --- SPK writers ------------------------------------------------------------

int tspice_spkopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): path must be a non-empty string");
  }
  if (!ifname) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): ifname must not be NULL");
  }
  if (!outHandle) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): outHandle must not be NULL");
  }

  SpiceInt ncomchC = 0;
  if (tspice_int_to_spice_int_checked(ncomch, &ncomchC, "tspice_spkopn(ncomch)", err, errMaxBytes) != 0) return 1;

  SpiceInt handleC = 0;
  spkopn_c(path, ifname, ncomchC, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (tspice_spice_int_to_int_checked(handleC, outHandle, "tspice_spkopn(outHandle)", err, errMaxBytes) != 0) return 1;
  return 0;
}

int tspice_spkopa(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopa(): path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopa(): outHandle must not be NULL");
  }

  SpiceInt handleC = 0;
  spkopa_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (tspice_spice_int_to_int_checked(handleC, outHandle, "tspice_spkopa(outHandle)", err, errMaxBytes) != 0) return 1;
  return 0;
}

int tspice_spkcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt handleC = 0;
  if (tspice_int_to_spice_int_checked(handle, &handleC, "tspice_spkcls(handle)", err, errMaxBytes) != 0) return 1;

  spkcls_c(handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spkw08(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes) {
  // v1 entrypoint: best-effort dispatch through v2 with an inferred flat length.
  const int64_t expectedStates6nLen = (int64_t)n * 6;
  if (expectedStates6nLen > 2147483647LL) {
    // Keep the ABI stable: validate before casting down to int.
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08(): inferred states6nLen would overflow int");
  }
  return tspice_spkw08_v2(
      handle,
      body,
      center,
      frame,
      first,
      last,
      segid,
      degree,
      n,
      states6n,
      (int)expectedStates6nLen,
      epoch1,
      step,
      err,
      errMaxBytes);
}

int tspice_spkw08_v2(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    int states6nLen,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!frame) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): frame must not be NULL");
  }
  if (!segid) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): segid must not be NULL");
  }
  if (n <= 0) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): n must be > 0");
  }
  if (!states6n) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): states6n must not be NULL");
  }

  // Validate the flat input length before casting to `SpiceDouble[n][6]`.
  const int64_t expectedStates6nLen = (int64_t)n * 6;
  if ((int64_t)states6nLen != expectedStates6nLen) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): states6nLen must equal 6*n");
  }

  SpiceInt handleC = 0;
  SpiceInt bodyC = 0;
  SpiceInt centerC = 0;
  SpiceInt degreeC = 0;
  SpiceInt nC = 0;

  if (tspice_int_to_spice_int_checked(handle, &handleC, "tspice_spkw08_v2(handle)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(body, &bodyC, "tspice_spkw08_v2(body)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(center, &centerC, "tspice_spkw08_v2(center)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(degree, &degreeC, "tspice_spkw08_v2(degree)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(n, &nC, "tspice_spkw08_v2(n)", err, errMaxBytes) != 0) return 1;

  // Interpret `states6n` as an array of `n` 6-vectors.
  const SpiceDouble(*states)[6] = (const SpiceDouble(*)[6])states6n;

  spkw08_c(
      handleC,
      bodyC,
      centerC,
      frame,
      (SpiceDouble)first,
      (SpiceDouble)last,
      segid,
      degreeC,
      nC,
      states,
      (SpiceDouble)epoch1,
      (SpiceDouble)step);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
