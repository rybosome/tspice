#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <string.h>

int tspice_namfrm(
    const char *frameName,
    int *outFrameId,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameId) {
    *outFrameId = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frameId = 0;
  namfrm_c(frameName, &frameId);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrameId) {
    *outFrameId = (int)frameId;
  }
  if (outFound) {
    *outFound = frameId != 0 ? 1 : 0;
  }

  return 0;
}

int tspice_frmnam(
    int frameId,
    char *outFrameName,
    int outFrameNameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameNameMaxBytes > 0 && outFrameName) {
    outFrameName[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  frmnam_c((SpiceInt)frameId, (SpiceInt)outFrameNameMaxBytes, outFrameName);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (outFrameName && outFrameName[0] != '\0') ? 1 : 0;
  }

  return 0;
}

int tspice_cidfrm(
    int center,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceChar frname[32] = {0};
  SpiceBoolean found = SPICEFALSE;

  cidfrm_c((SpiceInt)center, (SpiceInt)sizeof(frname), &frcode, frname, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }

  if (outFrname && outFrnameMaxBytes > 0) {
    strncpy(outFrname, frname, (size_t)outFrnameMaxBytes - 1);
    outFrname[outFrnameMaxBytes - 1] = '\0';
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_cnmfrm(
    const char *centerName,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceChar frname[32] = {0};
  SpiceBoolean found = SPICEFALSE;

  cnmfrm_c(centerName, (SpiceInt)sizeof(frname), &frcode, frname, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }

  if (outFrname && outFrnameMaxBytes > 0) {
    strncpy(outFrname, frname, (size_t)outFrnameMaxBytes - 1);
    outFrname[outFrnameMaxBytes - 1] = '\0';
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_frinfo(
    int frameId,
    int *outCenter,
    int *outFrameClass,
    int *outClassId,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCenter) {
    *outCenter = 0;
  }
  if (outFrameClass) {
    *outFrameClass = 0;
  }
  if (outClassId) {
    *outClassId = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt center = 0;
  SpiceInt frclss = 0;
  SpiceInt clssid = 0;
  SpiceBoolean found = SPICEFALSE;

  frinfo_c((SpiceInt)frameId, &center, &frclss, &clssid, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outCenter) {
    *outCenter = (int)center;
  }
  if (outFrameClass) {
    *outFrameClass = (int)frclss;
  }
  if (outClassId) {
    *outClassId = (int)clssid;
  }
  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  return 0;
}

int tspice_ccifrm(
    int frameClass,
    int classId,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outCenter,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }
  if (outCenter) {
    *outCenter = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceInt center = 0;
  SpiceBoolean found = SPICEFALSE;

  ccifrm_c(
      (SpiceInt)frameClass,
      (SpiceInt)classId,
      (SpiceInt)outFrnameMaxBytes,
      &frcode,
      outFrname,
      &center,
      &found);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }
  if (outCenter) {
    *outCenter = (int)center;
  }
  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  return 0;
}

int tspice_pxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix3x3,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[3][3];
  pxform_c(from, to, (SpiceDouble)et, m);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outMatrix3x3) {
    outMatrix3x3[0] = (double)m[0][0];
    outMatrix3x3[1] = (double)m[0][1];
    outMatrix3x3[2] = (double)m[0][2];

    outMatrix3x3[3] = (double)m[1][0];
    outMatrix3x3[4] = (double)m[1][1];
    outMatrix3x3[5] = (double)m[1][2];

    outMatrix3x3[6] = (double)m[2][0];
    outMatrix3x3[7] = (double)m[2][1];
    outMatrix3x3[8] = (double)m[2][2];
  }

  return 0;
}

int tspice_sxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix6x6,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[6][6];
  sxform_c(from, to, (SpiceDouble)et, m);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outMatrix6x6) {
    int i;
    int j;
    for (i = 0; i < 6; i++) {
      for (j = 0; j < 6; j++) {
        outMatrix6x6[i * 6 + j] = (double)m[i][j];
      }
    }
  }

  return 0;
}

int tspice_ckgp(
    int inst,
    double sclkdp,
    double tol,
    const char *ref,
    double *outMatrix3x3,
    double *outClkout,
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
  if (outClkout) {
    *outClkout = 0.0;
  }

  SpiceDouble cmat[3][3];
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgp_c(
      (SpiceInt)inst,
      (SpiceDouble)sclkdp,
      (SpiceDouble)tol,
      ref,
      cmat,
      &clkout,
      &found);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outMatrix3x3) {
      outMatrix3x3[0] = (double)cmat[0][0];
      outMatrix3x3[1] = (double)cmat[0][1];
      outMatrix3x3[2] = (double)cmat[0][2];
      outMatrix3x3[3] = (double)cmat[1][0];
      outMatrix3x3[4] = (double)cmat[1][1];
      outMatrix3x3[5] = (double)cmat[1][2];
      outMatrix3x3[6] = (double)cmat[2][0];
      outMatrix3x3[7] = (double)cmat[2][1];
      outMatrix3x3[8] = (double)cmat[2][2];
    }
    if (outClkout) {
      *outClkout = (double)clkout;
    }
  }

  return 0;
}

int tspice_ckgpav(
    int inst,
    double sclkdp,
    double tol,
    const char *ref,
    double *outMatrix3x3,
    double *outAv3,
    double *outClkout,
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
  if (outClkout) {
    *outClkout = 0.0;
  }
  if (outAv3) {
    outAv3[0] = 0.0;
    outAv3[1] = 0.0;
    outAv3[2] = 0.0;
  }

  SpiceDouble cmat[3][3];
  SpiceDouble av[3];
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgpav_c(
      (SpiceInt)inst,
      (SpiceDouble)sclkdp,
      (SpiceDouble)tol,
      ref,
      cmat,
      av,
      &clkout,
      &found);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outMatrix3x3) {
      outMatrix3x3[0] = (double)cmat[0][0];
      outMatrix3x3[1] = (double)cmat[0][1];
      outMatrix3x3[2] = (double)cmat[0][2];
      outMatrix3x3[3] = (double)cmat[1][0];
      outMatrix3x3[4] = (double)cmat[1][1];
      outMatrix3x3[5] = (double)cmat[1][2];
      outMatrix3x3[6] = (double)cmat[2][0];
      outMatrix3x3[7] = (double)cmat[2][1];
      outMatrix3x3[8] = (double)cmat[2][2];
    }
    if (outAv3) {
      outAv3[0] = (double)av[0];
      outAv3[1] = (double)av[1];
      outAv3[2] = (double)av[2];
    }
    if (outClkout) {
      *outClkout = (double)clkout;
    }
  }

  return 0;
}
